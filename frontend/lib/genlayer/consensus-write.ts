"use client";

import { Interface, getAddress, isAddress } from "ethers";
import { payloadHexWrite, type Encodable } from "./direct-read";
import { RPC_URL } from "./client";

const CONSENSUS_ABI = [
  "function addTransaction(address _sender, address _recipient, uint256 _numOfInitialValidators, uint256 _maxRotations, bytes _txData)",
] as const;
const CONSENSUS_SIGNATURE =
  "addTransaction(address,address,uint256,uint256,bytes)";
const CONSENSUS_SELECTOR = "0x27241a99";
const DEFAULT_INITIAL_VALIDATORS = 5n;
const DEFAULT_MAX_ROTATIONS = 3n;

export interface ConsensusPreSignDebug {
  chainId: string;
  intakeAddress: string;
  outerSelector: string;
  outerData: `0x${string}`;
  sender: string;
  recipient: string;
  initialValidators: string;
  maxRotations: string;
  txData: `0x${string}`;
  value: `0x${string}`;
}

export interface ConsensusTransactionRequest {
  from: string;
  to: string;
  data: `0x${string}`;
  value: `0x${string}`;
}

export interface PreparedConsensusWrite {
  request: ConsensusTransactionRequest;
  debug: ConsensusPreSignDebug;
}

interface RpcResponse<T> {
  result?: T;
  error?: { message?: string };
}

interface ConsensusConfig {
  address: string;
  abi: Array<{
    type?: string;
    name?: string;
    inputs?: Array<{ type?: string }>;
  }>;
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method} HTTP ${response.status}`);
  const body = (await response.json()) as RpcResponse<T>;
  if (body.error) throw new Error(`${method}: ${body.error.message ?? "RPC error"}`);
  if (body.result === undefined) throw new Error(`${method}: missing result`);
  return body.result;
}

function validateConsensusConfig(config: ConsensusConfig): string {
  if (!isAddress(config.address)) {
    throw new Error("Studio returned an invalid ConsensusMain address");
  }
  const fn = config.abi?.find(
    (item) => item.type === "function" && item.name === "addTransaction",
  );
  const types = fn?.inputs?.map((input) => input.type);
  const expected = ["address", "address", "uint256", "uint256", "bytes"];
  if (!types || types.length !== expected.length || types.some((t, i) => t !== expected[i])) {
    throw new Error(
      "Active ConsensusMain ABI is not the proven five-argument addTransaction ABI",
    );
  }
  return getAddress(config.address);
}

/** Read-only resolution of the active Studio consensus intake configuration. */
export async function resolveConsensusIntake(): Promise<{
  address: string;
  signature: string;
  selector: string;
}> {
  const config = await rpc<ConsensusConfig>("sim_getConsensusContract", ["ConsensusMain"]);
  const address = validateConsensusConfig(config);
  return { address, signature: CONSENSUS_SIGNATURE, selector: CONSENSUS_SELECTOR };
}

/** Build the GenLayer outer transaction without signing or broadcasting. */
export async function prepareConsensusWrite(args: {
  provider: { request: (input: { method: string; params?: unknown[] }) => Promise<unknown> };
  sender: string;
  recipient: string;
  method: string;
  callArgs: Encodable[];
  value: bigint;
  initialValidators?: bigint;
  maxRotations?: bigint;
}): Promise<PreparedConsensusWrite> {
  if (!isAddress(args.sender) || !isAddress(args.recipient)) {
    throw new Error("Consensus write requires valid sender and recipient addresses");
  }
  const sender = getAddress(args.sender);
  const recipient = getAddress(args.recipient);
  const initialValidators = args.initialValidators ?? DEFAULT_INITIAL_VALIDATORS;
  const maxRotations = args.maxRotations ?? DEFAULT_MAX_ROTATIONS;
  if (args.value < 0n) throw new Error("Transaction value cannot be negative");

  const [intake, chainId] = await Promise.all([
    resolveConsensusIntake(),
    args.provider.request({ method: "eth_chainId" }) as Promise<string>,
  ]);
  if (chainId.toLowerCase() !== "0xf22f") {
    throw new Error(`Wallet is on ${chainId}; expected Studionet chain 0xf22f`);
  }

  // Python rlp.encode([calldata, False]) is RLP([calldata, 0x80]).
  // The normalized GenLayer record may display the false flag as 0x00, but
  // job 7's stored signed outer transaction contains this 0x80 payload.
  const txData = payloadHexWrite(args.method, args.callArgs);
  const iface = new Interface(CONSENSUS_ABI);
  const outerData = iface.encodeFunctionData("addTransaction", [
    sender,
    recipient,
    initialValidators,
    maxRotations,
    txData,
  ]) as `0x${string}`;
  if (outerData.slice(0, 10).toLowerCase() !== CONSENSUS_SELECTOR) {
    throw new Error("Consensus selector does not match the proven job-7 selector");
  }

  const request: ConsensusTransactionRequest = {
    from: sender,
    to: intake.address,
    data: outerData,
    value: `0x${args.value.toString(16)}`,
  };
  return {
    request,
    debug: {
      chainId,
      intakeAddress: intake.address,
      outerSelector: outerData.slice(0, 10),
      outerData,
      sender,
      recipient,
      initialValidators: initialValidators.toString(),
      maxRotations: maxRotations.toString(),
      txData,
      value: request.value,
    },
  };
}

export function formatConsensusPreSign(debug: ConsensusPreSignDebug): string {
  return [
    "GenLayer pre-sign review",
    `chainId: ${debug.chainId}`,
    `outer to: ${debug.intakeAddress}`,
    `outer selector: ${debug.outerSelector}`,
    `embedded sender: ${debug.sender}`,
    `embedded recipient: ${debug.recipient}`,
    `validators: ${debug.initialValidators}`,
    `max rotations: ${debug.maxRotations}`,
    `value: ${debug.value}`,
    `embedded txData: ${debug.txData}`,
    `outer data: ${debug.outerData}`,
  ].join("\n");
}

export { CONSENSUS_ABI, CONSENSUS_SIGNATURE, CONSENSUS_SELECTOR };
