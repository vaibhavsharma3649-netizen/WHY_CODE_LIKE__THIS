import pytest
from app.auth import (
    Principal,
    create_oauth_state,
    create_token,
    decode_oauth_state,
    decode_token,
    decode_token_claims,
    hash_password,
    hash_token,
    normalize_email,
    verify_password,
)
from app.embeddings import _hash_embed, cosine, tokenize_count, approx_tokens, DIM
from app.github_auth import parse_repo_ref
from app.llm import compose_deterministic, evidence_block, _history_block, _focus_block
from app.ingest import parser
from app.retrieval import classify, _fulltext_query, _identifiers, _rrf


def test_password_hashing():
    pw = "secret-password-123"
    encoded = hash_password(pw)
    assert verify_password(pw, encoded) is True
    assert verify_password("wrong-password", encoded) is False
    assert verify_password(pw, "invalid$format") is False


def test_token_lifecycle():
    uid = "usr_test_123"
    token = create_token(uid)
    decoded = decode_token(token)
    assert decoded == uid


def test_access_token_version_claim():
    claims = decode_token_claims(create_token("usr_test_123", 4))
    assert claims["ver"] == 4
    assert claims["typ"] == "access"


def test_oauth_state_roundtrip():
    state = create_oauth_state("github_login", "org_alpha")
    payload = decode_oauth_state(state, "github_login")
    assert payload["org"] == "org_alpha"
    with pytest.raises(Exception):
        decode_oauth_state(state, "github_install")


def test_token_hashing_and_email_normalization():
    raw = "refresh-token-value"
    assert hash_token(raw) == hash_token(raw)
    assert hash_token(raw) != hash_token("other")
    assert normalize_email("  Ada@Whyc.Dev ") == "ada@whyc.dev"


def test_repo_reference_parsing():
    assert parse_repo_ref("pallets/flask") == ("pallets", "flask")
    assert parse_repo_ref("https://github.com/pallets/flask.git") == ("pallets", "flask")
    assert parse_repo_ref("github.com/alpha/ledger-core/") == ("alpha", "ledger-core")
    with pytest.raises(ValueError):
        parse_repo_ref("not-a-repo")


def test_principal_role_rank():
    p = Principal(
        user_id="u1",
        email="a@b.com",
        name="Admin",
        org_id="o1",
        org_name="Org",
        role="admin"
    )
    assert p.at_least("reader") is True
    assert p.at_least("maintainer") is True
    assert p.at_least("admin") is True

    reader = Principal(
        user_id="u2",
        email="r@b.com",
        name="Reader",
        org_id="o1",
        org_name="Org",
        role="reader"
    )
    assert reader.at_least("reader") is True
    assert reader.at_least("developer") is False
    assert reader.at_least("admin") is False


def test_hash_embeddings():
    vec1 = _hash_embed("hello world")
    assert len(vec1) == DIM
    vec2 = _hash_embed("hello world")
    assert vec1 == vec2
    vec3 = _hash_embed("completely different topic")
    sim_same = cosine(vec1, vec2)
    sim_diff = cosine(vec1, vec3)
    assert pytest.approx(sim_same, abs=1e-4) == 1.0
    assert sim_diff < 0.9


def test_token_counting():
    text = "A quick brown fox jumps over the lazy dog."
    assert tokenize_count(text) > 0
    assert approx_tokens(text) > 0


def test_retrieval_classify():
    assert classify("Why is this method deprecated?") == "why"
    assert classify("Is there a security vulnerability in this route?") == "security"
    assert classify("How do I onboard as a new developer?") == "handover"
    assert classify("Where is the user model defined?") == "locate"
    assert classify("Explain the caching logic.") == "understand"


def test_fulltext_and_identifiers():
    query = "Find the AuthTokenManager in session.py"
    ft = _fulltext_query(query)
    assert ft is not None
    assert "authtokenmanager" in ft.lower()
    idents = _identifiers(query)
    assert "AuthTokenManager" in idents


def test_rrf():
    list1 = [("doc1", 10.0), ("doc2", 5.0)]
    list2 = [("doc2", 8.0), ("doc1", 4.0)]
    scores = _rrf(list1, list2, k=60)
    assert "doc1" in scores
    assert "doc2" in scores
    # doc1: 1/61 + 1/62; doc2: 1/62 + 1/61 => equal
    assert pytest.approx(scores["doc1"], abs=1e-5) == scores["doc2"]


def test_parser_python():
    code = '''
"""Module docstring."""
import os

class MyService:
    """Service class."""
    def run(self, arg1, arg2):
        return os.path.join(arg1, arg2)
'''
    parsed = parser.parse_python(
        rel_path="src/service.py",
        text=code,
        org_id="org1",
        repo_id="repo1",
        commit_sha="sha123",
        owner="test",
        name="testrepo"
    )
    assert parsed.language == "python"
    assert len(parsed.entities) >= 3  # module, MyService, run
    kinds = {e["kind"] for e in parsed.entities}
    assert "module" in kinds
    assert "class" in kinds
    assert "function" in kinds


def test_compose_deterministic_abstain():
    ans, ids, abstained, conf = compose_deterministic("Random question", "why", [], {})
    assert abstained is True
    assert len(ids) == 0
    assert "Not established" in ans


def test_evidence_block():
    ev = [
        {"id": "ev1", "kind": "code", "title": "func1", "path": "a.py", "snippet": "def func1(): pass"},
        {"id": "ev2", "kind": "decision", "title": "dec1", "path": "b.py", "snippet": "decided to use X"},
    ]
    block = evidence_block(ev)
    assert "[ev1]" in block
    assert "func1" in block
    assert "[ev2]" in block

