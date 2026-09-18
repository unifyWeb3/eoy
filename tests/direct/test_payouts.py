"""Direct tests for reclaim()/release() (simulation only)."""
import json
from datetime import datetime, timezone

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
ESCROW = 500_000_000_000_000_000
URL = "https://github.com/org/repo/commit/abc123"


def _deadline(days=7):
    return int(datetime.now(timezone.utc).timestamp()) + days * 86400


def _post_submit_judge_fail(contract, vm, alice, bob):
    vm.sender = alice
    vm.value = ESCROW
    jid = contract.post_job(TITLE, SPEC, CRITERIA, FMT, _deadline())
    vm.value = 0
    vm.sender = bob
    contract.submit(jid, URL, "abc123hash", "CLI done")
    vm.mock_web(
        r".*github\.com/org/repo.*", {"status": 200, "body": "print('wrong program')"}
    )
    vm.mock_llm(
        r".*judge a code-task.*",
        json.dumps({"verdict": "fail", "reasoning": "Does not implement CSV parsing."}),
    )
    vm.sender = alice
    contract.judge(jid)
    assert contract.get_status(jid) == "REJECTED"
    return jid


def _post_submit_judge_pass(contract, vm, alice, bob):
    vm.sender = alice
    vm.value = ESCROW
    jid = contract.post_job(TITLE, SPEC, CRITERIA, FMT, _deadline())
    vm.value = 0
    vm.sender = bob
    contract.submit(jid, URL, "abc123hash", "CLI done")
    vm.mock_web(
        r".*github\.com/org/repo.*",
        {"status": 200, "body": "def parse_csv(path): return []"},
    )
    vm.mock_llm(
        r".*judge a code-task.*",
        json.dumps({"verdict": "pass", "reasoning": "Meets all rubric criteria."}),
    )
    vm.sender = alice
    contract.judge(jid)
    assert contract.get_status(jid) == "ACCEPTED"
    return jid


def test_reclaim_after_reject(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/task_escrow.py")
    jid = _post_submit_judge_fail(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    contract.reclaim(jid)
    assert contract.get_status(jid) == "REFUNDED"


def test_reclaim_idempotent(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/task_escrow.py")
    jid = _post_submit_judge_fail(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    contract.reclaim(jid)
    contract.reclaim(jid)
    assert contract.get_status(jid) == "REFUNDED"


def test_reclaim_non_payer_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/task_escrow.py")
    jid = _post_submit_judge_fail(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only payer can reclaim"):
        contract.reclaim(jid)


def test_reclaim_before_deadline_reverts(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/task_escrow.py")
    direct_vm.sender = direct_alice
    direct_vm.value = ESCROW
    jid = contract.post_job(TITLE, SPEC, CRITERIA, FMT, _deadline(days=7))
    direct_vm.value = 0
    with direct_vm.expect_revert("Deadline not passed"):
        contract.reclaim(jid)


def test_reclaim_accepted_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/task_escrow.py")
    jid = _post_submit_judge_pass(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Use release for accepted jobs"):
        contract.reclaim(jid)


def test_release_after_accept_no_double_pay(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/task_escrow.py")
    jid = _post_submit_judge_pass(contract, direct_vm, direct_alice, direct_bob)
    job_before = json.loads(contract.get_job(jid))
    assert job_before["paid"] is True
    direct_vm.sender = direct_bob
    contract.release(jid)
    assert contract.get_status(jid) == "RESOLVED"
    contract.release(jid)
    assert contract.get_status(jid) == "RESOLVED"


def test_release_unaccepted_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/task_escrow.py")
    direct_vm.sender = direct_alice
    direct_vm.value = ESCROW
    jid = contract.post_job(TITLE, SPEC, CRITERIA, FMT, _deadline())
    direct_vm.value = 0
    with direct_vm.expect_revert("Job not accepted"):
        contract.release(jid)
