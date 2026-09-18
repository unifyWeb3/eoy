"""Direct tests for post_job / submit / views (simulation only, not GenLayer proof)."""
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
ESCROW = 1_000_000_000_000_000_000


def _deadline(days=7):
    return int(datetime.now(timezone.utc).timestamp()) + days * 86400


def _post(contract, vm, alice, value=ESCROW, deadline=None):
    vm.sender = alice
    vm.value = value
    job_id = contract.post_job(TITLE, SPEC, CRITERIA, FMT, deadline or _deadline())
    vm.value = 0
    return job_id


def test_post_job_ok(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/task_escrow.py")
    jid = _post(contract, direct_vm, direct_alice)
    assert int(jid) == 0
    raw = contract.get_job(jid)
    job = json.loads(raw)
    assert job["status"] == "FUNDED"
    assert job["amount_wei"] == str(ESCROW)
    assert len(job["payer"]) > 0
    assert contract.get_status(jid) == "FUNDED"


def test_post_job_increments_id(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/task_escrow.py")
    j0 = _post(contract, direct_vm, direct_alice)
    j1 = _post(contract, direct_vm, direct_alice)
    assert int(j0) == 0
    assert int(j1) == 1


def test_post_job_zero_value_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/task_escrow.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    with direct_vm.expect_revert("Escrow value must be positive"):
        contract.post_job(TITLE, SPEC, CRITERIA, FMT, _deadline())
    direct_vm.value = 0


def test_post_job_short_title_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/task_escrow.py")
    direct_vm.sender = direct_alice
    direct_vm.value = ESCROW
    with direct_vm.expect_revert("Title too short"):
        contract.post_job("Short", SPEC, CRITERIA, FMT, _deadline())
    direct_vm.value = 0


def test_post_job_short_spec_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/task_escrow.py")
    direct_vm.sender = direct_alice
    direct_vm.value = ESCROW
    with direct_vm.expect_revert("Spec too short"):
        contract.post_job(TITLE, "too short", CRITERIA, FMT, _deadline())
    direct_vm.value = 0


def test_post_job_short_criteria_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/task_escrow.py")
    direct_vm.sender = direct_alice
    direct_vm.value = ESCROW
    with direct_vm.expect_revert("Criteria too short"):
        contract.post_job(TITLE, SPEC, "too short", FMT, _deadline())
    direct_vm.value = 0


def test_post_job_past_deadline_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/task_escrow.py")
    direct_vm.sender = direct_alice
    direct_vm.value = ESCROW
    past = int(datetime.now(timezone.utc).timestamp()) - 10
    with direct_vm.expect_revert("Deadline must be in the future"):
        contract.post_job(TITLE, SPEC, CRITERIA, FMT, past)
    direct_vm.value = 0


def test_submit_ok(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/task_escrow.py")
    jid = _post(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    direct_vm.value = 0
    contract.submit(jid, "https://github.com/org/repo/commit/abc123", "abc123hash", "CLI done")
    assert contract.get_status(jid) == "SUBMITTED"
    job = json.loads(contract.get_job(jid))
    assert job["delivery_url"] == "https://github.com/org/repo/commit/abc123"
    assert len(job["worker"]) > 0


def test_submit_non_https_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/task_escrow.py")
    jid = _post(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("must start with https://"):
        contract.submit(jid, "http://github.com/org/repo", "h", "desc")


def test_submit_bad_host_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/task_escrow.py")
    jid = _post(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("not allowlisted"):
        contract.submit(jid, "https://evil.example.com/x", "h", "desc")


def test_submit_empty_hash_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/task_escrow.py")
    jid = _post(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Content hash required"):
        contract.submit(jid, "https://github.com/org/repo", "   ", "desc")


def test_submit_twice_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/task_escrow.py")
    jid = _post(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    contract.submit(jid, "https://github.com/org/repo/commit/abc", "h1", "first")
    with direct_vm.expect_revert("not in FUNDED state"):
        contract.submit(jid, "https://github.com/org/repo/commit/def", "h2", "second")


def test_get_job_not_found_reverts(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/task_escrow.py")
    with direct_vm.expect_revert("Job not found"):
        contract.get_job(999)


def test_get_status_not_found_reverts(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/task_escrow.py")
    with direct_vm.expect_revert("Job not found"):
        contract.get_status(999)
