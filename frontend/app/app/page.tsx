"use client";

import { useEffect, useState } from "react";
import {
  connectWallet,
  getProvider,
  CONTRACT_ADDRESS,
  CHAIN_ID,
  RPC_URL,
  getExplorerTxUrl,
  getStudioUrl,
} from "../../lib/genlayer/client";
import {
  readJob,
  readBalance,
  fetchTx,
  writeMethod,
  genToWei,
  type JobRecord,
  type TrackedWrite,
  type FeePreset,
} from "../../lib/contracts/TaskEscrow";
import { payloadHexWrite } from "../../lib/genlayer/direct-read";
import { SiteHeader, SiteFooter } from "../../components/site";
import { Button } from "../../components/ui/button";
import { Badge, statusTone } from "../../components/ui/badge";
import { Alert } from "../../components/ui/alert";
import { Field } from "../../components/ui/field";
import { Timeline, type Phase } from "../../components/ui/timeline";
import { Evidence } from "../../components/ui/evidence";
import { ReviewDialog } from "../../components/ui/review-dialog";

interface PendingAction {
  title: string;
  rows: [string, string][];
  technical: [string, string][];
  confirmLabel: string;
  run: () => Promise<TrackedWrite>;
}

/** Technical rows shared by every write: intake model, envelope, network. */
function techRows(method: string, args: (string | number | bigint)[], valueHex: string): [string, string][] {
  return [
    ["To (contract)", CONTRACT_ADDRESS],
    ["Value", valueHex],
    ["Network", `Studionet · chain ${CHAIN_ID}`],
    ["RPC", RPC_URL],
    ["Intake", "direct-to-contract eth_sendTransaction (no consensus.addTransaction)"],
    ["Envelope", "RLP([calldata, b''])"],
    ["Calldata", payloadHexWrite(method, args)],
  ];
}

const MIN_TITLE = 10;
const MIN_SPEC = 80;
const MIN_CRITERIA = 80;

function phasesFor(tx: TrackedWrite | null): Phase[] {
  if (!tx) {
    return [
      { id: "s", label: "Submitted", state: "todo" },
      { id: "d", label: "Decided", state: "todo" },
      { id: "f", label: "Finalized", state: "todo" },
      { id: "p", label: "Payout", state: "todo" },
    ];
  }
  const fin = tx.finalized?.statusName === "FINALIZED";
  return [
    { id: "s", label: "Submitted", detail: tx.txId, state: "done" },
    {
      id: "d",
      label: "Decided",
      detail: tx.decided?.statusName,
      state: tx.decided ? "done" : "current",
    },
    {
      id: "f",
      label: "Finalized",
      detail: String(tx.executionResult ?? tx.finalized?.result_name ?? ""),
      state: !tx.finalized ? "current" : tx.successful ? "done" : "failed",
    },
    {
      id: "p",
      label: "Payout",
      detail: tx.triggered?.[0],
      state: tx.triggered && tx.triggered.length > 0 ? "done" : fin && tx.successful ? "current" : "todo",
    },
  ];
}

const DECIDED = ["ACCEPTED", "REJECTED", "UNDETERMINED", "RESOLVED", "REFUNDED"];

/** One workflow stage: expanded when active, concise summary when done. */
function Stage({
  n,
  title,
  state,
  summary,
  open,
  onToggle,
  children,
}: {
  n: number;
  title: string;
  state: "done" | "current" | "todo";
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={`Step ${n}: ${title}`} className="border-b border-[#e5e2da] py-8 first:pt-2 last:border-b-0 last:pb-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 text-left"
      >
        <span
          aria-hidden="true"
          className={
            state === "done"
              ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-[#157f3d] text-sm font-bold text-white"
              : state === "current"
                ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-[#3b5bfd] text-sm font-bold text-white"
                : "flex size-8 shrink-0 items-center justify-center rounded-full border border-[#d4cfc2] text-sm font-bold text-[#667085]"
          }
        >
          {state === "done" ? "✓" : n}
        </span>
        <span className="flex-1">
          <span className="block text-lg font-bold text-[#101828]">{title}</span>
          {!open && summary && <span className="mt-0.5 block text-sm text-[#667085]">{summary}</span>}
        </span>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" className={`shrink-0 text-[#667085] transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="mt-6 max-w-[640px]">{children}</div>}
    </section>
  );
}

export default function AppPage() {
  const [account, setAccount] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [jobId, setJobId] = useState("0");
  const [job, setJob] = useState<JobRecord | null>(null);
  const [balance, setBalance] = useState("");
  const [preset, setPreset] = useState<FeePreset>("standard");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [lastTx, setLastTx] = useState<TrackedWrite | null>(null);
  const [trackLog, setTrackLog] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [openStage, setOpenStage] = useState<string | null>(null);

  const [title, setTitle] = useState("Build CSV parser CLI tool");
  const [spec, setSpec] = useState(
    "Implement a Python CLI that parses CSV files with headers, validates required columns id,name,amount, outputs JSON to stdout, and exits non-zero on bad input."
  );
  const [criteria, setCriteria] = useState(
    "Must accept a file path arg, handle quoted commas, reject missing columns, print valid JSON array, and include --help text describing usage and options."
  );
  const [format, setFormat] = useState("public repo URL + commit hash + description");
  const [days, setDays] = useState("7");
  const [escrow, setEscrow] = useState("0.002");
  const [url, setUrl] = useState("https://github.com/org/repo/commit/abc123");
  const [hash, setHash] = useState("abc123hash");
  const [desc, setDesc] = useState("Delivery completed");

  const pushTrack = (s: { phase?: string; statusName?: string; executionResultName?: string }) => {
    const line = `${new Date().toISOString()} ${s?.phase ?? ""} ${s?.statusName ?? ""} ${s?.executionResultName ?? ""}`.trim();
    setTrackLog((prev) => [...prev.slice(-19), line]);
  };

  async function doConnect() {
    setErr("");
    try {
      setAccount(await connectWallet());
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function loadJob() {
    setErr("");
    setBusy("load");
    try {
      const id = parseInt(jobId);
      const [j, bal] = await Promise.all([readJob(id), readBalance()]);
      setJob(j);
      setBalance((Number(bal) / 1e18).toFixed(6));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setJob(null);
    } finally {
      setBusy("");
    }
  }

  async function runWrite(label: string, fn: () => Promise<TrackedWrite>) {
    setErr("");
    setBusy(label);
    setLastTx(null);
    try {
      const tx = await fn();
      setLastTx(tx);
      if (!tx.successful)
        setErr(`${label}: transaction not successful (${String(tx.executionResult ?? "")})`);
      await loadJob().catch(() => {});
    } catch (e: unknown) {
      setErr(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy("");
      setPending(null);
    }
  }

  const needWallet = !account;
  const st = job?.status ?? "";
  // Auto-advance: the stage matching on-chain state dominates; completed collapse.
  useEffect(() => {
    if (!job) return;
    if (st === "FUNDED") setOpenStage((o) => o ?? "submit");
    else if (st === "SUBMITTED" || DECIDED.includes(st)) setOpenStage((o) => o ?? "judge");
  }, [job, st]);
  const activeStage = !job ? "create" : st === "FUNDED" ? "submit" : "judge";
  const isOpen = (id: string, fallbackActive: boolean) =>
    openStage !== null ? openStage === id : fallbackActive || activeStage === id;
  const toggle = (id: string, fallbackActive: boolean) =>
    setOpenStage(isOpen(id, fallbackActive) ? "__none" : id);

  const createSummary = job
    ? `Job #${jobId} · ${(Number(job.amount_wei) / 1e18).toFixed(3)} GEN · ${job.status}`
    : undefined;
  const submitSummary = job && st !== "FUNDED" ? (job.delivery_url ? `Delivered: ${job.delivery_url.slice(0, 60)}…` : job.status) : undefined;
  const judgeSummary = job && DECIDED.includes(st) ? `${job.status} · verdict ${job.verdict || "—"} · paid ${String(job.paid)}` : undefined;

  return (
    <div>
      <SiteHeader
        end={account ? { kind: "connect", connected: account, onConnect: doConnect } : { kind: "connect", connected: "", onConnect: doConnect }}
      />

      <main className="mx-auto max-w-[880px] px-4 py-10 sm:px-6">
        <p className="text-xs font-bold tracking-[0.14em] text-[#2440d8] uppercase">Acceptance workflow</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#101828] sm:text-4xl">
          Run a job to verdict
        </h1>
        <p className="mt-3 max-w-[640px] text-[15px] leading-relaxed text-[#475467]">
          Create with escrow, submit evidence, trigger GenLayer judgment, settle against the receipt.
          Contract <span className="mono break-all">{CONTRACT_ADDRESS || "not configured"}</span> ·{" "}
          <a className="text-[#2440d8] underline-offset-2 hover:underline" href={getStudioUrl()} target="_blank" rel="noreferrer">
            Open in Studio
          </a>
          {balance && <span> · Balance {balance} GEN</span>}
        </p>

        {err && (
          <div className="mt-6">
            <Alert tone="reject" title="Error">
              {err}
            </Alert>
          </div>
        )}

        <div className="mt-8 rounded-xl border border-[#e5e2da] bg-white px-5 py-2 sm:px-7">
          {/* 1 · Create */}
          <Stage
            n={1}
            title="Create job + lock escrow"
            state={!job ? "current" : "done"}
            summary={createSummary}
            open={isOpen("create", activeStage === "create")}
            onToggle={() => toggle("create", activeStage === "create")}
          >
            <Field id="f-title" label="Title" hint={`${title.length}/${MIN_TITLE} chars min`}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. GenLayer football betting contract" />
            </Field>
            <Field id="f-spec" label="Specification" hint={`${spec.length}/${MIN_SPEC} chars min — what must be delivered`}>
              <textarea value={spec} onChange={(e) => setSpec(e.target.value)} rows={3} />
            </Field>
            <Field id="f-criteria" label="Acceptance criteria" hint={`${criteria.length}/${MIN_CRITERIA} chars min — the exact rubric validators judge`}>
              <textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} rows={3} />
            </Field>
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
              <Field id="f-format" label="Format">
                <input value={format} onChange={(e) => setFormat(e.target.value)} />
              </Field>
              <Field id="f-days" label="Deadline (days)">
                <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" />
              </Field>
              <Field id="f-escrow" label="Escrow (GEN)">
                <input value={escrow} onChange={(e) => setEscrow(e.target.value)} inputMode="decimal" />
              </Field>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <label htmlFor="f-preset" className="text-sm font-semibold text-[#101828]">Fee preset</label>
              <select id="f-preset" value={preset} onChange={(e) => setPreset(e.target.value as FeePreset)} className="min-h-[44px] rounded-lg border border-[#d4cfc2] bg-white px-3 text-sm">
                <option value="low">low</option>
                <option value="standard">standard</option>
                <option value="high">high</option>
              </select>
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                disabled={needWallet || !!busy}
                onClick={() => {
                  const deadline = Math.floor(Date.now() / 1000) + parseInt(days) * 86400;
                  const valueWei = genToWei(escrow);
                  const valueHex = "0x" + valueWei.toString(16);
                  const args: (string | number)[] = [title, spec, criteria, format, deadline];
                  setPending({
                    title: "Confirm job creation",
                    rows: [
                      ["Action", "Create job + lock escrow"],
                      ["Amount", `${escrow} GEN`],
                      ["Network", "Studionet (61999)"],
                      ["Recipient", "TaskEscrow contract"],
                      ["Consensus", "Validator rounds run after submission"],
                    ],
                    technical: techRows("post_job", args, valueHex),
                    confirmLabel: `Post job + lock ${escrow} GEN`,
                    run: () =>
                      writeMethod(account, "post_job", args, { value: valueWei, preset, onTrack: pushTrack }),
                  });
                }}
              >
                {busy === "post" ? "Posting…" : `Post job + lock ${escrow} GEN`}
              </Button>
            </div>
          </Stage>

          {/* 2 · Submit */}
          <Stage
            n={2}
            title="Submit delivery"
            state={!job || st === "FUNDED" ? (job ? "current" : "todo") : "done"}
            summary={submitSummary}
            open={isOpen("submit", activeStage === "submit")}
            onToggle={() => toggle("submit", activeStage === "submit")}
          >
            <Field id="f-url" label="Delivery URL" hint="https, allowlisted host">
              <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" />
            </Field>
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Field id="f-hash" label="Content hash">
                <input value={hash} onChange={(e) => setHash(e.target.value)} />
              </Field>
              <Field id="f-desc" label="Description">
                <input value={desc} onChange={(e) => setDesc(e.target.value)} />
              </Field>
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                variant="secondary"
                disabled={needWallet || !!busy}
                onClick={() => {
                  const args: (string | number)[] = [parseInt(jobId), url, hash, desc];
                  setPending({
                    title: "Confirm delivery submission",
                    rows: [
                      ["Action", "Submit delivery evidence"],
                      ["Amount", "no value (0 GEN)"],
                      ["Network", "Studionet (61999)"],
                      ["Recipient", "TaskEscrow contract"],
                      ["Consensus", "Validator rounds run after submission"],
                    ],
                    technical: techRows("submit", args, "0x0"),
                    confirmLabel: "Submit delivery",
                    run: () => writeMethod(account, "submit", args, { preset, onTrack: pushTrack }),
                  });
                }}
              >
                {busy === "submit" ? "Submitting…" : "Submit"}
              </Button>
            </div>
          </Stage>

          {/* 3 · Judge & settle */}
          <Stage
            n={3}
            title="Judge & settle"
            state={job && DECIDED.includes(st) ? "done" : job && st === "SUBMITTED" ? "current" : "todo"}
            summary={judgeSummary}
            open={isOpen("judge", activeStage === "judge")}
            onToggle={() => toggle("judge", activeStage === "judge")}
          >
            <p className="text-sm text-[#667085]">
              Judge runs validator consensus (minutes). Reclaim refunds the payer after reject/expiry.
              Release finalizes an accepted payout.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button
                disabled={needWallet || !!busy}
                onClick={() => {
                  const args: (string | number)[] = [parseInt(jobId)];
                  setPending({
                    title: "Confirm judgment",
                    rows: [
                      ["Action", "Judge delivery (validator consensus)"],
                      ["Amount", "no value (0 GEN)"],
                      ["Network", "Studionet (61999)"],
                      ["Recipient", "TaskEscrow contract"],
                      ["Consensus", "Takes minutes; pass / fail / undetermined"],
                    ],
                    technical: techRows("judge", args, "0x0"),
                    confirmLabel: "Judge",
                    run: () => writeMethod(account, "judge", args, { preset, onTrack: pushTrack }),
                  });
                }}
              >
                {busy === "judge" ? "Judging…" : "Judge"}
              </Button>
              <Button
                variant="secondary"
                disabled={needWallet || !!busy}
                onClick={() => {
                  const args: (string | number)[] = [parseInt(jobId)];
                  setPending({
                    title: "Confirm reclaim",
                    rows: [
                      ["Action", "Reclaim escrow to payer"],
                      ["Amount", "job escrow (by job ID)"],
                      ["Network", "Studionet (61999)"],
                      ["Recipient", "TaskEscrow contract"],
                      ["Consensus", "Payer-only; rejected, undetermined, or expired"],
                    ],
                    technical: techRows("reclaim", args, "0x0"),
                    confirmLabel: "Reclaim",
                    run: () => writeMethod(account, "reclaim", args, { preset, onTrack: pushTrack }),
                  });
                }}
              >
                Reclaim
              </Button>
              <Button
                variant="secondary"
                disabled={needWallet || !!busy}
                onClick={() => {
                  const args: (string | number)[] = [parseInt(jobId)];
                  setPending({
                    title: "Confirm release",
                    rows: [
                      ["Action", "Release escrow to worker"],
                      ["Amount", "job escrow (by job ID)"],
                      ["Network", "Studionet (61999)"],
                      ["Recipient", "TaskEscrow contract"],
                      ["Consensus", "Accepted jobs only; idempotent"],
                    ],
                    technical: techRows("release", args, "0x0"),
                    confirmLabel: "Release",
                    run: () => writeMethod(account, "release", args, { preset, onTrack: pushTrack }),
                  });
                }}
              >
                Release
              </Button>
            </div>
          </Stage>
        </div>

        {/* Tracker */}
        {lastTx && (
          <section aria-labelledby="track-h" className="mt-6 rounded-xl border border-[#e5e2da] bg-white p-5 sm:p-6">
            <h2 id="track-h" className="text-lg font-bold text-[#101828]">Transaction tracker</h2>
            <div className="mt-4">
              <Timeline phases={phasesFor(lastTx)} />
            </div>
            <div className="mono mt-4 break-all text-[13px] text-[#475467]">
              <p>via {lastTx.path} · {lastTx.txId}</p>
              <p>
                execution: {String(lastTx.executionResult ?? lastTx.finalized?.result_name ?? "—")} ·{" "}
                {lastTx.successful ? "SUCCESS (isSuccessful)" : "NOT SUCCESSFUL"}
              </p>
              {(() => {
                const ex = getExplorerTxUrl(lastTx.txId);
                return ex ? (
                  <p>
                    <a className="text-[#2440d8] underline-offset-2 hover:underline" href={ex} target="_blank" rel="noreferrer">
                      View in explorer
                    </a>
                  </p>
                ) : null;
              })()}
              {lastTx.triggered?.map((t) => (
                <p key={t}>child: {t}</p>
              ))}
            </div>
            {trackLog.length > 0 && (
              <div className="mt-4">
                <Evidence label="Lifecycle log">
                  <pre className="mono max-h-[200px] overflow-auto text-xs whitespace-pre-wrap text-[#101828]">
                    {trackLog.join("\n")}
                  </pre>
                  <Button
                    variant="secondary"
                    className="mt-3 min-h-[40px] px-4"
                    onClick={async () => {
                      const t = await fetchTx(lastTx.txId);
                      const exec = t?.statusName ?? t?.result_name ?? "?";
                      const result = t?.txExecutionResultName ?? t?.result_name ?? String(t?.result ?? "?");
                      setTrackLog((p) => [...p, `getTransaction: ${exec} / ${result}`]);
                    }}
                  >
                    Refresh via getTransaction
                  </Button>
                </Evidence>
              </div>
            )}
          </section>
        )}

        {/* Inspect — secondary utility */}
        <section aria-labelledby="inspect-h" className="mt-8">
          <h2 id="inspect-h" className="text-base font-bold text-[#101828]">Inspect any job</h2>
          <div className="mt-3 flex max-w-[420px] flex-wrap items-end gap-3">
            <div className="w-[120px]">
              <Field id="f-jobid" label="Job ID">
                <input value={jobId} onChange={(e) => setJobId(e.target.value)} inputMode="numeric" />
              </Field>
            </div>
            <Button variant="secondary" disabled={!!busy} onClick={loadJob} className="mb-4">
              {busy === "load" ? "Loading…" : "Load job"}
            </Button>
          </div>
          {job && (
            <div className="mt-2 max-w-[640px]">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                <span className="text-sm text-[#667085]">
                  verdict: {job.verdict || "—"} · paid: {String(job.paid)}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[140px_1fr]">
                <dt className="text-[#667085]">Payer</dt>
                <dd className="mono break-all text-[#101828]">{job.payer}</dd>
                <dt className="text-[#667085]">Worker</dt>
                <dd className="mono break-all text-[#101828]">{job.worker || "—"}</dd>
                <dt className="text-[#667085]">Escrow</dt>
                <dd className="mono text-[#101828]">{(Number(job.amount_wei) / 1e18).toFixed(6)} GEN</dd>
                <dt className="text-[#667085]">Delivery</dt>
                <dd className="mono break-all text-[#101828]">{job.delivery_url || "—"}</dd>
                <dt className="text-[#667085]">Reasoning</dt>
                <dd className="text-[#101828]">{job.reasoning || "—"}</dd>
              </dl>
              <div className="mt-3">
                <Evidence label="Raw job JSON">
                  <pre className="mono max-h-[260px] overflow-auto text-xs whitespace-pre-wrap text-[#101828]">
                    {JSON.stringify(job, null, 2)}
                  </pre>
                </Evidence>
              </div>
            </div>
          )}
        </section>

        <section aria-label="Finality note" className="mt-8">
          <Alert tone="info" title="Finality, not receipt">
            A transaction counts only after <strong>finalized</strong> status plus <strong>isSuccessful</strong> and{" "}
            <strong>FINISHED_WITH_RETURN</strong>. “Decided” alone never counts — the tracker shows both stages separately.
            {!mounted ? null : !getProvider() && (
              <span className="mt-1 block">
                No browser wallet detected. Reads work without a wallet; writes need MetaMask on chain {CHAIN_ID}.
              </span>
            )}
          </Alert>
          <p className="mono mt-3 text-[13px] text-[#667085]">RPC: {RPC_URL}</p>
        </section>
      </main>

      <ReviewDialog
        open={!!pending}
        onOpenChange={(v) => {
          if (!v && !busy) setPending(null);
        }}
        title={pending?.title ?? ""}
        rows={pending?.rows ?? []}
        technical={pending?.technical ?? []}
        confirmLabel={pending?.confirmLabel ?? "Confirm"}
        busy={!!busy}
        onConfirm={() => {
          if (pending) runWrite(pending.confirmLabel, pending.run);
        }}
      />

      <SiteFooter />
    </div>
  );
}
