# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import json
from datetime import datetime, timezone
from genlayer import *


@gl.evm.contract_interface
class _Recipient:
    class View:
        pass

    class Write:
        pass


def _parse_verdict(raw) -> dict:
    if isinstance(raw, dict):
        return raw
    s = str(raw).strip().replace("```json", "").replace("```", "").strip()
    start = s.find("{")
    end = s.rfind("}") + 1
    if start >= 0 and end > start:
        s = s[start:end]
    return json.loads(s)


def _host_of(url: str) -> str:
    rest = url[len("https://"):] if url.startswith("https://") else url
    slash = rest.find("/")
    host = rest[:slash] if slash >= 0 else rest
    colon = host.find(":")
    if colon >= 0:
        host = host[:colon]
    return host.lower()


class TaskEscrow(gl.Contract):
    jobs: TreeMap[u256, str]
    next_id: u256
    allowlist: DynArray[str]

    def __init__(self):
        self.next_id = u256(0)
        self.allowlist.append("github.com")
        self.allowlist.append("gitlab.com")
        self.allowlist.append("raw.githubusercontent.com")

    def _now(self) -> int:
        return int(datetime.now(timezone.utc).timestamp())

    def _load_job(self, job_id: u256) -> dict:
        if job_id not in self.jobs:
            raise gl.vm.UserError("Job not found")
        return json.loads(self.jobs[job_id])

    def _save_job(self, job_id: u256, job: dict) -> None:
        self.jobs[job_id] = json.dumps(job, sort_keys=True)

    def _is_allowlisted(self, host: str) -> bool:
        for allowed in self.allowlist:
            a = str(allowed).lower()
            if host == a or host.endswith("." + a):
                return True
        return False

    @gl.public.write.payable
    def post_job(
        self,
        title: str,
        spec: str,
        criteria: str,
        deliverable_format: str,
        deadline: u256,
    ) -> u256:
        if len(title) < 10:
            raise gl.vm.UserError("Title too short (min 10 chars)")
        if len(spec) < 80:
            raise gl.vm.UserError("Spec too short (min 80 chars)")
        if len(criteria) < 80:
            raise gl.vm.UserError("Criteria too short (min 80 chars)")
        if len(title) + len(spec) + len(criteria) < 200:
            raise gl.vm.UserError("Combined job fields too short (min 200 chars)")
        if gl.message.value <= u256(0):
            raise gl.vm.UserError("Escrow value must be positive")
        now = self._now()
        if int(deadline) <= now:
            raise gl.vm.UserError("Deadline must be in the future")
        job_id = self.next_id
        job = {
            "payer": gl.message.sender_address.as_hex,
            "worker": "",
            "title": title,
            "spec": spec,
            "criteria": criteria,
            "format": deliverable_format,
            "deadline": str(int(deadline)),
            "amount_wei": str(int(gl.message.value)),
            "delivery_url": "",
            "content_hash": "",
            "description": "",
            "status": "FUNDED",
            "verdict": "",
            "reasoning": "",
            "decided_at": "",
            "paid": False,
        }
        self.jobs[job_id] = json.dumps(job, sort_keys=True)
        self.next_id = u256(int(self.next_id) + 1)
        return job_id

    @gl.public.write
    def submit(
        self, job_id: u256, delivery_url: str, content_hash: str, description: str
    ) -> None:
        job = self._load_job(job_id)
        if str(job.get("status", "")) != "FUNDED":
            raise gl.vm.UserError("Job not in FUNDED state")
        now = self._now()
        if now > int(job.get("deadline", "0")):
            raise gl.vm.UserError("Submission past deadline")
        if not delivery_url.startswith("https://"):
            raise gl.vm.UserError("Delivery URL must start with https://")
        host = _host_of(delivery_url)
        if not self._is_allowlisted(host):
            raise gl.vm.UserError("Delivery host not allowlisted")
        if len(content_hash.strip()) == 0:
            raise gl.vm.UserError("Content hash required")
        job["worker"] = gl.message.sender_address.as_hex
        job["delivery_url"] = delivery_url
        job["content_hash"] = content_hash
        job["description"] = description
        job["status"] = "SUBMITTED"
        self._save_job(job_id, job)

    @gl.public.write
    def judge(self, job_id: u256) -> None:
        job = self._load_job(job_id)
        status = str(job.get("status", ""))
        if status != "SUBMITTED":
            if status in ("ACCEPTED", "REJECTED", "UNDETERMINED", "RESOLVED", "REFUNDED"):
                raise gl.vm.UserError("Job already decided")
            raise gl.vm.UserError("Job not submitted")
        delivery_url = str(job.get("delivery_url", ""))
        content_hash = str(job.get("content_hash", ""))
        if len(delivery_url) == 0 or len(content_hash.strip()) == 0:
            job["status"] = "REJECTED"
            job["verdict"] = "fail"
            job["reasoning"] = "STRUCTURAL_FAIL: missing delivery_url or content_hash"
            job["decided_at"] = datetime.now(timezone.utc).isoformat()
            self._save_job(job_id, job)
            return
        if not delivery_url.startswith("https://"):
            job["status"] = "REJECTED"
            job["verdict"] = "fail"
            job["reasoning"] = "STRUCTURAL_FAIL: delivery URL must start with https://"
            job["decided_at"] = datetime.now(timezone.utc).isoformat()
            self._save_job(job_id, job)
            return
        host = _host_of(delivery_url)
        if not self._is_allowlisted(host):
            job["status"] = "REJECTED"
            job["verdict"] = "fail"
            job["reasoning"] = "STRUCTURAL_FAIL: delivery host not allowlisted"
            job["decided_at"] = datetime.now(timezone.utc).isoformat()
            self._save_job(job_id, job)
            return
        title = str(job.get("title", ""))
        spec = str(job.get("spec", ""))
        criteria = str(job.get("criteria", ""))
        worker = str(job.get("worker", ""))
        amount_wei = str(job.get("amount_wei", "0"))

        def fetch_and_judge():
            resp = gl.nondet.web.get(delivery_url)
            try:
                status = int(resp.status)
            except Exception:
                status = 0
            if status >= 400:
                return {
                    "verdict": "fail",
                    "reasoning": "STRUCTURAL_FAIL: delivery fetch status "
                    + str(status),
                }
            if resp.body is None:
                return {
                    "verdict": "fail",
                    "reasoning": "STRUCTURAL_FAIL: empty delivery content",
                }
            try:
                body = resp.body.decode("utf-8", errors="ignore")[:12000]
            except Exception:
                body = str(resp.body)[:12000]
            if len(body.strip()) == 0:
                return {
                    "verdict": "fail",
                    "reasoning": "STRUCTURAL_FAIL: empty delivery content",
                }
            prompt = (
                "You judge a code-task delivery against a rubric. "
                "Title: " + title + "\n"
                "Spec: " + spec + "\n"
                "Criteria: " + criteria + "\n"
                "Delivered content (truncated to 12000 chars): " + body + "\n"
                "Evaluate only the visible content; do not penalize apparent "
                "incompleteness if the content ends mid-file due to truncation. "
                'Return ONLY JSON {"verdict":"pass"|"fail","reasoning":"..."}'
            )
            return gl.nondet.exec_prompt(prompt, response_format="json")

        raw = gl.eq_principle.prompt_comparative(
            fetch_and_judge,
            'The "verdict" field must be the same in both responses',
        )
        try:
            parsed = _parse_verdict(raw)
        except Exception:
            job["status"] = "UNDETERMINED"
            job["verdict"] = "undetermined"
            job["reasoning"] = "UNDETERMINED: LLM output unparseable"
            job["decided_at"] = datetime.now(timezone.utc).isoformat()
            self._save_job(job_id, job)
            return
        verdict = str(parsed.get("verdict", "")).strip().lower()
        reasoning = str(parsed.get("reasoning", ""))[:2000]
        if verdict == "pass":
            job["status"] = "ACCEPTED"
            job["verdict"] = "pass"
            job["reasoning"] = reasoning
            job["decided_at"] = datetime.now(timezone.utc).isoformat()
            job["paid"] = True
            self._save_job(job_id, job)
            amount = u256(int(amount_wei))
            _Recipient(Address(worker)).emit_transfer(value=amount)
            return
        if verdict == "fail":
            job["status"] = "REJECTED"
            job["verdict"] = "fail"
            job["reasoning"] = reasoning
            job["decided_at"] = datetime.now(timezone.utc).isoformat()
            self._save_job(job_id, job)
            return
        job["status"] = "UNDETERMINED"
        job["verdict"] = "undetermined"
        job["reasoning"] = reasoning if len(reasoning) > 0 else "UNDETERMINED: ambiguous verdict"
        job["decided_at"] = datetime.now(timezone.utc).isoformat()
        self._save_job(job_id, job)

    @gl.public.write
    def reclaim(self, job_id: u256) -> None:
        job = self._load_job(job_id)
        status = str(job.get("status", ""))
        if bool(job.get("paid", False)) and status in ("RESOLVED", "REFUNDED"):
            return
        if status in ("RESOLVED", "REFUNDED"):
            return
        payer = str(job.get("payer", ""))
        if gl.message.sender_address.as_hex.lower() != payer.lower():
            raise gl.vm.UserError("Only payer can reclaim")
        if status == "ACCEPTED":
            raise gl.vm.UserError("Use release for accepted jobs")
        if status == "REJECTED" or status == "UNDETERMINED":
            pass
        else:
            now = self._now()
            if now <= int(job.get("deadline", "0")):
                raise gl.vm.UserError("Deadline not passed")
        amount = u256(int(str(job.get("amount_wei", "0"))))
        if amount <= u256(0):
            raise gl.vm.UserError("Nothing to reclaim")
        job["status"] = "REFUNDED"
        job["paid"] = True
        self._save_job(job_id, job)
        _Recipient(Address(payer)).emit_transfer(value=amount)

    @gl.public.write
    def release(self, job_id: u256) -> None:
        job = self._load_job(job_id)
        status = str(job.get("status", ""))
        if status == "RESOLVED":
            return
        if status != "ACCEPTED":
            raise gl.vm.UserError("Job not accepted")
        worker = str(job.get("worker", ""))
        if len(worker) == 0:
            raise gl.vm.UserError("No worker to pay")
        if bool(job.get("paid", False)):
            job["status"] = "RESOLVED"
            self._save_job(job_id, job)
            return
        amount = u256(int(str(job.get("amount_wei", "0"))))
        if amount <= u256(0):
            raise gl.vm.UserError("Nothing to release")
        job["status"] = "RESOLVED"
        job["paid"] = True
        self._save_job(job_id, job)
        _Recipient(Address(worker)).emit_transfer(value=amount)

    @gl.public.view
    def get_job(self, job_id: u256) -> str:
        if job_id not in self.jobs:
            raise gl.vm.UserError("Job not found")
        return self.jobs[job_id]

    @gl.public.view
    def get_status(self, job_id: u256) -> str:
        if job_id not in self.jobs:
            raise gl.vm.UserError("Job not found")
        job = json.loads(self.jobs[job_id])
        return str(job.get("status", ""))

    @gl.public.view
    def get_balance(self) -> u256:
        return self.balance
