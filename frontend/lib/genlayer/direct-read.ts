"use client";

import { toRlp, toHex, fromHex } from "viem";
import { RPC_URL, CONTRACT_ADDRESS } from "./client";

/**
 * Direct gen_call reads with the proven payload encoding.
 *
 * genlayer-js 2.0.0-rc.1 `readContract` serializes the `leaderOnly` flag in a
 * way Studionet rejects (`gen_call: execution failed / Missing or invalid
 * parameters` for every view, with or without account). The proven path —
 * used by the Python bundle for all proof reads — is RLP([calldata, 0x00])
 * with the consensus calldata codec below (mirrors genlayer_py 0.18
 * `abi/calldata`, byte-exact: get_status(0) yields
 * 0xdc9a1604617267730d01066d6574686f64546765745f73746174757300).
 * Reads are free; no fees involved. `from` is the zero address (proven).
 */

const TYPE_SPECIAL = 0;
const TYPE_PINT = 1;
const TYPE_NINT = 2;
const TYPE_BYTES = 3;
const TYPE_STR = 4;
const TYPE_ARR = 5;
const TYPE_MAP = 6;

export type Encodable =
  | null
  | boolean
  | number
  | bigint
  | string
  | Uint8Array
  | Encodable[]
  | { [k: string]: Encodable };

function writeUleb(out: number[], i: bigint): void {
  if (i === 0n) {
    out.push(0);
    return;
  }
  let n = i;
  while (n > 0n) {
    let cur = Number(n & 0x7fn);
    n >>= 7n;
    if (n > 0n) cur |= 0x80;
    out.push(cur);
  }
}

function encVal(out: number[], v: Encodable): void {
  if (v === null || v === undefined) {
    out.push(0);
    return;
  }
  if (v === true) {
    out.push(16);
    return;
  }
  if (v === false) {
    out.push(8);
    return;
  }
  if (typeof v === "number" || typeof v === "bigint") {
    const b = BigInt(v);
    if (b >= 0n) writeUleb(out, (b << 3n) | 1n);
    else writeUleb(out, (((-b - 1n) << 3n) | 2n));
    return;
  }
  if (typeof v === "string") {
    const bts = new TextEncoder().encode(v);
    writeUleb(out, (BigInt(bts.length) << 3n) | 4n);
    for (const b of bts) out.push(b);
    return;
  }
  if (v instanceof Uint8Array) {
    writeUleb(out, (BigInt(v.length) << 3n) | 3n);
    for (const b of v) out.push(b);
    return;
  }
  if (Array.isArray(v)) {
    writeUleb(out, (BigInt(v.length) << 3n) | 5n);
    for (const x of v) encVal(out, x);
    return;
  }
  const keys = Object.keys(v).sort();
  writeUleb(out, (BigInt(keys.length) << 3n) | 6n);
  for (const k of keys) {
    const kb = new TextEncoder().encode(k);
    writeUleb(out, BigInt(kb.length));
    for (const b of kb) out.push(b);
    encVal(out, (v as Record<string, Encodable>)[k]);
  }
}

/** RLP([calldata, 0x00]) payload for gen_call READS (proven via readContract path). */
export function payloadHex(method: string, args: Encodable[]): `0x${string}` {
  const call: Record<string, Encodable> = { method };
  if (args.length > 0) call.args = args;
  const out: number[] = [];
  encVal(out, call);
  return toRlp([toHex(new Uint8Array(out)), "0x00"]);
}

/** RLP([calldata, b'']) payload used inside the consensus addTransaction wrapper. */
export function payloadHexWrite(method: string, args: Encodable[]): `0x${string}` {
  const call: Record<string, Encodable> = { method };
  if (args.length > 0) call.args = args;
  const out: number[] = [];
  encVal(out, call);
  return toRlp([toHex(new Uint8Array(out)), "0x"]);
}

function decodeCalldata(hex: string): number | bigint | string {
  const clean = hex.startsWith("0x") ? hex : "0x" + hex;
  const mem = Array.from(fromHex(clean as `0x${string}`, "bytes"));
  let pos = 0;
  const readUleb = (): bigint => {
    let ret = 0n;
    let off = 0n;
    for (;;) {
      const m = BigInt(mem[pos++]);
      ret |= (m & 0x7fn) << off;
      off += 7n;
      if ((m & 0x80n) === 0n) break;
    }
    return ret;
  };
  const impl = (): number | bigint | string => {
    const code = readUleb();
    const typ = Number(code & 7n);
    if (typ === TYPE_SPECIAL) throw new Error("unexpected special in view result");
    const n = code >> 3n;
    if (typ === TYPE_PINT)
      return n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : n;
    if (typ === TYPE_NINT) {
      const v = -n - 1n;
      return v >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(v) : v;
    }
    if (typ === TYPE_STR)
      return new TextDecoder().decode(
        new Uint8Array(mem.slice(pos, (pos += Number(n))))
      );
    throw new Error(`unsupported view result type ${typ}`);
  };
  return impl();
}

/** Read-only view call with the proven encoding. Returns str or u256. */
export async function directGenCall(
  method: string,
  args: Encodable[] = []
): Promise<string | bigint | number> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "gen_call",
      params: [
        {
          type: "read",
          to: CONTRACT_ADDRESS,
          from: "0x0000000000000000000000000000000000000000",
          data: payloadHex(method, args),
          transaction_hash_variant: "latest-nonfinal",
        },
      ],
    }),
  });
  const j = await res.json();
  if (j.error) throw new Error(`gen_call ${method} failed: ${JSON.stringify(j.error).slice(0, 160)}`);
  return decodeCalldata(String(j.result));
}
