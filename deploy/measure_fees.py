"""Measure fee budgets for frontend/fee-profile.json (Studionet, read-only sims).

Setup writes (deploy/post/submit on a fresh measurement contract) create the
states to simulate against. Budget numbers come ONLY from
estimate_transaction_fees_for_write simulations. Payer key is read from the
environment and never printed.

Usage: GENLAYER_PRIVATE_KEY=... .venv/bin/python deploy/measure_fees.py
"""

import json
import os
import time

from genlayer_py import create_client, create_account
from genlayer_py.chains import studionet
from genlayer_py.types import TransactionStatus
from eth_account import Account

ESCROW = 10**15  # 0.001 GEN
TITLE = "Measure fee task"
SPEC = (
    "Implement a Python CLI that parses CSV files with headers, validates required "
    "columns id,name,amount, outputs JSON to stdout, and exits non-zero on bad input. "
    "Handle quoted commas and missing columns with clear error messages."
)
CRITERIA = (
    "Delivery must define a Bet record with team and score fields, must expose "
    "create_bet and resolve_bet write methods, must expose get_bets, get_points "
    "and player-points views, and must fetch match results from web content."
)
FOOTBALL_URL = (
    "https://raw.githubusercontent.com/genlayerlabs/"
    "genlayer-project-boilerplate/main/contracts/football_bets.py"
)

J = lambda o: json.dumps(o, default=str)


def deadline(days=7):
    return int(time.time()) + days * 86400


def main():
    raw_key = os.environ.get("GENLAYER_PRIVATE_KEY", "").strip()
    if not raw_key:
        raise RuntimeError("GENLAYER_PRIVATE_KEY not set")
    payer = Account.from_key(raw_key)
    sim_acct = create_account()
    client = create_client(chain=studionet, account=payer)

    with open("contracts/task_escrow.py", "rb") as f:
        code = f.read()
    # NOTE: deploy path measurements are covered by method max below; the
    # deploy itself uses client-side estimation only.
    from gltest.utils import extract_contract_address  # noqa

    deploy_tx = client.deploy_contract(code=code, args=[])
    print("MEASURE_DEPLOY_TX:", deploy_tx, flush=True)
    deploy_rc = client.wait_for_transaction_receipt(
        transaction_hash=deploy_tx, status=TransactionStatus.FINALIZED, interval=5000, retries=60
    )
    addr = extract_contract_address(deploy_rc)
    print("MEASURE_ADDRESS:", addr, flush=True)

    def sim(label, fn, args, value=0):
        est = client.estimate_transaction_fees_for_write(
            address=addr, function_name=fn, account=sim_acct, args=args, value=value
        )
        print(f"### {label} SIM:", J(est), flush=True)
        return est

    def send(fn, args, value=0):
        est = client.estimate_transaction_fees_for_write(
            address=addr, function_name=fn, account=payer, args=args, value=value
        )
        tx = client.write_contract(
            address=addr,
            function_name=fn,
            account=payer,
            args=args,
            value=value,
            fees={"distribution": est["distribution"], "feeValue": est["feeValue"]},
        )
        print(f"{fn.upper()}_TX:", tx, flush=True)
        rc = client.wait_for_transaction_receipt(
            transaction_hash=tx, status=TransactionStatus.FINALIZED, interval=5000, retries=60
        )
        return tx, rc

    sim("post_job", "post_job", [TITLE, SPEC, CRITERIA, "url+hash+desc", deadline()], value=ESCROW)
    send("post_job", [TITLE, SPEC, CRITERIA, "url+hash+desc", deadline()], value=ESCROW)
    sim("submit", "submit", [0, FOOTBALL_URL, "h", "m"])
    send("submit", [0, FOOTBALL_URL, "h", "m"])
    # judge sim against SUBMITTED job (free); release/reclaim sims (revert-path here)
    sim("judge", "judge", [0])
    sim("release-revertpath", "release", [0])
    sim("reclaim-revertpath", "reclaim", [0])

    # Real judge -> decided state, then sim release/reclaim again, take max.
    jtx, _ = send("judge", [0])
    print("JUDGE_REAL_TX:", jtx, flush=True)
    sim("release-decided", "release", [0])
    sim("reclaim-decided", "reclaim", [0])
    print("DONE", addr, flush=True)


if __name__ == "__main__":
    main()
