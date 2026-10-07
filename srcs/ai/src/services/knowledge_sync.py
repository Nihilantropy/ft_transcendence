"""Knowledge base synchronisation: keeps ChromaDB aligned with the markdown files on disk."""

import asyncio
import fcntl
import hashlib
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

LOCK_FILE_NAME = ".ingest.lock"


class SyncInProgress(Exception):
    """Another synchronisation holds the lock."""


@dataclass
class SyncResult:
    """Outcome of one synchronisation run."""
    files_processed: int = 0
    total_chunks_created: int = 0
    files_skipped: int = 0
    files_unchanged: int = 0
    files_removed: int = 0
    files_updated: int = 0
    errors: List[str] = field(default_factory=list)

    @property
    def changed(self) -> bool:
        """True when the run added, replaced or removed something."""
        return bool(self.files_processed or self.files_removed)


def lock_path(config) -> Path:
    """Path of the lock file shared by every process using this ChromaDB directory.

    Args:
        config: Settings instance

    Returns:
        Path of the lock file
    """
    return Path(config.CHROMA_PERSIST_DIR) / LOCK_FILE_NAME


def sync_knowledge_base(rag_service, document_processor) -> SyncResult:
    """Align the collection with the knowledge base directory.

    New files are ingested, modified files (different content hash) are replaced,
    files no longer on disk are removed, unchanged files are left alone. The state
    lives in ChromaDB metadata, so any worker can run it and it is safe to repeat.

    Args:
        rag_service: RAG service owning the collection
        document_processor: Document processor used for chunking

    Returns:
        SyncResult with the counters of the run

    Raises:
        SyncInProgress: If another run holds the lock
        FileNotFoundError: If the knowledge base directory does not exist
    """
    kb_dir = Path(rag_service.config.KNOWLEDGE_BASE_DIR)
    if not kb_dir.exists():
        raise FileNotFoundError(f"Knowledge base directory not found: {kb_dir}")

    path = lock_path(rag_service.config)
    path.parent.mkdir(parents=True, exist_ok=True)

    # flock is released by the kernel when the file is closed or the process dies,
    # so a crashed run never leaves a stale lock behind.
    with open(path, "w") as lock_file:
        try:
            fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SyncInProgress("A knowledge base ingestion is already running")

        result = _sync(kb_dir, rag_service, document_processor)

    if result.changed:
        logger.info(
            f"RAG sync: +{result.files_processed - result.files_updated} new, "
            f"~{result.files_updated} updated, -{result.files_removed} removed, "
            f"{result.files_unchanged} unchanged"
        )
    else:
        logger.debug(f"RAG sync: nothing to do ({result.files_unchanged} unchanged)")

    return result


def _sync(kb_dir: Path, rag_service, document_processor) -> SyncResult:
    """Run one synchronisation. The caller holds the lock."""
    result = SyncResult()
    indexed = rag_service.get_indexed_files()
    on_disk = set()

    for md_file in kb_dir.rglob("*.md"):
        source_file = str(md_file.relative_to(kb_dir))
        on_disk.add(source_file)

        try:
            raw = md_file.read_bytes()
            content_hash = hashlib.sha256(raw).hexdigest()

            if indexed.get(source_file) == content_hash:
                result.files_unchanged += 1
                continue

            chunks = document_processor.process(
                content=raw.decode("utf-8"),
                metadata={
                    "source_file": source_file,
                    "source_type": "knowledge_base",
                    "content_hash": content_hash
                }
            )

            # Drop the previous version only once the new one parsed, so a broken
            # edit keeps the old chunks and a shorter file leaves no orphans.
            if source_file in indexed:
                rag_service.delete_document(source_file)
                result.files_updated += 1

            chunks_added = rag_service.add_documents(chunks)

            result.files_processed += 1
            result.total_chunks_created += chunks_added

            logger.info(f"Ingested {source_file}: {chunks_added} chunks")

        except Exception as e:
            result.files_skipped += 1
            result.errors.append(f"{md_file.name}: {str(e)}")
            logger.warning(f"Failed to ingest {md_file}: {e}")

    for source_file in set(indexed) - on_disk:
        rag_service.delete_document(source_file)
        result.files_removed += 1

    return result


async def run_periodic_sync(rag_service, document_processor, interval_seconds: float) -> None:
    """Synchronise once immediately, then every interval, until cancelled.

    A round that finds the lock taken (the endpoint is running the same
    synchronisation) is skipped.

    Args:
        rag_service: RAG service owning the collection
        document_processor: Document processor used for chunking
        interval_seconds: Pause between two runs
    """
    while True:
        try:
            await asyncio.to_thread(sync_knowledge_base, rag_service, document_processor)
        except SyncInProgress:
            logger.debug("RAG sync: skipped, another run is in progress")
        except Exception as e:
            logger.error(f"RAG sync failed: {e}", exc_info=True)

        await asyncio.sleep(interval_seconds)


def start_periodic_sync(config, rag_service, document_processor) -> Optional[asyncio.Task]:
    """Start the periodic synchronisation unless it is disabled.

    Args:
        config: Settings instance
        rag_service: RAG service owning the collection
        document_processor: Document processor used for chunking

    Returns:
        The background task, or None when RAG_SYNC_ENABLED is false
    """
    if not config.RAG_SYNC_ENABLED:
        logger.info("RAG periodic sync disabled")
        return None

    logger.info(f"RAG periodic sync every {config.RAG_SYNC_INTERVAL_MINUTES} min")
    return asyncio.create_task(
        run_periodic_sync(
            rag_service,
            document_processor,
            config.RAG_SYNC_INTERVAL_MINUTES * 60
        )
    )
