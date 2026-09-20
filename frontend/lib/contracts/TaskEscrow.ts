"use client";

import { createClient, isSuccessful } from "genlayer-js";
import { createTransactionKit } from "@genlayer/transaction-kit";
import feeProfile from "../../fee-profile.json";
import {
  resolveChain,
  CONTRACT_ADDRESS,
  getProvider,
} from "../genlayer/client";
import { directGenCall, payloadHexWrite } from "../genlayer/direct-read";

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
    // --- Fallback: wallet-signed tx straight to the contract (proven path) ---
    // The SDK's consensus.addTransaction envelope is EVM-accepted on Studionet
    // but never scheduled for rounds (0 rounds, FINALIZED/NO_MAJORITY, no
    // state change — reproduced twice on frontend POSTs 0x8078…/0x09fc…).
    // The proven envelope (all Python-bundle writes, incl. job-7 POST
    // 0x0d0b…: MAJORITY_AGREE, rounds ran) is a plain EVM tx to the contract
    // address carrying RLP([calldata, b'']) with value = escrow (+0 fees).
    // The empty flag is load-bearing: the read flag 0x00 yields an ordinary
    // value transfer with zero rounds and no state change (see 0x6acf…).
    // Signing stays in the browser wallet; tracking polls getTransaction.
    const encArgs = (args as unknown[]).map((a) => {
      if (typeof a === "number" || typeof a === "bigint" || typeof a === "string") return a;
      throw new Error(`unsupported arg type for direct write: ${typeof a}`);
    });
    const data = payloadHexWrite(method, encArgs);
    const txId: string = await provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: account,
          to: address,
          data,
          value: "0x" + value.toString(16),
        },
      ],
    });
    opts.onTrack?.({ phase: "submitted", txId });
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
