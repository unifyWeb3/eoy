"""4-job REAL-net proof bundle (Studionet). One contract, four escrowed jobs.

Run: .venv/bin/gltest tests/integration/test_proof_bundle.py -v -s --network studionet
Long run (LLM consensus x4) — run in background and poll proof/bundle_studionet.log.

Resumable: set BUNDLE_CONTRACT=0x... to reuse a deployed contract and
BUNDLE_JOBS="1,2,3" to run only remaining job indices. Each step is skipped
when on-chain state shows it already finalized (checks status first).

Per job: inputs, decision tx, FINALIZED wait, tx_execution_succeeded,
payout/child trace, EOA + contract balances before/after.
"""

import json
import os
import time

import pytest
from gltest import (
    get_contract_factory,
    get_default_account,
    create_account,
    get_gl_client,
)
from gltest.helpers import load_fixture
from gltest.assertions import tx_execution_succeeded
from gltest.types import TransactionStatus

from tests.integration.evm_fund import fund_worker, get_balance_wei

STUDIONET_RPC = "https://studio.genlayer.com/api"
CHAIN_ID = 61999
ESCROW_WEI = 2_000_000_000_000_000  # 0.002 GEN per job
WORKER_FUND_WEI = 50_000_000_000_000_000  # 0.05 GEN for worker fees

FOOTBALL_URL = (
    "https://raw.githubusercontent.com/genlayerlabs/"
    "genlayer-project-boilerplate/main/contracts/football_bets.py"
)
MISSING_URL = (
    "https://raw.githubusercontent.com/genlayerlabs/"
    "genlayer-project-boilerplate/main/contracts/does_not_exist_xyz.py"
)
FMT = "public repo URL + commit hash + description"

JOBS = [
    {
        "name": "job1-pass",
        "title": "GenLayer football betting contract",
        "spec": (
            "Python GenLayer Intelligent Contract with a Bet dataclass holding id, "
            "teams, predicted winner, real winner and real score; create_bet storing "
            "bets per sender with a BBC resolution URL; resolve_bet settling through "
            "web consensus; plus get_bets, get_points and get_player_points views."
        ),
        "criteria": (
            "Delivery must define a Bet record with team and score fields, must expose "
            "create_bet and resolve_bet write methods, must expose get_bets, get_points "
            "and player-points views, and must fetch match results from web content "
            "returning a JSON verdict."
        ),
        "url": FOOTBALL_URL,
        "expect": "ACCEPTED",
    },
    {
        "name": "job2-structural",
        "title": "GenLayer football betting contract",
        "spec": (
            "Python GenLayer Intelligent Contract with a Bet dataclass holding id, "
            "teams, predicted winner, real winner and real score; create_bet storing "
            "bets per sender with a BBC resolution URL; resolve_bet settling through "
            "web consensus; plus get_bets, get_points and get_player_points views."
        ),
        "criteria": (
            "Delivery must define a Bet record with team and score fields, must expose "
            "create_bet and resolve_bet write methods, must expose get_bets, get_points "
            "and player-points views, and must fetch match results from web content "
            "returning a JSON verdict."
        ),
        "url": MISSING_URL,
        "expect": "REJECTED",
    },
    {
        "name": "job3-semantic-fail",
        "title": "Rust WebSocket server with JWT and Postgres",
        "spec": (
            "Implement a Rust WebSocket server using tokio-tungstenite with JWT bearer "
            "authentication on handshake, Postgres persistence via sqlx including "
            "migrations, a Prometheus metrics endpoint, and graceful shutdown handling "
            "on SIGTERM."
        ),
        "criteria": (
            "Delivery must be written in Rust, must implement WebSocket handling with "
            "tokio-tungstenite, must authenticate handshakes with JWT, must persist to "
            "Postgres via sqlx, and must expose Prometheus metrics for connections."
        ),
        "url": FOOTBALL_URL,
        "expect": "REJECTED",
    },
    {
        "name": "job4-ambiguous",
        "title": "Evaluate overall code quality impression",
        "spec": (
            "Review the delivered source file and form an overall impression of its "
            "engineering quality, considering readability, structure, naming, error "
            "handling, documentation, testing signals, and fitness for its apparent "
            "purpose in context."
        ),
        "criteria": (
            "The delivery should reflect craftsmanship placing it among the very best "
            "programs ever written in its language, where only truly exceptional and "
            "nearly flawless work can pass and anything ordinary or merely adequate "
            "must fail."
        ),
        "url": FOOTBALL_URL,
        "expect": "ANY",
    },
]


def _deadline(days=7):
    return int(time.time()) + days * 86400


def _tolerant_finalized(client, tx_hash, tries=120, interval_ms=15000):
    """Poll to FINALIZED, tolerating transient transport (DNS/SSL) failures."""
    last = None
    for n in range(tries):
        try:
            last = client.wait_for_transaction_receipt(
                transaction_hash=tx_hash,
                status=TransactionStatus.FINALIZED,
                interval=interval_ms,
                retries=1,
            )
            return last
        except Exception as e:
            print(f"POLL_RETRY {n}: {str(e)[:140]}")
            time.sleep(interval_ms / 1000)
    raise RuntimeError(f"tx {tx_hash} not finalized after {tries} polls")


@pytest.mark.integration
def deploy_bundle_contract():
    from gltest.utils import extract_contract_address

    factory = get_contract_factory("TaskEscrow")
    receipt = factory.deploy_contract_tx(
        wait_transaction_status=TransactionStatus.FINALIZED,
    )
    print(f"\nDEPLOY_TX: {receipt.get('hash') or receipt.get('txId')}")
    assert tx_execution_succeeded(receipt)
    return factory.build_contract(
        contract_address=extract_contract_address(receipt)
    )


@pytest.mark.integration
def test_proof_bundle_4jobs():
    resume_addr = os.environ.get("BUNDLE_CONTRACT", "")
    only = os.environ.get("BUNDLE_JOBS", "")
    wanted = [int(x) for x in only.split(",") if x.strip() != ""] or [0, 1, 2, 3]
    if resume_addr:
        factory = get_contract_factory("TaskEscrow")
        contract = factory.build_contract(contract_address=resume_addr)
        print(f"\nRESUMED CONTRACT: {resume_addr}")
    else:
        contract = load_fixture(deploy_bundle_contract)
    payer = get_default_account()
    worker = create_account()
    print(f"CONTRACT_ADDRESS: {contract.address}")
    print(f"PAYER: {payer.address}")
    print(f"WORKER: {worker.address}")

    fund_tx = fund_worker(worker.address, WORKER_FUND_WEI, STUDIONET_RPC, CHAIN_ID)
    print(f"WORKER_FUND_TX: {fund_tx}")
    worker_contract = contract.connect(worker)

    for i in wanted:
        spec = JOBS[i]
        print(f"--- {spec['name']} (job {i}) ---")
        bal_payer_before = get_balance_wei(STUDIONET_RPC, payer.address)
        bal_worker_before = get_balance_wei(STUDIONET_RPC, worker.address)
        bal_contract_before = contract.get_balance(args=[]).call()
        print(f"BAL_BEFORE payer={bal_payer_before} worker={bal_worker_before} "
              f"contract={bal_contract_before}")

        try:
            cur = contract.get_status(args=[i]).call()
        except Exception:
            cur = "MISSING"
        print(f"ONCHAIN_BEFORE: {cur}")
        if cur == "MISSING":
            post_receipt = contract.post_job(
                args=[spec["title"], spec["spec"], spec["criteria"], FMT, _deadline()]
            ).transact(
                value=ESCROW_WEI,
                wait_transaction_status=TransactionStatus.FINALIZED,
            )
            print(f"POST_TX: {post_receipt.get('hash') or post_receipt.get('txId')}")
            assert tx_execution_succeeded(post_receipt)
            cur = "FUNDED"
        else:
            print("POST_TX: skipped (job exists)")

        if cur == "FUNDED":
            submit_receipt = worker_contract.submit(
                args=[i, spec["url"], "sha256:fetched-offchain", spec["name"]]
            ).transact(
                wait_transaction_status=TransactionStatus.FINALIZED,
            )
            print(f"SUBMIT_TX: {submit_receipt.get('hash') or submit_receipt.get('txId')}")
            assert tx_execution_succeeded(submit_receipt)
            cur = "SUBMITTED"
        else:
            print("SUBMIT_TX: skipped (already submitted/decided)")

        if cur == "SUBMITTED":
            client = get_gl_client()
            judge_hash = client.write_contract(
                address=contract.address,
                function_name="judge",
                account=contract.account or payer,
                args=[i],
            )
            print(f"JUDGE_TX: {judge_hash}")
            judge_receipt = _tolerant_finalized(client, judge_hash)
            assert tx_execution_succeeded(judge_receipt)
            try:
                triggered = client.get_triggered_transaction_ids(
                    transaction_hash=judge_hash
                )
            except Exception as e:
                print(f"TRIGGERED_RETRY: {str(e)[:140]}")
                triggered = []
            print(f"TRIGGERED: {triggered}")
            for child in triggered or []:
                try:
                    _tolerant_finalized(client, child, tries=40)
                    print(f"CHILD_FINALIZED: {child}")
                except Exception as e:
                    print(f"CHILD_PENDING: {child} {str(e)[:120]}")
        else:
            print("JUDGE_TX: skipped (already decided)")

        status = contract.get_status(args=[i]).call()
        job = json.loads(contract.get_job(args=[i]).call())
        print(f"STATUS: {status} VERDICT: {job['verdict']} "
              f"REASONING: {job['reasoning'][:200]} PAID: {job['paid']}")

        bal_payer_after = get_balance_wei(STUDIONET_RPC, payer.address)
        bal_worker_after = get_balance_wei(STUDIONET_RPC, worker.address)
        bal_contract_after = contract.get_balance(args=[]).call()
        print(f"BAL_AFTER payer={bal_payer_after} worker={bal_worker_after} "
              f"contract={bal_contract_after}")

        if spec["expect"] != "ANY":
            assert status == spec["expect"], (
                f"{spec['name']}: expected {spec['expect']}, got {status}"
            )
        else:
            assert status in ("ACCEPTED", "REJECTED", "UNDETERMINED")
