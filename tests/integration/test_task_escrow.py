"""Integration tests on REAL GenLayer (Studio-dev first, then Studionet/Bradbury).

Run with: .venv/bin/gltest tests/integration/test_task_escrow.py -v -s --network studio-dev

Proof standard (REAL, not simulation): wait_for FINALIZED + tx_execution_succeeded
+ FINISHED_WITH_RETURN + child-transfer trace + balance change. Receipt or
`decided` alone is NOT accepted as proof.
"""

import json
import time

import pytest
from gltest import get_contract_factory, get_default_account
from gltest.helpers import load_fixture
from gltest.assertions import tx_execution_succeeded
from gltest.types import TransactionStatus

TITLE = "Build CSV parser CLI tool"
SPEC = (
    "Implement a Python CLI that parses CSV files with headers, validates required "
    "columns id,name,amount, outputs JSON to stdout, and exits non-zero on bad input."
)
CRITERIA = (
    "Must accept a file path arg, handle quoted commas, reject missing columns, "
    "print valid JSON array, and include --help text describing usage and options."
)
FMT = "public repo URL + commit hash + description"
URL = "https://github.com/org/repo/commit/abc123"
HASH = "abc123hash"
ESCROW_WEI = 1_000_000_000_000_000  # 0.001 GEN — small to conserve test funds


def _deadline(days=7):
    return int(time.time()) + days * 86400


@pytest.mark.integration
def deploy_task_escrow():
    from gltest.utils import extract_contract_address

    factory = get_contract_factory("TaskEscrow")
    receipt = factory.deploy_contract_tx(
        wait_transaction_status=TransactionStatus.FINALIZED,
    )
    print(f"\nDEPLOY_TX: {receipt.get('hash') or receipt.get('txId')}")
    assert tx_execution_succeeded(receipt)
    contract = factory.build_contract(
        contract_address=extract_contract_address(receipt)
    )
    assert contract.get_balance(args=[]).call() == 0
    return contract


@pytest.mark.integration
def test_post_submit_views_finalized():
    contract = load_fixture(deploy_task_escrow)
    print(f"\nCONTRACT_ADDRESS: {contract.address}")

    post_receipt = contract.post_job(
        args=[TITLE, SPEC, CRITERIA, FMT, _deadline()]
    ).transact(
        value=ESCROW_WEI,
        wait_transaction_status=TransactionStatus.FINALIZED,
    )
    print(f"POST_TX: {post_receipt.get('hash') or post_receipt.get('txId')}")
    assert tx_execution_succeeded(post_receipt)

    status = contract.get_status(args=[0]).call()
    assert status == "FUNDED"

    job = json.loads(contract.get_job(args=[0]).call())
    assert job["amount_wei"] == str(ESCROW_WEI)
    assert job["payer"].lower() == get_default_account().address.lower()

    submit_receipt = contract.submit(args=[0, URL, HASH, "CLI done"]).transact(
        wait_transaction_status=TransactionStatus.FINALIZED,
    )
    print(f"SUBMIT_TX: {submit_receipt.get('hash') or submit_receipt.get('txId')}")
    assert tx_execution_succeeded(submit_receipt)
    assert contract.get_status(args=[0]).call() == "SUBMITTED"
