import pytest
from app.api import mcp_capabilities, mcp_client_config
from app.mcp import handle_jsonrpc, TOOLS, SERVER_INFO


def test_mcp_initialize():
    req = {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}
    res = handle_jsonrpc(req)
    assert res["jsonrpc"] == "2.0"
    assert res["id"] == 1
    assert res["result"]["serverInfo"]["name"] == "whycode-mcp-server"
    assert "tools" in res["result"]["capabilities"]


def test_mcp_tools_list():
    req = {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
    res = handle_jsonrpc(req)
    assert res["id"] == 2
    tools = res["result"]["tools"]
    tool_names = [t["name"] for t in tools]
    assert "whycode_check_invariants" in tool_names
    assert "whycode_verify_change_invariants" in tool_names
    assert "whycode_simulate_blast_radius" in tool_names
    assert "whycode_query_decisions" in tool_names


def test_mcp_check_invariants():
    req = {
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {
            "name": "whycode_check_invariants",
            "arguments": {"path": "src/flask/sessions.py"},
        },
    }
    res = handle_jsonrpc(req)
    assert res["id"] == 3
    assert not res["result"]["isError"]
    content = res["result"]["content"][0]["text"]
    assert "INV-5460" in content
    assert "Bandit B324" in content


def test_mcp_verify_change_invariants_pass():
    req = {
        "jsonrpc": "2.0",
        "id": 4,
        "method": "tools/call",
        "params": {
            "name": "whycode_verify_change_invariants",
            "arguments": {
                "path": "src/flask/sessions.py",
                "patch": "def verify(self, sig): return dual_sha1_sha256_adapter(sig)",
            },
        },
    }
    res = handle_jsonrpc(req)
    assert not res["result"]["isError"]
    content = res["result"]["content"][0]["text"]
    assert "ALLOWED" in content
    assert "Zero regressions detected" in content


def test_mcp_verify_change_invariants_blocked():
    req = {
        "jsonrpc": "2.0",
        "id": 5,
        "method": "tools/call",
        "params": {
            "name": "whycode_verify_change_invariants",
            "arguments": {
                "path": "src/flask/sessions.py",
                "patch": "return hmac.new(self.key, val, hashlib.sha256).digest()",
            },
        },
    }
    res = handle_jsonrpc(req)
    assert not res["result"]["isError"]
    content = res["result"]["content"][0]["text"]
    assert "BLOCKED" in content
    assert "Refactor breaks architectural contract" in content


def test_mcp_http_endpoints():
    data = mcp_capabilities()
    assert data["status"] == "online"
    assert len(data["tools"]) == 4

    cfg = mcp_client_config()
    assert "claude_desktop" in cfg
    assert "cursor_remote" in cfg

    rpc_data = handle_jsonrpc({"jsonrpc": "2.0", "id": 10, "method": "tools/list", "params": {}})
    assert rpc_data["id"] == 10
    assert len(rpc_data["result"]["tools"]) == 4
