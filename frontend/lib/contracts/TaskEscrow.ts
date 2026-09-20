"use client";

import { createClient, isSuccessful } from "genlayer-js";
import { resolveChain, CONTRACT_ADDRESS, getProvider } from "../genlayer/client";
import { directGenCall } from "../genlayer/direct-read";
import {
  formatConsensusPreSign,
  prepareConsensusWrite,
  type ConsensusPreSignDebug,
} from "../genlayer/consensus-write";

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
  path: "consensus-wallet";
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
      address: requireAddress(), functionName: "get_job", args: [jobId],
    });
    return JSON.parse(raw) as JobRecord;
  } catch {
    return JSON.parse(String(await directGenCall("get_job", [jobId]))) as JobRecord;
  }
}

export async function readStatus(jobId: number): Promise<string> {
  try {
    const client: any = createClient({ chain: resolveChain() } as any);
    return (await client.readContract({
      address: requireAddress(), functionName: "get_status", args: [jobId],
    })) as string;
  } catch {
    return String(await directGenCall("get_status", [jobId]));
  }
}

export async function readBalance(): Promise<bigint> {
  try {
    const client: any = createClient({ chain: resolveChain() } as any);
    const bal: any = await client.readContract({
      address: requireAddress(), functionName: "get_balance", args: [],
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

export async function writeMethod(
  account: string,
  method: string,
  args: unknown[],
  opts: {
    value?: bigint;
    preset?: FeePreset;
    onTrack?: (s: any) => void;
    onPreSign?: (debug: ConsensusPreSignDebug) => Promise<boolean> | boolean;
  } = {},
): Promise<TrackedWrite> {
  const provider = getProvider();
  if (!provider) throw new Error("No browser wallet found.");

  const encArgs = (args as unknown[]).map((a) => {
    if (
      a === null || typeof a === "boolean" || typeof a === "number" ||
      typeof a === "bigint" || typeof a === "string" ||
      a instanceof Uint8Array || Array.isArray(a)
    ) return a as any;
    throw new Error(`unsupported arg type for consensus write: ${typeof a}`);
  });
  const prepared = await prepareConsensusWrite({
    provider,
    sender: account,
    recipient: requireAddress(),
    method,
    callArgs: encArgs,
    value: opts.value ?? 0n,
  });
  opts.onTrack?.({
    phase: "pre-sign", debug: prepared.debug,
    preSignText: formatConsensusPreSign(prepared.debug),
  });
  const approved = opts.onPreSign
    ? await opts.onPreSign(prepared.debug)
    : window.confirm(formatConsensusPreSign(prepared.debug));
  if (!approved) {
    throw new Error("Transaction cancelled at pre-sign review");
  }

  const txId: string = await provider.request({
    method: "eth_sendTransaction", params: [prepared.request],
  });
  opts.onTrack?.({ phase: "submitted", txId, debug: prepared.debug });
  const client: any = createClient({ chain: resolveChain() } as any);
  const poll = async (want: string) => {
    const deadline = Date.now() + 10 * 60 * 1000;
    for (;;) {
      const t: any = await client.getTransaction({ hash: txId });
      const name: string = t?.statusName ?? "";
      if (name === want || name === "FINALIZED") return t;
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${want}`);
      await new Promise((r) => setTimeout(r, 8000));
    }
  };
  const decided: any = await poll("DECIDED");
  opts.onTrack?.({ phase: "decided", ...decided });
  const full: any = await poll("FINALIZED");
  opts.onTrack?.({ phase: "finalized", ...full });
  const triggered = await fetchTriggered(txId).catch(() => []);
  return {
    txId, decided, finalized: full, successful: isSuccessful(full),
    executionResult: full?.txExecutionResultName ?? full?.result_name ?? full?.result,
    triggered, path: "consensus-wallet",
  };
}
