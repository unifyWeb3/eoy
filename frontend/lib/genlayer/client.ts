"use client";

import { createClient, isSuccessful } from "genlayer-js";
import * as chains from "genlayer-js/chains";

export { isSuccessful };

export const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "61999");
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://studio.genlayer.com/api";
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

/** Resolve the v2 chain definition. Studionet by default; Studio-dev (61997) when configured. */
export function resolveChain(): any {
  const c: any = chains as any;
  if (CHAIN_ID === 61997) {
    return c.studioDevnet ?? c.studionet;
  }
  if (CHAIN_ID === 4221) {
    return c.testnetBradbury ?? c.bradbury ?? c.studionet;
  }
  return c.studionet;
}

export function getExplorerTxUrl(txHash: string): string {
  const base = process.env.NEXT_PUBLIC_EXPLORER_URL || "";
  if (!base) return "";
  return `${base.replace(/\/$/, "")}/tx/${txHash}`;
}

export function getStudioUrl(): string {
  return process.env.NEXT_PUBLIC_STUDIO_URL || "https://studio.genlayer.com";
}

interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
}

/** EIP-1193 provider from the browser wallet (MetaMask or compatible). */
export function getProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return ((window as any).ethereum as EthereumProvider) ?? null;
}

export async function connectWallet(): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new Error("No browser wallet found. Install MetaMask.");
  const accounts: string[] = await provider.request({
    method: "eth_requestAccounts",
  });
  if (!accounts || accounts.length === 0) throw new Error("No accounts found.");
  return accounts[0];
}

/** Read-only client (no account). */
export function readOnlyClient(): any {
  return createClient({ chain: resolveChain() } as any);
}

/** Wallet client for writes. Never handles private keys — signing stays in the wallet. */
export function walletClient(account: string, provider?: any): any {
  return createClient({
    chain: resolveChain(),
    account: account as `0x${string}`,
    ...(provider ? { provider } : {}),
  } as any);
}
