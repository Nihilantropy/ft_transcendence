"""Tests for the knowledge base synchronisation (re-runnable bulk ingestion)."""

import asyncio
import fcntl
from unittest.mock import Mock, patch

import pytest

from src.config import Settings
from src.services import knowledge_sync
from src.services.document_processor import Chunk, DocumentProcessor
from src.services.knowledge_sync import (
    SyncInProgress,
    lock_path,
    run_periodic_sync,
    start_periodic_sync,
    sync_knowledge_base,
)
from src.services.rag_service import RAGService


def _doc(title, sections=1):
    body = "".join(f"## Section {i}\n{title} text number {i}.\n\n" for i in range(sections))
    return f"---\nbreed: {title}\n---\n# {title}\n{body}"


@pytest.fixture
def kb_dir(tmp_path):
    path = tmp_path / "knowledge_base"
    path.mkdir()
    return path


@pytest.fixture
def settings(tmp_path, kb_dir):
    return Settings(
        CHROMA_PERSIST_DIR=str(tmp_path / "chroma"),
        KNOWLEDGE_BASE_DIR=str(kb_dir),
    )


@pytest.fixture
def embedder():
    mock = Mock()
    mock.embed_batch = Mock(side_effect=lambda texts: [[0.1] * 384 for _ in texts])
    return mock


@pytest.fixture
def rag_service(settings, embedder):
    """RAG service on a real, throwaway ChromaDB with a fake embedder."""
    return RAGService(settings, embedder, Mock())


@pytest.fixture
def document_processor(settings):
    return DocumentProcessor(settings)


def _count(rag_service):
    return rag_service.get_stats()["document_count"]


def test_new_files_are_ingested(rag_service, document_processor, kb_dir):
    (kb_dir / "dogs").mkdir()
    (kb_dir / "dogs" / "beagle.md").write_text(_doc("Beagle"))
    (kb_dir / "poodle.md").write_text(_doc("Poodle"))

    result = sync_knowledge_base(rag_service, document_processor)

    assert result.files_processed == 2
    assert result.files_unchanged == 0
    assert result.files_removed == 0
    assert result.files_skipped == 0
    assert result.errors == []
    assert result.total_chunks_created == _count(rag_service) > 0
    assert set(rag_service.get_indexed_files()) == {"dogs/beagle.md", "poodle.md"}


def test_only_markdown_files_are_ingested(rag_service, document_processor, kb_dir):
    (kb_dir / "doc.md").write_text(_doc("Doc"))
    (kb_dir / "notes.txt").write_text("plain text")

    result = sync_knowledge_base(rag_service, document_processor)

    assert result.files_processed == 1


def test_second_run_without_changes_does_nothing(rag_service, document_processor, kb_dir, embedder):
    (kb_dir / "beagle.md").write_text(_doc("Beagle"))
    (kb_dir / "poodle.md").write_text(_doc("Poodle"))
    sync_knowledge_base(rag_service, document_processor)
    count = _count(rag_service)
    embedder.embed_batch.reset_mock()

    result = sync_knowledge_base(rag_service, document_processor)

    assert result.files_processed == 0
    assert result.total_chunks_created == 0
    assert result.files_unchanged == 2
    assert _count(rag_service) == count
    embedder.embed_batch.assert_not_called()


def test_modified_file_is_replaced_without_duplicates(rag_service, document_processor, kb_dir):
    (kb_dir / "beagle.md").write_text(_doc("Beagle"))
    sync_knowledge_base(rag_service, document_processor)
    count = _count(rag_service)

    (kb_dir / "beagle.md").write_text(_doc("Beagle").replace("text number", "CHANGED fact"))
    result = sync_knowledge_base(rag_service, document_processor)

    assert result.files_processed == 1
    assert result.files_unchanged == 0
    assert _count(rag_service) == count
    stored = rag_service._collection.get(include=["documents"])["documents"]
    assert any("CHANGED fact" in doc for doc in stored)
    assert not any("text number" in doc for doc in stored)


def test_shortened_file_leaves_no_orphan_chunks(rag_service, document_processor, kb_dir):
    (kb_dir / "beagle.md").write_text(_doc("Beagle", sections=6))
    sync_knowledge_base(rag_service, document_processor)
    long_count = _count(rag_service)

    (kb_dir / "beagle.md").write_text(_doc("Beagle", sections=1))
    result = sync_knowledge_base(rag_service, document_processor)

    assert result.total_chunks_created < long_count
    assert _count(rag_service) == result.total_chunks_created


def test_deleted_file_is_removed(rag_service, document_processor, kb_dir):
    (kb_dir / "beagle.md").write_text(_doc("Beagle"))
    (kb_dir / "poodle.md").write_text(_doc("Poodle"))
    sync_knowledge_base(rag_service, document_processor)

    (kb_dir / "beagle.md").unlink()
    result = sync_knowledge_base(rag_service, document_processor)

    assert result.files_removed == 1
    assert result.files_unchanged == 1
    assert set(rag_service.get_indexed_files()) == {"poodle.md"}


def test_chunks_from_other_sources_are_never_deleted(rag_service, document_processor, kb_dir):
    rag_service.add_documents(
        [Chunk(content="manual", metadata={"source_file": "manual.md", "source_type": "document"})]
    )

    result = sync_knowledge_base(rag_service, document_processor)

    assert result.files_removed == 0
    assert _count(rag_service) == 1


def test_chunks_stored_without_hash_are_replaced(rag_service, document_processor, kb_dir):
    """Data ingested before content_hash existed migrates on the first run."""
    (kb_dir / "beagle.md").write_text(_doc("Beagle"))
    rag_service._collection.add(
        ids=["chunk_0_1234", "chunk_1_5678"],
        embeddings=[[0.1] * 384, [0.1] * 384],
        documents=["legacy one", "legacy two"],
        metadatas=[{"source_file": "beagle.md", "source_type": "knowledge_base"}] * 2,
    )

    result = sync_knowledge_base(rag_service, document_processor)

    assert result.files_processed == 1
    assert _count(rag_service) == result.total_chunks_created
    stored = rag_service._collection.get(include=["documents"])["documents"]
    assert not any("legacy" in doc for doc in stored)


def test_malformed_file_is_skipped_and_others_ingested(rag_service, document_processor, kb_dir):
    (kb_dir / "empty.md").write_text("   \n")
    (kb_dir / "beagle.md").write_text(_doc("Beagle"))

    result = sync_knowledge_base(rag_service, document_processor)

    assert result.files_processed == 1
    assert result.files_skipped == 1
    assert len(result.errors) == 1
    assert "empty.md" in result.errors[0]
    assert set(rag_service.get_indexed_files()) == {"beagle.md"}


def test_broken_edit_keeps_the_previous_chunks(rag_service, document_processor, kb_dir):
    (kb_dir / "beagle.md").write_text(_doc("Beagle"))
    sync_knowledge_base(rag_service, document_processor)
    count = _count(rag_service)

    (kb_dir / "beagle.md").write_text("")
    result = sync_knowledge_base(rag_service, document_processor)

    assert result.files_skipped == 1
    assert result.files_removed == 0
    assert _count(rag_service) == count


def test_missing_directory_raises(rag_service, document_processor, kb_dir):
    kb_dir.rmdir()

    with pytest.raises(FileNotFoundError):
        sync_knowledge_base(rag_service, document_processor)


def test_busy_lock_raises_and_writes_nothing(rag_service, document_processor, kb_dir, settings):
    (kb_dir / "beagle.md").write_text(_doc("Beagle"))
    path = lock_path(settings)
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w") as other_worker:
        fcntl.flock(other_worker, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with pytest.raises(SyncInProgress):
            sync_knowledge_base(rag_service, document_processor)

    assert _count(rag_service) == 0


def test_lock_is_released_after_a_failed_run(rag_service, document_processor, kb_dir):
    (kb_dir / "beagle.md").write_text(_doc("Beagle"))

    with patch.object(rag_service, "get_indexed_files", side_effect=RuntimeError("chroma down")):
        with pytest.raises(RuntimeError):
            sync_knowledge_base(rag_service, document_processor)

    result = sync_knowledge_base(rag_service, document_processor)
    assert result.files_processed == 1


# --- periodic task ---

class _StopLoop(Exception):
    pass


async def _run_loop(outcomes, rounds):
    """Run the loop for a fixed number of rounds; return how many syncs ran."""
    sync = Mock(side_effect=outcomes)
    sleeps = []

    async def fake_sleep(seconds):
        sleeps.append(seconds)
        if len(sleeps) == rounds:
            raise _StopLoop()

    with patch.object(knowledge_sync, "sync_knowledge_base", sync), \
            patch.object(knowledge_sync.asyncio, "sleep", fake_sleep):
        with pytest.raises(_StopLoop):
            await run_periodic_sync(Mock(), Mock(), interval_seconds=42)

    return sync, sleeps


async def test_periodic_sync_runs_immediately_then_every_interval():
    sync, sleeps = await _run_loop([Mock(changed=False)] * 3, rounds=3)

    assert sync.call_count == 3
    assert sleeps == [42, 42, 42]


async def test_periodic_sync_survives_a_failing_round():
    sync, _ = await _run_loop([RuntimeError("boom"), Mock(changed=False)], rounds=2)

    assert sync.call_count == 2


async def test_periodic_sync_skips_the_round_when_locked():
    sync, _ = await _run_loop([SyncInProgress(), Mock(changed=False)], rounds=2)

    assert sync.call_count == 2


async def test_start_periodic_sync_disabled_starts_nothing():
    settings = Settings(RAG_SYNC_ENABLED=False)

    assert start_periodic_sync(settings, Mock(), Mock()) is None


async def test_start_periodic_sync_enabled_returns_running_task():
    settings = Settings(RAG_SYNC_ENABLED=True, RAG_SYNC_INTERVAL_MINUTES=5)

    with patch.object(knowledge_sync, "sync_knowledge_base", Mock(side_effect=SyncInProgress())):
        task = start_periodic_sync(settings, Mock(), Mock())
        assert isinstance(task, asyncio.Task)
        await asyncio.sleep(0)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
