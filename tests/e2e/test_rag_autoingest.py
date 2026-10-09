"""Knowledge base auto-ingestion, end to end: a markdown file dropped in the knowledge base
directory is picked up at runtime, without restarting ai-service.

The suite triggers the synchronisation itself (`POST /api/v1/admin/rag/initialize`, the same
function ai-service runs on its own at startup and every RAG_SYNC_INTERVAL_MINUTES), so it does
not wait for the timer. The endpoint is localhost-only, but the tester sits on backend-network
and counts as an internal caller.

The probe document is written to the real, git-tracked directory (mounted read-write in the
tester only) and removed in the fixture teardown, whatever the test does.
"""
import base64
import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx
import pytest

from helpers import ok

AI_URL = os.environ.get("AI_SERVICE_URL", "http://ai-service:3003")
KB_DIR = Path(os.environ.get("KNOWLEDGE_BASE_DIR", "/knowledge_base"))

# Nothing an LLM or the existing documents could know.
FACT = "zorblaxian moonberry allergy"

# Written like any other document of the knowledge base: the fact sits in the last section and
# nothing in the text is tuned to the retrieval. The context is looked up by the `breed`
# declared in the frontmatter, so the whole document reaches the response in
# enriched_info.description. (It used to be a similarity ranking, which only a document
# repeating the query string could win.)
PROBE = f"""---
doc_type: breed
species: dog
breed: golden_retriever
topics: [health]
---

# Golden Retriever Field Notes

## Overview
Filler so the document spans more than one chunk.

## Known Sensitivities
- **Diet**: {FACT}
"""


def sync():
    """Run one synchronisation and return its counters; wait out a run already in progress."""
    for _ in range(60):
        resp = httpx.post(f"{AI_URL}/api/v1/admin/rag/initialize", timeout=300)
        if resp.status_code != 409:
            return ok(resp)["data"]
        time.sleep(2)
    pytest.fail("ai-service kept answering 409 INGESTION_IN_PROGRESS for 2 minutes")


def count():
    return ok(httpx.get(f"{AI_URL}/api/v1/rag/status", timeout=30))["data"]["document_count"]


@pytest.fixture
def probe():
    """Path for a unique probe document; file and chunks are gone after the test."""
    sync()
    path = KB_DIR / "spiecies" / "dogs" / "purebreeds" / f"zz_gate_probe_{uuid.uuid4().hex[:12]}.md"
    try:
        yield path
    finally:
        path.unlink(missing_ok=True)
        sync()


def analyze(edge_user):
    with open("/test_data/golden_retriever_1.jpg", "rb") as f:
        uri = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
    return ok(edge_user["client"].post("/api/v1/vision/analyze", json={"image": uri}))["data"]


def test_file_lifecycle_is_picked_up_at_runtime(probe):
    """Add, re-run, modify, delete — each reflected by the next synchronisation, no restart."""
    base = count()

    probe.write_text(PROBE)
    added = sync()
    assert added["files_skipped"] == 0, added
    with_probe = count()
    assert with_probe > base

    # Every concurrent request must see the same collection. With two uvicorn workers each
    # had its own embedded ChromaDB client, and they drifted apart.
    with ThreadPoolExecutor(16) as pool:
        assert set(pool.map(lambda _: count(), range(50))) == {with_probe}

    again = sync()
    assert again["files_processed"] == 0, again
    assert again["total_chunks_created"] == 0, again
    assert count() == with_probe

    # Shorter version: its extra chunks must not survive as orphans.
    probe.write_text(PROBE.split("## Known Sensitivities")[0])
    modified = sync()
    assert modified["files_processed"] == 1, modified
    assert base < count() < with_probe

    probe.unlink()
    removed = sync()
    assert removed["files_removed"] == 1, removed
    assert count() == base


def test_new_document_reaches_the_analysis(edge_user, probe):
    """The same photo, before and after the document exists: the new knowledge shows up in the
    response and the file is listed among its sources. Needs the full pipeline (classification,
    LLM); what is asserted is the retrieved context, not the LLM's prose.

    The first analysis doubles as a regression check: it runs right after other documents were
    deleted, which is when a worker with a stale vector index returned dangling results and the
    enrichment came back null."""
    before = analyze(edge_user)["enriched_info"]
    assert before is not None, "RAG enrichment failed: see ai-service logs"
    assert probe.name not in " ".join(before["sources"])
    assert FACT not in before["description"]

    probe.write_text(PROBE)
    sync()

    after = analyze(edge_user)["enriched_info"]
    assert any(probe.name in source for source in after["sources"]), after["sources"]
    assert FACT in after["description"], after["description"]
