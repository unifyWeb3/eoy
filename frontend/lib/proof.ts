/**
 * Canonical browser-originated proof, bound to verified on-chain values.
 *
 * Job 8 (Studionet, contract 0x97273c1D932dA1a79e3f414bCd33489B00c0eA5A):
 * created from a browser wallet via the production write path, judged by
 * GenLayer consensus to ACCEPT/pass. Verified read-only against
 * get_job(8), getTransaction x4, and eth_getBalance.
 *
 * Settlement: the successful Judge transaction (FINALIZED / MAJORITY_AGREE,
 * 3 agree · 2 idle) triggered native child transfer 0x3b3e… from TaskEscrow
 * to the worker for 0.002 GEN. A native child transfer carries no separate
 * validator consensus data (zero rounds is expected, not an uncertain
 * outcome) — the user-facing settlement state is Paid.
 */

export const CANONICAL_PROOF = {
  jobId: 8,
  title: "GenLayer football betting contract",
  escrowGen: "0.002",
  escrowWei: "2000000000000000",
  status: "ACCEPTED",
  verdict: "pass",
  paid: true,
  payer: "0x3211d1419709682b81c53CC51cb63622E25488d3",
  worker: "0x3211d1419709682b81c53CC51cb63622E25488d3",
  decidedAt: "2026-09-20T17:20:35+00:00",
  judging: {
    rounds: 1,
    agree: 3,
    idle: 2,
    execution: "Successful — majority-agree judge",
  },
  txs: {
    post: {
      hash: "0xe7507dd23d7b21e942715d38b117d22233bc8e36669ad4412bc3526fa2f24fc7",
      status: "FINALIZED",
      execution: "MAJORITY_AGREE",
    },
    submit: {
      hash: "0x23570053478194f666d7a8ceff3f05bf40caf19fb89aa4f0fd4da57afc1ce36b",
      status: "FINALIZED",
      execution: "MAJORITY_AGREE",
    },
    judge: {
      hash: "0xacba8452e5482ae160af0448d22b7f392a0f6d94f4b83f540902af9c639909f1",
      status: "FINALIZED",
      execution: "MAJORITY_AGREE",
    },
    payout: {
      hash: "0x3b3e356c98ed6ae9fd6a996984f06b0b183c40327aedf313939f3cc3abda324c",
      status: "FINALIZED",
      execution: "NO_MAJORITY",
      /** Native child transfer of the successful Judge tx: no separate consensus data by design. */
      note: "Native child transfer TaskEscrow → worker, 0.002 GEN. Settlement: Paid.",
    },
  },
  /** Contract balance reconciliation at verification time (wei). */
  accounting: {
    balanceWei: "14000000000000000",
    accountedWei: "10000000000000000",
    accountedNote: "Jobs 1–5 REJECTED, unclaimed (payer-reclaimable)",
    strandedWei: "4000000000000000",
    strandedNote: "0x6acf430e5629825a2f7dc87d4c527c4644ce22f494c9b3ef9237d8c7fd4ef499 (0.002, no job record) + 0x4467496bf0b472cbcaecd3499d22d29ba36ff3f00824c7d3c8c7899b2ffcce9b (0.002, same class) — no recovery path in the current contract",
    job8EscrowNote: "Job-8 POST moved 0.014 → 0.016; successful payout moved it back to 0.014. Not held.",
  },
} as const;

export type CanonicalProof = typeof CANONICAL_PROOF;
