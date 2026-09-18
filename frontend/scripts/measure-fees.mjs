/** Measure fee budgets for fee-profile.json via Studio simulations (read-only sims).
 *
 * Real writes (deploy/post/submit) set up measurement state; all budget
 * numbers come from sim_estimate/gen_call simulations, never guessed.
 * Usage: GENLAYER_PRIVATE_KEY=... node scripts/measure-fees.mjs
 * Key is read from env only, never printed.
 */
import { readFileSync } from "node:fs";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { privateKeyToAccount } from "viem/accounts";

const ESCROW = 1000000000000000n; // 0.001 GEN

const TITLE = "Measure fee task";
const SPEC =
  "Implement a Python CLI that parses CSV files with headers, validates required " +
  "columns id,name,amount, outputs JSON to stdout, and exits non-zero on bad input. " +
  "Handle quoted commas and missing columns with clear error messages.";
const CRITERIA_PASS =
  "Delivery must define a Bet record with team and score fields, must expose " +
  "create_bet and resolve_bet write methods, must expose get_bets, get_points " +
  "and player-points views, and must fetch match results from web content.";
const FOOTBALL_URL =
  "https://raw.githubusercontent.com/genlayerlabs/genlayer-project-boilerplate/main/contracts/football_bets.py";

const deadline = () => Math.floor(Date.now() / 1000) + 7 * 86400;
const show = (label, est) => {
  const big = (v) => (typeof v === "bigint" ? v.toString() : JSON.stringify(v));
  console.log(`### ${label}`);
  console.log("distribution:", big(est.distribution));
  console.log("messageAllocations:", big(est.messageAllocations));
  console.log("feeValue:", big(est.feeValue));
  console.log("observed:", big(est.observed));
};

const key = (process.env.GENLAYER_PRIVATE_KEY || "").trim();
if (!key) throw new Error("GENLAYER_PRIVATE_KEY not set");
const payer = privateKeyToAccount(key);
const client = createClient({ chain: studionet, account: payer });

const code = new Uint8Array(
  readFileSync(new URL("../../contracts/task_escrow.py", import.meta.url))
);
let tx = await client.deployContract({ code, args: [] });
console.log("MEASURE_DEPLOY_TX:", tx);
let final = await client.waitForFinalization({ hash: tx });
console.log("deploy finalized:", final.statusName, final.txExecutionResultName);
const address = final.recipient ?? final.toAddress ?? final.contractAddress;
console.log("MEASURE_ADDRESS:", address);

const withFees = async (call) => {
  const est = await client.estimateTransactionFeesForWrite(call);
  show(call.functionName, est);
  return {
    ...call,
    fees: { distribution: est.distribution, feeValue: est.feeValue },
  };
};

// post job 0 (pass rubric), then submit it
let call = await withFees({
  address,
  functionName: "post_job",
  args: [TITLE, SPEC, CRITERIA_PASS, "url+hash+desc", deadline()],
  value: ESCROW,
});
tx = await client.writeContract(call);
console.log("POST_TX:", tx);
await client.waitForFinalization({ hash: tx });

call = await withFees({
  address,
  functionName: "submit",
  args: [0, FOOTBALL_URL, "h", "m"],
});
tx = await client.writeContract(call);
console.log("SUBMIT_TX:", tx);
await client.waitForFinalization({ hash: tx });

// judge sim against SUBMITTED job 0 (free simulation, no spend)
await withFees({ address, functionName: "judge", args: [0] });

// release/reclaim sims (state-dependent; record outcome, do not fail run)
for (const m of ["release", "reclaim"]) {
  try {
    await withFees({ address, functionName: m, args: [0] });
  } catch (e) {
    console.log(`### ${m} SIM_ERROR:`, String(e).slice(0, 200));
  }
}
console.log("DONE. Address:", address);
