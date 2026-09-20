import { Badge, statusTone } from "./badge";
import { Evidence } from "./evidence";
import type { CanonicalProof } from "../../lib/proof";

const shortAddr = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
const shortHash = (h: string) => (h.length > 20 ? `${h.slice(0, 10)}…${h.slice(-8)}` : h);

/**
 * Settlement receipt: Job / ACCEPTED / amount / Paid dominate.
 * Verdict, worker, consensus, and execution are secondary.
 * Values come from proof.ts — never hardcoded here.
 */
export function ReceiptCard({ proof }: { proof: CanonicalProof }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#e5e2da] bg-white">
      <div className="border-b border-[#e5e2da] px-5 pt-5 pb-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] font-semibold text-[#101828]">
            Job #{proof.jobId} <span className="font-normal text-[#667085]">· {proof.title}</span>
          </p>
          <Badge tone={statusTone(proof.status)}>{proof.status}</Badge>
        </div>
        <p className="mono mt-3 text-[32px] leading-none font-bold tracking-tight text-[#101828]">
          {proof.escrowGen} <span className="text-lg font-semibold">GEN</span>
        </p>
        <p className="mt-2 text-[15px] font-bold text-[#157f3d]">Paid</p>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 px-5 py-4 text-sm sm:grid-cols-[140px_1fr] sm:px-6">
        <dt className="text-[#667085]">Receipt</dt>
        <dd className="mono text-[#101828]">
          job-{proof.jobId} · {proof.status}
        </dd>
        <dt className="text-[#667085]">Verdict</dt>
        <dd className="text-[#101828]">{proof.verdict === "pass" ? "Pass" : proof.verdict}</dd>
        <dt className="text-[#667085]">Worker</dt>
        <dd className="mono text-[#101828]">{shortAddr(proof.worker)}</dd>
        <dt className="text-[#667085]">Consensus</dt>
        <dd className="text-[#101828]">
          {proof.judging.agree} agree · {proof.judging.idle} idle
        </dd>
        <dt className="text-[#667085]">Execution</dt>
        <dd className="text-[#101828]">{proof.judging.execution}</dd>
      </dl>
      <div className="px-5 pb-5 sm:px-6">
        <Evidence label="Technical evidence (hashes)">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-[140px_1fr]">
            {(
              [
                ["Post", proof.txs.post],
                ["Submit", proof.txs.submit],
                ["Judge", proof.txs.judge],
                ["Payout child", proof.txs.payout],
              ] as const
            ).map(([label, t]) => (
              <div key={label} className="contents">
                <dt className="text-[#667085]">{label}</dt>
                <dd className="mono text-[#101828]">
                  {shortHash(t.hash)}
                  <span className="block text-[#667085]">
                    {t.status} / {t.execution}
                  </span>
                  <span className="break-all text-[#667085]">{t.hash}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[13px] leading-relaxed text-[#667085]">{proof.txs.payout.note}</p>
        </Evidence>
      </div>
    </div>
  );
}
