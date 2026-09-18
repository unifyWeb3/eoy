# Task Escrow Frontend

Next.js app for the GenLayer agent task escrow (contracts/task_escrow.py).

## Setup

```bash
npm install        # run from repo root (npm workspaces)
cp frontend/.env.example frontend/.env
```

Configure `frontend/.env`:

- `NEXT_PUBLIC_CONTRACT_ADDRESS` — deployed TaskEscrow address
- `NEXT_PUBLIC_CHAIN_ID` — 61999 (Studionet)
- `NEXT_PUBLIC_RPC_URL` — https://studio.genlayer.com/api

## Run

```bash
npm run dev    # from repo root (runs frontend dev server)
npm run build  # typecheck + production build
```

## Flows

- Post a job with GEN escrow (payable: escrow value and protocol fees are
  estimated and submitted separately, never hardcoded).
- Submit a delivery (worker), judge via validator consensus, reclaim (payer)
  or release (accepted payout).
- Every write shows decided vs finalized status separately plus
  `isSuccessful` / execution result and child payout txs. A GenLayer receipt
  or `decided` state alone is never treated as proof.

## Stack

- Next.js 15, React 19, TypeScript
- genlayer-js 2.0.0-rc.1 + @genlayer/transaction-kit(-react) 0.1.0-rc.2
- frontend/fee-profile.json — measured fee suggestions (no hardcoded fees)
