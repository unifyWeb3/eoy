/** Read-only fee simulation (no spend, no wallet, ephemeral account). */
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const address = process.env.SIM_ADDRESS;
if (!address) throw new Error("SIM_ADDRESS not set");
const client = createClient({ chain: studionet, account: createAccount() });
const big = (v) => (typeof v === "bigint" ? v.toString() : JSON.stringify(v));

const calls = [
  ["post_job", { functionName: "post_job", args: ["Measure fee task", "Spec ".repeat(30), "Criteria ".repeat(30), "url+hash+desc", Math.floor(Date.now() / 1000) + 7 * 86400], value: 1000000000000000n }],
  ["submit", { functionName: "submit", args: [0, "https://github.com/org/repo", "h", "m"] }],
  ["judge", { functionName: "judge", args: [0] }],
  ["release", { functionName: "release", args: [0] }],
  ["reclaim", { functionName: "reclaim", args: [0] }],
];
for (const [label, call] of calls) {
  try {
    const est = await client.estimateTransactionFeesForWrite({ address, ...call });
    console.log(`### ${label}`);
    console.log("distribution:", big(est.distribution));
    console.log("messageAllocations:", big(est.messageAllocations));
    console.log("feeValue:", big(est.feeValue));
    console.log("observed:", big(est.observed));
  } catch (e) {
    console.log(`### ${label} SIM_ERROR:`, String(e).slice(0, 300));
  }
}
console.log("SIM_DONE");
