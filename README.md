# EOY

EOY is an acceptance and settlement rail for work: a payer locks payment against written criteria, a worker submits evidence, and the finalized outcome controls settlement.

Escrow that can read. Deterministic checks reject obvious failures first. GenLayer validators evaluate the remaining evidence against the same acceptance criteria.

## Key links

- [Live app](https://eoyy.vercel.app)
- [Launch workflow](https://eoyy.vercel.app/app)
- [GitHub repository](https://github.com/unifyWeb3/eoy)
- Contract: `TaskEscrow` at `0x97273c1D932dA1a79e3f414bCd33489B00c0eA5A` on [GenLayer Studionet](https://studio.genlayer.com), chain `61999`
- [Canonical proof source](frontend/lib/proof.ts)

## The problem

Work and payment systems can lock funds, but they still need a reliable way to decide whether a delivery is complete. That decision often depends on offchain evidence and written requirements, not only on signatures or balances.

EOY turns that acceptance decision into an onchain state that a payment system can inspect and act on. It is designed as an acceptance layer for bounty systems, agent marketplaces, grant systems, and other work/payment systems.

## How EOY works

1. A payer defines the work, writes acceptance criteria, and locks GEN in the contract.
2. A worker submits a delivery URL, content hash, and description.
3. Deterministic checks reject obvious failures such as invalid delivery URLs, missing hashes, and expired submissions.
4. GenLayer validators evaluate the remaining evidence against the criteria.
5. A finalized pass pays the worker. A rejection, undetermined result, or expired job can be reclaimed by the payer.

The contract records `FUNDED`, `SUBMITTED`, `ACCEPTED`, `REJECTED`, and `UNDETERMINED` states. A passing judge writes `ACCEPTED`, marks the job paid, and creates the worker payout transfer.

## Why GenLayer

Ordinary smart contracts can verify deterministic conditions such as signatures, balances, deadlines, and hashes.

EOY needs to answer a different question:

> Did this submitted work actually satisfy the written acceptance criteria?

That question requires evaluating offchain evidence against a rubric. The contract fetches the submitted content, asks validators to evaluate it, and records the resulting verdict. The consensus-backed result then controls settlement.

## Canonical live proof: Job 8

Job 8 is the primary live proof on Studionet. It was created through the browser wallet flow and reached the following verified state:

| Field | Result |
|---|---|
| Job | `8` |
| Resulting job state | `ACCEPTED` |
| Verdict | `pass` |
| Paid | `true` |
| Escrow | `0.002 GEN` |
| Payer | `0x3211…88d3` |
| Worker | `0x3211…88d3` |

### Consensus, execution, and settlement

- Consensus: `MAJORITY_AGREE`, 3 agree / 2 idle
- Resulting job state: `ACCEPTED`
- Verdict: `pass`
- Paid: `true`
- Settlement: child transfer of `0.002 GEN` to the worker

`MAJORITY_AGREE` is the consensus result. It is not, by itself, proof of successful execution. The production app checks finalized status, execution success, and the resulting state separately.

### Transaction references

| Step | Transaction hash |
|---|---|
| POST | `0xe7507dd23d7b21e942715d38b117d22233bc8e36669ad4412bc3526fa2f24fc7` |
| SUBMIT | `0x23570053478194f666d7a8ceff3f05bf40caf19fb89aa4f0fd4da57afc1ce36b` |
| JUDGE | `0xacba8452e5482ae160af0448d22b7f392a0f6d94f4b83f540902af9c639909f1` |
| PAYOUT | `0x3b3e356c98ed6ae9fd6a996984f06b0b183c40327aedf313939f3cc3abda324c` |

The POST, SUBMIT, and JUDGE records are finalized consensus transactions. The PAYOUT record is a finalized native child transfer triggered by JUDGE. Its zero-round `NO_MAJORITY` label describes the child transfer record, not a failed Judge execution.

## Architecture

```text
Payer browser wallet
        |
        | post_job() with escrow
        v
TaskEscrow Intelligent Contract
        |
        | submit evidence
        | deterministic checks
        | GenLayer evidence evaluation
        v
Finalized acceptance state
        |
        +--> accepted: pay worker
        +--> rejected, undetermined, or expired: payer can reclaim
```

The contract is [contracts/task_escrow.py](contracts/task_escrow.py). It stores job records, reads allowlisted delivery URLs during judgment, and uses comparative prompt evaluation for the subjective part of acceptance. The frontend is in [frontend](frontend/), with separate tracking for decided and finalized transaction states.

## What is verified today

- A live browser-wallet flow on GenLayer Studionet can create a job, submit evidence, judge it, and pay the worker.
- Job 8 reached `ACCEPTED`, `pass`, and `paid: true` with a `0.002 GEN` child payout.
- The frontend displays decided and finalized states separately and checks `isSuccessful` and `FINISHED_WITH_RETURN` before treating a write as successful.
- The contract has deterministic rejection checks, consensus-backed acceptance, rejection handling, undetermined handling, expiry reclaim, and payout guards.
- Direct tests cover contract behavior with mocked web and LLM calls. They are simulation tests, not live GenLayer proof.

## Limitations and known testnet artifacts

- Studionet test GEN only. The funds have no real-world value.
- The live `UNDETERMINED` path has not yet been proven on a live network. Its contract and simulation-test paths exist.
- The raw contract balance is `0.014 GEN`.
- The application-accounted balance is `0.010 GEN`.
- `0.004 GEN` is stranded from malformed historical frontend test writes. It is not active escrow.
- The current contract has no recovery path for the stranded amount.
- Rejected, undetermined, and expired jobs require a payer reclaim transaction. They are not automatic refunds.

## Local setup

Create a Python environment and install the contract and test dependencies:

```shell
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run the linter and simulation tests:

```shell
genvm-lint check contracts/task_escrow.py
pytest tests/direct/ -v
```

Run the frontend from the repository root:

```shell
npm install
cp frontend/.env.example frontend/.env
npm run dev
```

The local app runs at `http://localhost:3000`. Live integration tests use Studionet, require a funded test account, and perform real network writes:

```shell
gltest tests/integration/ -v -s --network studionet
```

## Repository structure

```text
contracts/task_escrow.py        # GenLayer Intelligent Contract
frontend/                       # Next.js app and transaction tracking
frontend/lib/proof.ts           # canonical Job 8 proof values
frontend/fee-profile.json       # Studionet fee suggestions
tests/direct/                   # mocked, in-memory contract tests
tests/integration/              # real-network integration tests
deploy/measure_fees.py          # fee measurement helper
gltest.config.yaml              # test network configuration
```

## Evidence reference

The canonical Job 8 values are maintained in [frontend/lib/proof.ts](frontend/lib/proof.ts). The live UI presents the same receipt at [eoyy.vercel.app](https://eoyy.vercel.app). Use the transaction hashes above with GenLayer Studionet to inspect the lifecycle and child payout.

The local `proof/` logs are supplementary historical artifacts. They are not the canonical Job 8 proof bundle.

## License

MIT. See [LICENSE](LICENSE).
