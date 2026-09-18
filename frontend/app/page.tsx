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
} from "../lib/genlayer/client";
import {
  readJob,
  readStatus,
  readBalance,
  fetchTx,
  writeMethod,
  genToWei,
  type JobRecord,
  type TrackedWrite,
  type FeePreset,
} from "../lib/contracts/TaskEscrow";

function TxView({ label, tx }: { label: string; tx: TrackedWrite | null }) {
  if (!tx) return null;
  const ex = getExplorerTxUrl(tx.txId);
  return (
    <div className="txbox">
      <div><b>{label}</b> via {tx.path}</div>
      <div>tx: <code>{tx.txId}</code></div>
      {ex && <div><a href={ex} target="_blank" rel="noreferrer">View in explorer</a></div>}
      <div>
        decided:{" "}
        <span className="warn">{tx.decided?.statusName ?? "pending…"}</span>
        {"  "}finalized:{" "}
        <span className={tx.finalized ? "ok" : "warn"}>
          {tx.finalized?.statusName ?? "pending…"}
        </span>
      </div>
      <div>
        execution: <code>{tx.executionResult ?? "—"}</code>{" "}
        {tx.successful ? (
          <span className="ok">SUCCESS (isSuccessful)</span>
        ) : (
          <span className="bad">NOT SUCCESSFUL</span>
        )}
      </div>
      {tx.triggered && tx.triggered.length > 0 && (
        <div>child payout txs: {tx.triggered.map((t) => <div key={t}><code>{t}</code></div>)}</div>
      )}
    </div>
  );
}

export default function HomePage() {
  const [account, setAccount] = useState<string>("");
  // Mounted gate: getProvider() branches on typeof window, so reading it
  // during render mismatches SSR HTML (server: no wallet). Render null for
  // wallet-dependent UI until after mount to keep hydration consistent.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [jobId, setJobId] = useState<string>("0");
  const [job, setJob] = useState<JobRecord | null>(null);
  const [balance, setBalance] = useState<string>("");
  const [preset, setPreset] = useState<FeePreset>("standard");
  const [busy, setBusy] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [lastTx, setLastTx] = useState<TrackedWrite | null>(null);
  const [trackLog, setTrackLog] = useState<string[]>([]);

  // post form
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
  // submit form
  const [url, setUrl] = useState("https://github.com/org/repo/commit/abc123");
  const [hash, setHash] = useState("abc123hash");
  const [desc, setDesc] = useState("Delivery completed");

  const pushTrack = (s: any) => {
    const line = `${new Date().toISOString()} ${s?.phase ?? ""} ${s?.statusName ?? ""} ${s?.executionResultName ?? ""}`.trim();
    setTrackLog((prev) => [...prev.slice(-19), line]);
  };

  async function doConnect() {
    setErr("");
    try {
      setAccount(await connectWallet());
    } catch (e: any) {
      setErr(e?.message ?? String(e));
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
    } catch (e: any) {
      setErr(e?.message ?? String(e));
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
      if (!tx.successful) setErr(`${label}: transaction not successful (${tx.executionResult})`);
      await loadJob().catch(() => {});
    } catch (e: any) {
      setErr(`${label}: ${e?.message ?? String(e)}`);
    } finally {
      setBusy("");
    }
  }

  const needWallet = !account ? "connect wallet first" : "";

  return (
    <div>
      <nav className="nav">
        <div className="nav-inner">
          <span className="brand">Task Escrow · GenLayer</span>
          <span className="muted">chain {CHAIN_ID}</span>
          {account ? (
            <code>{account}</code>
          ) : (
            <button className="btn-primary" onClick={doConnect}>Connect wallet</button>
          )}
        </div>
      </nav>

      <div className="container">
        <div className="hero">
          <h1>Agent Task Escrow</h1>
          <p>Post code jobs with GEN escrow. Workers submit deliveries. GenLayer validators judge against your rubric.</p>
          <p className="muted">Contract: <code>{CONTRACT_ADDRESS || "not configured"}</code> · <a href={getStudioUrl()} target="_blank" rel="noreferrer">Open in Studio</a></p>
          <p className="muted">RPC: <code>{RPC_URL}</code></p>
        </div>

        {err && <div className="card"><span className="badge REJECTED">Error</span><p>{err}</p></div>}

        <div className="card">
          <h2>1 · Post a job (payable)</h2>
          <label>Title (≥10 chars)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
          <label>Spec (≥80 chars)</label>
          <textarea value={spec} onChange={(e) => setSpec(e.target.value)} />
          <label>Acceptance criteria (≥80 chars)</label>
          <textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} />
          <div className="grid2">
            <div>
              <label>Deliverable format</label>
              <input value={format} onChange={(e) => setFormat(e.target.value)} />
            </div>
            <div className="grid2">
              <div>
                <label>Deadline (days)</label>
                <input value={days} onChange={(e) => setDays(e.target.value)} />
              </div>
              <div>
                <label>Escrow (GEN)</label>
                <input value={escrow} onChange={(e) => setEscrow(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <label style={{ margin: 0 }}>Fee preset</label>
            <select value={preset} onChange={(e) => setPreset(e.target.value as FeePreset)} style={{ width: 140 }}>
              <option value="low">low</option>
              <option value="standard">standard</option>
              <option value="high">high</option>
            </select>
            <button className="btn-primary" disabled={!!needWallet || !!busy} onClick={() => runWrite("post", () => {
              const deadline = Math.floor(Date.now() / 1000) + parseInt(days) * 86400;
              return writeMethod(account, "post_job", [title, spec, criteria, format, deadline], { value: genToWei(escrow), preset, onTrack: pushTrack });
            })}>
              {busy === "post" ? "Posting…" : `Post job + lock ${escrow} GEN`}
            </button>
          </div>
          <p className="muted">Value (escrow) and protocol fees are estimated and submitted separately — never hardcoded.</p>
        </div>

        <div className="card">
          <h2>2 · Inspect a job</h2>
          <div className="row">
            <input value={jobId} onChange={(e) => setJobId(e.target.value)} style={{ width: 120 }} />
            <button className="btn-secondary" disabled={!!busy} onClick={loadJob}>{busy === "load" ? "Loading…" : "Load job"}</button>
            {balance && <span className="muted">contract balance: {balance} GEN</span>}
          </div>
          {job && (
            <div style={{ marginTop: 12 }}>
              <span className={`badge ${job.status}`}>{job.status}</span>{" "}
              <span className="muted">verdict: {job.verdict || "—"} · paid: {String(job.paid)}</span>
              <dl className="kv" style={{ marginTop: 10 }}>
                <dt>payer</dt><dd><code>{job.payer}</code></dd>
                <dt>worker</dt><dd><code>{job.worker || "—"}</code></dd>
                <dt>escrow</dt><dd>{(Number(job.amount_wei) / 1e18).toFixed(6)} GEN</dd>
                <dt>delivery</dt><dd><code>{job.delivery_url || "—"}</code></dd>
                <dt>reasoning</dt><dd>{job.reasoning || "—"}</dd>
              </dl>
              <pre className="job">{JSON.stringify(job, null, 2)}</pre>
            </div>
          )}
        </div>

        <div className="card">
          <h2>3 · Submit delivery (worker)</h2>
          <label>Delivery URL (https + allowlisted host)</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} />
          <div className="grid2">
            <div>
              <label>Content hash</label>
              <input value={hash} onChange={(e) => setHash(e.target.value)} />
            </div>
            <div>
              <label>Description</label>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn-secondary" disabled={!!needWallet || !!busy} onClick={() => runWrite("submit", () => writeMethod(account, "submit", [parseInt(jobId), url, hash, desc], { preset, onTrack: pushTrack }))}>
              {busy === "submit" ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>

        <div className="card">
          <h2>4 · Judge / reclaim / release</h2>
          <p className="muted">Judge runs validator consensus (minutes). Reclaim refunds the payer after reject/expiry. Release finalizes an accepted payout.</p>
          <div className="row">
            <button className="btn-primary" disabled={!!needWallet || !!busy} onClick={() => runWrite("judge", () => writeMethod(account, "judge", [parseInt(jobId)], { preset, onTrack: pushTrack }))}>
              {busy === "judge" ? "Judging…" : "Judge"}
            </button>
            <button className="btn-secondary" disabled={!!needWallet || !!busy} onClick={() => runWrite("reclaim", () => writeMethod(account, "reclaim", [parseInt(jobId)], { preset, onTrack: pushTrack }))}>
              Reclaim (payer)
            </button>
            <button className="btn-secondary" disabled={!!needWallet || !!busy} onClick={() => runWrite("release", () => writeMethod(account, "release", [parseInt(jobId)], { preset, onTrack: pushTrack }))}>
              Release (accepted)
            </button>
          </div>
        </div>

        <TxView label="Last transaction" tx={lastTx} />

        {trackLog.length > 0 && (
          <div className="card">
            <h2>Lifecycle log</h2>
            <pre className="job">{trackLog.join("\n")}</pre>
            <button className="btn-secondary" onClick={async () => {
              if (lastTx) {
                const t = await fetchTx(lastTx.txId);
                setTrackLog((p) => [...p, `getTransaction: ${t?.statusName} / ${t?.txExecutionResultName} / ${t?.lifecycle}`]);
              }
            }}>Refresh via getTransaction</button>
          </div>
        )}

        <div className="card">
          <h2>Finality, not receipt</h2>
          <p className="muted">A transaction is only treated as complete after <b>finalized</b> status plus <b>isSuccessful</b> and <b>FINISHED_WITH_RETURN</b>. “Decided” alone never counts — the tracker above always shows both stages separately.</p>
          {!mounted ? null : !getProvider() && <p className="muted">No browser wallet detected. Reads work without a wallet; writes need MetaMask (or compatible) on chain {CHAIN_ID}.</p>}
        </div>

        <div className="footer">
          <a href="https://studio.genlayer.com" target="_blank" rel="noreferrer">Studio</a>
          <a href="https://docs.genlayer.com" target="_blank" rel="noreferrer">Docs</a>
        </div>
      </div>
    </div>
  );
}
