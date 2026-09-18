# Agent Task Escrow with GenLayer Adjudication

One GenLayer Intelligent Contract holds real GEN, judges code delivery
against a rubric, and moves funds payer → worker automatically.

- Contract: `contracts/task_escrow.py` (TaskEscrow)
- Deployed: Studionet (chain 61999, `https://studio.genlayer.com/api`)
  at `0x97273c1D932dA1a79e3f414bCd33489B00c0eA5A`
  (see `frontend/.env.example`)
- Demo vertical: **code task** — public repo URL + commit hash + description.

## How it works

```
Payer (browser wallet)
  | post_job() payable (escrow GEN; fees estimated separately)
  v
TaskEscrow IC (GenLayer, Python, TreeMap storage, balance holds GEN)
  | submit() from worker, judge() from anyone
  | deterministic gate -> nondet web.get + exec_prompt -> prompt_comparative
  | PASS: payout to worker on finalized / FAIL/expired: reclaim to payer
  v
Frontend (Next.js 15, genlayer-js v2 RC, Transaction Kit + fee-profile.json)
  reads: get_job/get_status/get_balance via readContract
  writes: post_job/submit/judge/reclaim/release + waitForFinalization
  tracks: decided vs finalized separately, isSuccessful, child payout txs
```

State machine: FUNDED → SUBMITTED → ACCEPTED / REJECTED / UNDETERMINED →
RESOLVED / REFUNDED. `release`/`reclaim` are idempotent; double-spend is
guarded by status transition before payout. Past-deadline non-accepted jobs
can be reclaimed by the payer.

## Project structure

```
contracts/task_escrow.py        # the Intelligent Contract
tests/direct/                   # fast in-memory tests (mocked web/LLM, simulation only)
tests/integration/              # real-net tests (Studio consensus + proof bundle)
deploy/measure_fees.py          # fee measurement helper (env key only, never printed)
frontend/                       # Next.js 15 app (page + contract lib + fee profile)
gltest.config.yaml              # test-runner networks (accounts from env only)
```

## Quick start

```shell
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

```shell
genvm-lint check contracts/task_escrow.py  # after every contract change
pytest tests/direct/ -v                    # simulation only, never GenLayer proof
```

```shell
gltest tests/integration/ -v -s --network studionet  # real consensus (needs funds)
```

```shell
cp frontend/.env.example frontend/.env
cd frontend && npm install && npm run dev   # http://localhost:3000
```

## Frontend flows

- Post a job with GEN escrow (payable: escrow value and protocol fees are
  estimated and submitted separately, never hardcoded).
- Submit a delivery (worker), judge via validator consensus (minutes),
  reclaim (payer, after reject/expiry) or release (accepted payout).
- Every write shows **decided vs finalized** separately plus `isSuccessful` /
  execution result and child payout txs. A receipt or `decided` alone is never
  treated as proof.

## Fees

`frontend/fee-profile.json` holds the measured fee suggestions (no hardcoded
fees). Studionet exposes no fee-estimation endpoint, so entries use the proven
zero-deposit distribution (deploys + writes reaching FINALIZED with execution
success on Studionet). The app quotes via Transaction Kit with the profile as
suggestions, falling back to profile-derived fees on the direct-SDK path.

## Verification standard

Acceptance requires REAL proof: deployed address + network +
`waitForFinalization` + `isSuccessful()` + `FINISHED_WITH_RETURN` +
child-transfer trace + balance change. EVM receipt or `decided` alone fails.

## License

MIT — see [LICENSE](LICENSE).
