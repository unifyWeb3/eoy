# COMMIT-MAP — reconstruction ledger (not live history)

All commits below are a **disclosed reconstruction** of work evidenced by
file mtimes, Studionet proof logs, and deploy transactions dated 2026-09-18.
Each commit body cites its date source. Author/committer dates were set via
`GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` and are intentionally backdated; they
do **not** represent a live commit history.

Dates are non-monotonic on purpose: each stage carries its own earliest
verifiable evidence time (e.g. direct-test files predate the contract's last
edit at 15:51). See per-commit date sources.

## 1. feat: TaskEscrow contract

- Hash: `afc28fca5c010650b863145d6c5581093a650c45`
- Date: 2026-09-18 15:51:00 +0100
- Date source: stat mtime `contracts/task_escrow.py`
- Files: `contracts/task_escrow.py`
- Notes: post/submit/judge/reclaim/release, TreeMap job store, allowlist,
  comparative-prompt verdict, UNDETERMINED path.

## 2. test: direct-mock coverage

- Hash: `eac5a49dc5ed64d5b4d7c1fd52c669b78dbba26a`
- Date: 2026-09-18 14:18:53 +0100
- Date source: stat mtimes `tests/direct/test_task_escrow.py` 12:01,
  `test_judge.py` 14:17, `test_payouts.py` 14:18 (max of stage)
- Files: `tests/__init__.py`, `tests/direct/__init__.py`,
  `tests/direct/test_task_escrow.py`, `tests/direct/test_judge.py`,
  `tests/direct/test_payouts.py`
- Notes: mocked web/LLM; simulation only, never GenLayer proof; 27 passed.

## 3. test: Studio integration + bundle harness

- Hash: `100ba2caccbf3cd5bdfd85c77a927d26cd986803`
- Date: 2026-09-18 15:29:35 +0100
- Date source: stat mtimes `tests/integration/test_task_escrow.py` 15:29,
  `evm_fund.py` 15:35, `test_proof_bundle.py` 16:37 (earliest of stage)
- Files: `tests/integration/__init__.py`, `tests/integration/evm_fund.py`,
  `tests/integration/test_task_escrow.py`,
  `tests/integration/test_proof_bundle.py`
- Notes: FINALIZED waits, child-trace, balances; env-key-only funding.

## 4. feat: frontend + fee profile + env example + chain config

- Hash: `6798ebf36562cc2f2a62b1bc360062ab90fa0958`
- Date: 2026-09-18 15:15:40 +0100
- Date source: stat mtimes `gltest.config.yaml` 15:15,
  `lib/contracts/TaskEscrow.ts` 16:30, `app/page.tsx` 16:32,
  `lib/genlayer/client.ts` 18:46, `.env.example` 19:27,
  `fee-profile.json` 21:17 (earliest of stage)
- Files: `frontend/app/page.tsx`, `frontend/app/layout.tsx`,
  `frontend/app/globals.css`, `frontend/lib/contracts/TaskEscrow.ts`,
  `frontend/lib/genlayer/client.ts`, `frontend/fee-profile.json`,
  `frontend/.env.example`, `frontend/package.json`, `frontend/tsconfig.json`,
  `frontend/next.config.ts`, `frontend/README.md`,
  `frontend/scripts/measure-fees.mjs`, `frontend/scripts/sim-fees.mjs`,
  `frontend/public/favicon.svg`, `frontend/public/site.webmanifest`,
  `frontend/public/fonts/*`, `gltest.config.yaml`,
  `deploy/measure_fees.py`
- Notes: includes 2026-09-19 fixes — mounted hydration gate (page.tsx) and
  profile-derived direct-SDK fee fallback (TaskEscrow.ts); tsc + next build
  clean; SSR serves contract address with no wallet paragraph pre-mount.

## 5. chore: project config + LICENSE + product README

- Hash: `0284fb78d8112f77cd6301d07aff7a6a343649e8`
- Date: 2026-09-18 11:43:14 +0100
- Date source: stat mtimes `LICENSE`, `pyproject.toml`, `requirements.txt`
  (earliest of stage; README rewritten 2026-09-19)
- Files: `.gitignore`, `package.json`, `tsconfig.json`, `pyproject.toml`,
  `requirements.txt`, `LICENSE`, `README.md`
- Notes: removed pre-existing trailing blank line flagged by `diff --check`.

## 6. docs: COMMIT-MAP.md

- Hash: this commit (tip of the pushed branch; `git log -1 --format=%H`)
- Date: 2026-09-19 (new document)
- Files: `COMMIT-MAP.md`

## Excluded from push (stay local)

Research `*.md` (COMPETITION, EXISTING-PRODUCTS, FOUNDER-SIGNALS,
GENLAYER-INTELLIGENCE, OPPORTUNITY-MATRIX, CLAUDE), `HANDOFF.md`,
`proof/*.log`, `.env` files, `node_modules`, `.venv`, caches
(`.pytest_cache`, `__pycache__`), `artifacts`, npm logs, `*.Zone.Identifier`,
`contracts/football_bets.py`, `contracts/PatternTest.py`, football/pattern
tests, `frontend/.next`, `deploy/deployScript.ts` (football boilerplate),
`config/genlayer_config.py` (unused scaffold), `.github` (stale football CI),
`support/ci` (branch policy).
