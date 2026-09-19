"use client";

import { createClient, isSuccessful } from "genlayer-js";
import { createTransactionKit } from "@genlayer/transaction-kit";
import feeProfile from "../../fee-profile.json";
import {
  resolveChain,
  CONTRACT_ADDRESS,
  getProvider,
} from "../genlayer/client";
import { directGenCall } from "../genlayer/direct-read";

export type FeePreset = "low" | "standard" | "high";

export interface JobRecord {
  payer: string;
  worker: string;
  title: string;
  spec: string;
  criteria: string;
  format: string;
  deadline: string;
  amount_wei: string;
  delivery_url: string;
  content_hash: string;
  description: string;
  status: string;
  verdict: string;
  reasoning: string;
  decided_at: string;
  paid: boolean;
}

export interface TrackedWrite {
  txId: string;
  decided?: any;
  finalized?: any;
  successful: boolean;
  executionResult?: string;
  triggered?: string[];
  path: "transaction-kit" | "direct-sdk";
}

/** Parse a GEN amount like "0.002" into wei bigint. */
export function genToWei(gen: string): bigint {
  const [whole = "0", frac = ""] = gen.trim().split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole || "0") * 10n ** 18n + BigInt(fracPadded || "0");
}

function requireAddress(): `0x${string}` {
  const addr = CONTRACT_ADDRESS || (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as string);
  if (!addr) throw new Error("Contract address not configured.");
  return addr as `0x${string}`;
}

export async function readJob(jobId: number): Promise<JobRecord> {
  try {
    const client: any = createClient({ chain: resolveChain() } as any);
    const raw: string = await client.readContract({
      address: requireAddress(),
      functionName: "get_job",
      args: [jobId],
    });
    return JSON.parse(raw) as JobRecord;
  } catch {
    // SDK readContract encoding is rejected by Studionet; use the proven
    // direct gen_call path (same bytes the Python bundle reads with).
    return JSON.parse(String(await directGenCall("get_job", [jobId]))) as JobRecord;
  }
}

export async function readStatus(jobId: number): Promise<string> {
  try {
    const client: any = createClient({ chain: resolveChain() } as any);
    return (await client.readContract({
      address: requireAddress(),
      functionName: "get_status",
      args: [jobId],
    })) as string;
  } catch {
    return String(await directGenCall("get_status", [jobId]));
  }
}

export async function readBalance(): Promise<bigint> {
  try {
    const client: any = createClient({ chain: resolveChain() } as any);
    const bal: any = await client.readContract({
      address: requireAddress(),
      functionName: "get_balance",
      args: [],
    });
    return BigInt(bal?.toString?.() ?? bal);
  } catch {
    const bal = await directGenCall("get_balance", []);
    return BigInt(typeof bal === "bigint" ? bal.toString() : Math.trunc(Number(bal)));
  }
}

export async function fetchTx(txId: string): Promise<any> {
  const client: any = createClient({ chain: resolveChain() } as any);
  return client.getTransaction({ hash: txId });
}

export async function fetchTriggered(txId: string): Promise<string[]> {
  const client: any = createClient({ chain: resolveChain() } as any);
  if (typeof client.getTriggeredTransactionIds !== "function") return [];
  return (await client.getTriggeredTransactionIds({ hash: txId })) as string[];
}

function makeKit(account: string): any {
  const provider = getProvider();
  if (!provider) throw new Error("No browser wallet found.");
  return createTransactionKit({
    chain: resolveChain(),
    provider: provider as any,
    account: account as `0x${string}`,
    suggestions: feeProfile as any,
  });
}

/**
 * Primary write path: Transaction Kit headless flow with the committed
 * fee-profile.json as suggestions (no hardcoded fees). Falls back to the
 * direct SDK with profile-derived fees if the kit path fails.
 */
export async function writeMethod(
  account: string,
  method: string,
  args: unknown[],
  opts: { value?: bigint; preset?: FeePreset; onTrack?: (s: any) => void } = {}
): Promise<TrackedWrite> {
  const address = requireAddress();
  const preset = opts.preset ?? "standard";
  const value = opts.value ?? 0n;
  const provider = getProvider();
  if (!provider) throw new Error("No browser wallet found.");

  // --- Primary: Transaction Kit ---
  try {
    const kit = makeKit(account);
    const txSpec: any = { kind: "write", address, method, args, value };
    const quote = await kit.estimate({ preset }, txSpec);
    if (quote?.verification?.status === "mismatch") {
      throw new Error("Fee policy changed; re-estimate before signing.");
    }
    const { genlayerTxId } = await kit.submit(quote, txSpec);
    let decided: any;
    const finalized: any = await kit.track(genlayerTxId, (s: any) => {
      if (s?.statusName === "ACCEPTED" || s?.phase === "decided") decided = s;
      opts.onTrack?.(s);
    });
    const successful = isSuccessful(finalized);
    const triggered = await fetchTriggered(genlayerTxId).catch(() => []);
    return {
      txId: genlayerTxId,
      decided,
      finalized,
      successful,
      executionResult: finalized?.txExecutionResultName,
      triggered,
      path: "transaction-kit",
    };
  } catch (kitErr) {
    // --- Fallback: direct SDK with profile-derived fees (no estimation) ---
    // Studionet exposes no sim_getFeeConfig, so every SDK estimation path
    // (kit estimate + estimateTransactionFeesForWrite) fails here. Build fees
    // directly from the committed fee-profile.json method entry instead.
    // All entries are the proven zero-deposit distribution (see profile
    // notes + proof/*.log: 4 deploys + 20 writes FINALIZED), so the SDK's
    // fee resolver accepts feeValue 0n with zero extra RPC calls. No
    // hardcoded fees: everything comes from the profile.
    const profileEntry: any =
      (feeProfile as any).methods?.[method] ?? (feeProfile as any).deploy ?? {};
    const distribution = {
      leaderTimeunitsAllocation: profileEntry.leaderTimeunitsAllocation ?? "0",
      validatorTimeunitsAllocation:
        profileEntry.validatorTimeunitsAllocation ?? "0",
      executionBudgetPerRound: profileEntry.executionBudgetPerRound ?? "0",
      totalMessageFees: profileEntry.totalMessageFees ?? "0",
    };
    const client: any = createClient({
      chain: resolveChain(),
      account: account as `0x${string}`,
      provider: provider as any,
    } as any);
    const call: any = { address, functionName: method, args, value };
    const txId = await client.writeContract({
      ...call,
      fees: { distribution, feeValue: 0n },
    });
    opts.onTrack?.({ phase: "submitted", txId });
    const decided = await client.waitForDecision({ hash: txId });
    opts.onTrack?.({ phase: "decided", ...decided });
    const finalized = await client.waitForFinalization({ hash: txId });
    opts.onTrack?.({ phase: "finalized", ...finalized });
    // waitFor* receipts use a different field shape than getTransaction
    // (no statusName/txExecutionResultName), which left the tracker showing
    // "pending…". Normalize through getTransaction so the UI always has the
    // canonical lifecycle + execution fields.
    const full: any = await client
      .getTransaction({ hash: txId })
      .catch(() => finalized);
    const triggered = await fetchTriggered(txId).catch(() => []);
    return {
      txId,
      decided,
      finalized: full,
      successful: isSuccessful(full),
      executionResult:
        full?.txExecutionResultName ?? full?.result_name ?? full?.result,
      triggered,
      path: "direct-sdk",
    };
  }
}
