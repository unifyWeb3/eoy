"""Direct tests for judge() gate + 4 verdict fixtures (simulation only)."""
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


def _post_submit(contract, vm, alice, bob):
    vm.sender = alice
    vm.value = ESCROW
    jid = contract.post_job(TITLE, SPEC, CRITERIA, FMT, _deadline())
    vm.value = 0
    vm.sender = bob
    contract.submit(jid, URL, "abc123hash", "CLI done")
    return jid


def test_judge_pass_accepts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/task_escrow.py")
    jid = _post_submit(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.mock_web(
        r".*github\.com/org/repo.*",
        {"status": 200, "body": "def parse_csv(path): return json.load(open(path))"},
    )
    direct_vm.mock_llm(
        r".*judge a code-task.*",
        json.dumps({"verdict": "pass", "reasoning": "Meets all rubric criteria."}),
    )
    direct_vm.sender = direct_alice
    contract.judge(jid)
    assert contract.get_status(jid) == "ACCEPTED"
    job = json.loads(contract.get_job(jid))
    assert job["verdict"] == "pass"
    assert len(job["reasoning"]) > 0


def test_judge_structural_fail_no_llm(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/task_escrow.py")
    jid = _post_submit(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.mock_web(r".*github\.com/org/repo.*", {"status": 404, "body": ""})
    direct_vm.mock_llm(
        r".*judge a code-task.*",
        json.dumps({"verdict": "pass", "reasoning": "Should never be called."}),
    )
    direct_vm.sender = direct_alice
    contract.judge(jid)
    assert contract.get_status(jid) == "REJECTED"
    job = json.loads(contract.get_job(jid))
    assert "STRUCTURAL_FAIL" in job["reasoning"]
    assert len(direct_vm._llm_mocks_hit) == 0


def test_judge_semantic_fail_rejects(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/task_escrow.py")
    jid = _post_submit(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.mock_web(
        r".*github\.com/org/repo.*",
        {"status": 200, "body": "print('hello')  # wrong program entirely"},
    )
    direct_vm.mock_llm(
        r".*judge a code-task.*",
        json.dumps({"verdict": "fail", "reasoning": "Does not implement CSV parsing."}),
    )
    direct_vm.sender = direct_alice
    contract.judge(jid)
    assert contract.get_status(jid) == "REJECTED"
    job = json.loads(contract.get_job(jid))
    assert job["verdict"] == "fail"


def test_judge_ambiguous_undetermined(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/task_escrow.py")
    jid = _post_submit(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.mock_web(
        r".*github\.com/org/repo.*",
        {"status": 200, "body": "partial implementation, unclear if complete"},
    )
    direct_vm.mock_llm(
        r".*judge a code-task.*",
        json.dumps({"verdict": "unclear", "reasoning": "Cannot decide from content."}),
    )
    direct_vm.sender = direct_alice
    contract.judge(jid)
    assert contract.get_status(jid) == "UNDETERMINED"


def test_judge_twice_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/task_escrow.py")
    jid = _post_submit(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.mock_web(
        r".*github\.com/org/repo.*", {"status": 200, "body": "def parse_csv(p): pass"}
    )
    direct_vm.mock_llm(
        r".*judge a code-task.*",
        json.dumps({"verdict": "fail", "reasoning": "Incomplete."}),
    )
    direct_vm.sender = direct_alice
    contract.judge(jid)
    with direct_vm.expect_revert("Job already decided"):
        contract.judge(jid)


def test_judge_unsubmitted_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/task_escrow.py")
    direct_vm.sender = direct_alice
    direct_vm.value = ESCROW
    jid = contract.post_job(TITLE, SPEC, CRITERIA, FMT, _deadline())
    direct_vm.value = 0
    with direct_vm.expect_revert("Job not submitted"):
        contract.judge(jid)
