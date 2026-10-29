from __future__ import annotations

import json
import sys

import httpx

BASE = "http://127.0.0.1:8000/api"
REPO = "repo_org_alpha_pallets_flask"


def token(email: str) -> str:
    response = httpx.post(f"{BASE}/auth/login", json={"email": email, "password": "whyc-demo"}, timeout=30)
    response.raise_for_status()
    return response.json()["token"]


def main() -> int:
    failures: list[str] = []

    def check(name: str, condition: bool, detail: str = "") -> None:
        print(("PASS " if condition else "FAIL ") + name + (f" :: {detail}" if detail and not condition else ""))
        if not condition:
            failures.append(name)

    ada = token("ada@whyc.dev")
    grace = token("grace@beta.dev")
    reader = token("reader@whyc.dev")
    ha = {"Authorization": f"Bearer {ada}"}
    hg = {"Authorization": f"Bearer {grace}"}
    hr = {"Authorization": f"Bearer {reader}"}

    repos = httpx.get(f"{BASE}/repos", headers=ha, timeout=30).json()
    check("repos listed", any(r["repo_id"] == REPO for r in repos["repos"]), json.dumps(repos)[:400])
    flask = next((r for r in repos["repos"] if r["repo_id"] == REPO), {})
    print("   counts:", flask.get("counts"))

    overview = httpx.get(f"{BASE}/repos/{REPO}/overview", headers=ha, timeout=30).json()
    check("overview counts", (overview.get("counts") or {}).get("entities", 0) > 100, json.dumps(overview.get("counts")))

    locate = httpx.post(
        f"{BASE}/ask",
        headers=ha,
        json={"repo_id": REPO, "question": "Where is the Flask application class implemented?"},
        timeout=120,
    ).json()
    check("locate answers with path", any("app.py" in (c.get("path") or "") for c in locate["citations"]), json.dumps(locate["citations"])[:600])
    check("locate not abstained", not locate["abstained"], str(locate["abstained"]))
    print("   answer:", locate["answer"][:220].replace("\n", " "))

    why = httpx.post(
        f"{BASE}/ask",
        headers=ha,
        json={"repo_id": REPO, "question": "Why is SHA1 still used in the session code?"},
        timeout=120,
    ).json()
    check("why finds decision", any(c["kind"] == "decision" for c in why["evidence"]), json.dumps(why["evidence"])[:500])
    check("why cites PR", any("5460" in (c.get("url") or "") for c in why["evidence"]), str([c.get("url") for c in why["evidence"]])[:400])
    print("   answer:", why["answer"][:260].replace("\n", " "))

    abstain = httpx.post(
        f"{BASE}/ask",
        headers=ha,
        json={"repo_id": REPO, "question": "Why was the payment retry limit set to three attempts?"},
        timeout=120,
    ).json()
    check("abstains on invented history", abstain["abstained"], abstain["answer"][:200])

    security = httpx.post(
        f"{BASE}/ask",
        headers=ha,
        json={"repo_id": REPO, "question": "Is the SHA1 usage a security problem?"},
        timeout=120,
    ).json()
    check("security surfaces finding", any(c["kind"] == "finding" for c in security["evidence"]), json.dumps([c["kind"] for c in security["evidence"]]))

    findings = httpx.get(f"{BASE}/repos/{REPO}/findings", headers=ha, timeout=30).json()["findings"]
    check("findings include B324", any(f["rule_id"] == "B324" for f in findings), str([f["rule_id"] for f in findings]))
    b324 = next((f for f in findings if f["rule_id"] == "B324"), {})
    check("B324 linked to rationale", bool(b324.get("related_decisions")), json.dumps(b324.get("related_decisions"))[:300])

    handover = httpx.get(f"{BASE}/repos/{REPO}/handover", headers=ha, timeout=60).json()
    keys = {s["key"] for s in handover["sections"]}
    check("handover sections", {"overview", "entry_points", "setup", "recent_changes", "open_work", "known_risks"} <= keys, str(keys))

    graph = httpx.get(f"{BASE}/repos/{REPO}/graph", headers=ha, timeout=30).json()
    check("graph has nodes and edges", len(graph["nodes"]) > 10 and len(graph["edges"]) > 5, f"{len(graph['nodes'])}/{len(graph['edges'])}")
    kinds = {n["kind"] for n in graph["nodes"]}
    check("graph includes decisions and findings", {"decision", "finding"} <= kinds, str(kinds))

    task = httpx.post(
        f"{BASE}/agent/tasks",
        headers=ha,
        json={"repo_id": REPO, "title": "Explain session signing", "goal": "Why is SHA1 used and is it safe?"},
        timeout=30,
    ).json()
    task_id = task["task"]["task_id"]
    run = httpx.post(f"{BASE}/agent/tasks/{task_id}/runs", headers=ha, timeout=30).json()
    run_id = run["run"]["run_id"]
    auto = httpx.post(f"{BASE}/agent/runs/{run_id}/auto", headers=ha, timeout=60).json()
    check("agent auto step", len(auto.get("run", {}).get("steps", [])) >= 1, json.dumps(auto)[:300])
    interrupted = httpx.post(f"{BASE}/agent/runs/{run_id}/interrupt", headers=ha, timeout=30).json()
    check("agent interrupted", interrupted["run"]["status"] == "interrupted", interrupted["run"]["status"])
    resumed = httpx.post(f"{BASE}/agent/runs/{run_id}/resume", headers=ha, timeout=60).json()
    check("agent resumed and revalidated", resumed["run"]["resume_count"] >= 1 and "validation" in resumed, json.dumps(resumed.get("validation"))[:300])
    check("agent kept context", len(resumed.get("context") or []) >= 1, str(len(resumed.get("context") or [])))

    cross = httpx.get(f"{BASE}/repos/{REPO}/overview", headers=hg, timeout=30)
    check("cross-tenant repo blocked", cross.status_code == 404, str(cross.status_code))
    cross_ask = httpx.post(f"{BASE}/ask", headers=hg, json={"repo_id": REPO, "question": "Where is Flask?"}, timeout=30)
    check("cross-tenant ask blocked", cross_ask.status_code == 404, str(cross_ask.status_code))
    cross_graph = httpx.get(f"{BASE}/repos/{REPO}/graph", headers=hg, timeout=30)
    check("cross-tenant graph blocked", cross_graph.status_code == 404, str(cross_graph.status_code))
    cross_task = httpx.post(f"{BASE}/agent/tasks", headers=hg, json={"repo_id": REPO, "title": "x", "goal": "x"}, timeout=30)
    check("cross-tenant agent blocked", cross_task.status_code == 404, str(cross_task.status_code))

    beta = httpx.get(f"{BASE}/repos", headers=hg, timeout=30).json()
    check("beta sees only beta", all(r["repo_id"] != REPO for r in beta["repos"]), str([r["repo_id"] for r in beta["repos"]]))

    refresh = httpx.post(f"{BASE}/repos/{REPO}/refresh", headers=hr, timeout=30)
    check("reader cannot refresh", refresh.status_code == 403, str(refresh.status_code))

    print()
    if failures:
        print(f"{len(failures)} FAILURES: {failures}")
        return 1
    print("all smoke checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
