"""RAG service for retrieval-augmented generation."""

import hashlib
import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Any

import chromadb

from src.services.document_processor import Chunk

logger = logging.getLogger(__name__)


@dataclass
class Source:
    """A retrieved source document."""
    content: str
    source_file: str
    relevance_score: float


@dataclass
class RAGResponse:
    """Response from RAG query."""
    answer: str
    sources: List[Source]
    model: str


class RAGService:
    """Orchestrates RAG queries with ChromaDB and Ollama."""

    def __init__(self, config, embedder, ollama_client):
        """Initialize RAG service.

        Args:
            config: Settings instance
            embedder: Embedder service for generating embeddings
            ollama_client: Ollama client for text generation
        """
        self.config = config
        self.embedder = embedder
        self.ollama = ollama_client

        # Initialize ChromaDB
        self._chroma_client = chromadb.PersistentClient(path=config.CHROMA_PERSIST_DIR)
        self._collection = self._open_collection()

        logger.info(f"Initialized RAG service with collection: {config.CHROMA_COLLECTION_NAME}")

    def _open_collection(self):
        """Open the collection, dropping one that was built with another embedding model.

        Vectors of two models cannot be compared, and a different dimension makes every
        write fail. The knowledge base sync refills an empty collection on its own.

        Returns:
            The ChromaDB collection
        """
        name = self.config.CHROMA_COLLECTION_NAME
        model = self.config.EMBEDDING_MODEL

        try:
            existing = self._chroma_client.get_collection(name)
        except Exception:
            existing = None

        if existing is not None and (existing.metadata or {}).get("embedding_model") != model:
            logger.warning(f"Collection {name} was not built with {model}: rebuilding it")
            self._chroma_client.delete_collection(name)

        return self._chroma_client.get_or_create_collection(
            name=name,
            metadata={"embedding_model": model, "hnsw:space": "cosine"}
        )

    async def query(
        self,
        question: str,
        filters: Optional[Dict[str, Any]] = None,
        top_k: int = None
    ) -> RAGResponse:
        """Query the knowledge base and generate an answer.

        Args:
            question: User's question
            filters: Optional metadata filters (e.g., {"breed": "golden_retriever"})
            top_k: Number of chunks to retrieve (default: config value)

        Returns:
            RAGResponse with answer and sources
        """
        top_k = top_k or self.config.RAG_TOP_K

        # 1. Embed the question
        query_embedding = self.embedder.embed(question)

        # 2. Search ChromaDB
        query_params = {
            "query_embeddings": [query_embedding],
            "n_results": top_k
        }
        if filters:
            query_params["where"] = filters

        results = self._collection.query(**query_params)

        # 3. Build context from retrieved chunks
        sources = self._build_sources(results)
        context = self._format_context(sources)

        # 4. Generate answer with Ollama
        prompt = self._build_prompt(question, context)
        answer = await self.ollama.generate(prompt)

        return RAGResponse(
            answer=answer,
            sources=sources,
            model=self.config.LLM_TEXT_MODEL
        )

    def _build_sources(self, results: Dict) -> List[Source]:
        """Build Source objects from ChromaDB results.

        Args:
            results: ChromaDB query results

        Returns:
            List of Source objects
        """
        sources = []
        if not results["ids"] or not results["ids"][0]:
            return sources

        documents = results["documents"][0]
        metadatas = results["metadatas"][0]
        distances = results["distances"][0]

        for doc, meta, dist in zip(documents, metadatas, distances):
            # Convert distance to relevance (1 - normalized_distance)
            relevance = max(0, 1 - dist)
            sources.append(Source(
                content=doc,
                source_file=meta.get("source_file", "unknown"),
                relevance_score=round(relevance, 3)
            ))

        return sources

    def _format_context(self, sources: List[Source]) -> str:
        """Format sources into context string for LLM.

        Args:
            sources: List of Source objects

        Returns:
            Formatted context string
        """
        if not sources:
            return "No relevant information found."

        context_parts = []
        for i, source in enumerate(sources, 1):
            context_parts.append(f"[{i}] {source.content}")

        return "\n\n".join(context_parts)

    def _build_prompt(self, question: str, context: str) -> str:
        """Build prompt for LLM generation.

        Args:
            question: User's question
            context: Retrieved context

        Returns:
            Formatted prompt string
        """
        return f"""Answer the question based on the following context. If the context doesn't contain enough information, say so.

Context:
{context}

Question: {question}

Answer concisely and cite sources by number when applicable."""

    def add_documents(self, chunks: List[Chunk]) -> int:
        """Add document chunks to the collection.

        Args:
            chunks: List of Chunk objects to add

        Returns:
            Number of chunks added
        """
        if not chunks:
            return 0

        # Generate embeddings
        texts = [c.content for c in chunks]
        embeddings = self.embedder.embed_batch(texts)

        # Deterministic IDs: the same file always maps to the same IDs, in any
        # process, so re-ingesting it overwrites instead of duplicating.
        ids = [self._chunk_id(c, i) for i, c in enumerate(chunks)]

        # Add to collection
        self._collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=[c.metadata for c in chunks]
        )

        logger.info(f"Added {len(chunks)} chunks to collection")
        return len(chunks)

    @staticmethod
    def _chunk_id(chunk: Chunk, index: int) -> str:
        """Build a chunk ID that is stable across processes and restarts.

        Args:
            chunk: The chunk to identify
            index: Position of the chunk in its document

        Returns:
            "<source_file>::<index>", or a content digest when the chunk has no source_file
        """
        source = chunk.metadata.get("source_file")
        if not source:
            source = hashlib.sha256(chunk.content.encode("utf-8")).hexdigest()[:16]
        return f"{source}::{index}"

    def get_indexed_files(self) -> Dict[str, str]:
        """List the knowledge base files currently stored in the collection.

        Returns:
            Dict mapping source_file to its content_hash ("" for chunks stored without one)
        """
        results = self._collection.get(
            where={"source_type": "knowledge_base"},
            include=["metadatas"]
        )

        indexed = {}
        for metadata in results.get("metadatas") or []:
            source_file = metadata.get("source_file")
            if source_file:
                indexed[source_file] = metadata.get("content_hash", "")
        return indexed

    def delete_document(self, source_file: str) -> None:
        """Remove every chunk of a document from the collection.

        Args:
            source_file: Source file whose chunks must be removed
        """
        self._collection.delete(where={"source_file": source_file})
        logger.info(f"Deleted chunks of {source_file}")

    def get_stats(self) -> Dict[str, Any]:
        """Get collection statistics.

        Returns:
            Dict with collection stats
        """
        return {
            "collection_name": self.config.CHROMA_COLLECTION_NAME,
            "document_count": self._collection.count()
        }

    @staticmethod
    def _breed_key(breed: str) -> str:
        """Normalize a breed name to the `breed:` frontmatter form ("Golden Retriever" -> "golden_retriever")."""
        return breed.strip().lower().replace("-", " ").replace(" ", "_")

    def _search(self, query: str, where: Dict[str, Any], n_results: int) -> List[Dict[str, Any]]:
        """Vector search restricted by metadata.

        The filter decides which documents are eligible (the breed, or the health
        documents of the species); the embedding only ranks inside them. Ranking the
        whole collection returned other breeds' chunks for most breeds.

        Args:
            query: Text to search for
            where: ChromaDB metadata filter
            n_results: Maximum number of chunks

        Returns:
            Chunks, best first: dicts with text, source_file, chunk_index, relevance
        """
        results = self._collection.query(
            query_embeddings=[self.embedder.embed(query)],
            n_results=n_results,
            where=where
        )
        if not results["ids"] or not results["ids"][0]:
            return []

        return [
            {
                "text": doc,
                "source_file": (metadata or {}).get("source_file", "unknown"),
                "chunk_index": (metadata or {}).get("chunk_index", 0),
                # Cosine distance: 1 - distance is the cosine similarity.
                "relevance": round(max(0.0, 1 - distance), 3)
            }
            for doc, metadata, distance in zip(
                results["documents"][0], results["metadatas"][0], results["distances"][0]
            )
        ]

    @staticmethod
    def _group_by_document(hits: List[Dict[str, Any]], max_documents: Optional[int] = None) -> Dict[str, Dict]:
        """Group retrieved chunks by document, best document first, chunks back in file order.

        Args:
            hits: Chunks from _search, best first
            max_documents: Keep only the best N documents (all when None)

        Returns:
            Dict mapping source_file to {"relevance": best chunk, "text": chunks joined}
        """
        documents: Dict[str, Dict] = {}
        for hit in hits:
            doc = documents.setdefault(hit["source_file"], {"relevance": hit["relevance"], "chunks": []})
            doc["chunks"].append((hit["chunk_index"], hit["text"]))

        kept = list(documents.items())[:max_documents]
        return {
            source_file: {
                "relevance": doc["relevance"],
                "text": "\n\n".join(text for _, text in sorted(doc["chunks"]))
            }
            for source_file, doc in kept
        }

    def _join(self, documents: Dict[str, Dict], budget: int) -> str:
        """Join documents under a shared character budget, so a long one cannot push the others out."""
        if not documents:
            return ""
        share = budget // len(documents)
        return "\n\n".join(doc["text"][:share] for doc in documents.values())

    def _build_context(
        self,
        breed_where: Dict[str, Any],
        breed_name: str,
        species: Optional[str],
        notes: Optional[str],
        breed: Optional[str],
        parent_breeds: Optional[List[str]]
    ) -> Optional[Dict[str, Any]]:
        """Retrieve what the vision LLM needs to know about a breed.

        Two filtered vector searches: the documents of the breed, and the health
        documents of the species that match the breed and the owner notes.

        Args:
            breed_where: Metadata filter selecting the documents of the breed
            breed_name: Breed as written in a query ("Golden Retriever")
            species: "dog" or "cat"; restricts the health documents when given
            notes: Optional owner notes, searched for the symptoms they describe
            breed: Display name of a purebred, None for a crossbreed
            parent_breeds: Parent breeds of a crossbreed, None for a purebred

        Returns:
            Context dict, or None when nothing was retrieved
        """
        breed_docs = self._group_by_document(self._search(
            f"{breed_name} breed characteristics, health and care",
            breed_where,
            self.config.RAG_BREED_TOP_K
        ))

        health_where: Dict[str, Any] = {"doc_type": "health"}
        if species:
            health_where = {"$and": [health_where, {"species": species}]}

        # One search per signal, so a long note does not drown the breed (and vice versa).
        # No relevance threshold: similarity scores of related and unrelated texts overlap,
        # so the LLM is the one that decides what applies.
        n_chunks = self.config.RAG_HEALTH_TOP_K * 4
        health_hits = self._search(f"{breed_name} common health problems", health_where, n_chunks)
        if notes:
            health_hits += self._search(notes, health_where, n_chunks)
        best = {}
        for hit in sorted(health_hits, key=lambda h: -h["relevance"]):
            best.setdefault((hit["source_file"], hit["chunk_index"]), hit)
        health_docs = self._group_by_document(list(best.values()), self.config.RAG_HEALTH_TOP_K)

        if not breed_docs and not health_docs:
            return None

        matches = sorted(
            (
                {"source": source_file, "relevance": doc["relevance"]}
                for source_file, doc in {**breed_docs, **health_docs}.items()
            ),
            key=lambda m: -m["relevance"]
        )

        return {
            "breed": breed,
            "parent_breeds": parent_breeds,
            "description": self._join(breed_docs, self.config.RAG_CONTEXT_MAX_CHARS),
            # Kept for the response schema: care is part of the breed documents.
            "care_summary": "",
            "health_info": self._join(health_docs, self.config.RAG_CONTEXT_MAX_CHARS // 2),
            "sources": [m["source"] for m in matches],
            "matches": matches
        }

    async def get_breed_context(
        self, breed: str, species: Optional[str] = None, notes: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Retrieve the knowledge base context of a single breed (purebred).

        Args:
            breed: Normalized breed name (e.g., "golden_retriever")
            species: "dog" or "cat"
            notes: Optional owner notes

        Returns:
            Context dict, or None when nothing was retrieved
        """
        display = breed.replace("_", " ").title()
        return self._build_context(
            {"breed": self._breed_key(breed)}, display, species, notes, display, None
        )

    async def get_crossbreed_context(
        self, parent_breeds: List[str], species: Optional[str] = None, notes: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Retrieve the knowledge base context of a crossbreed: the mix itself and its parents.

        Args:
            parent_breeds: List like ["Golden Retriever", "Poodle"]
            species: "dog" or "cat"
            notes: Optional owner notes

        Returns:
            Context dict, or None when nothing was retrieved
        """
        keys = [self._breed_key(breed) for breed in parent_breeds]

        # The mix (frontmatter `parent_breeds`, stored as "a, b") or either parent.
        where = {"$or": [
            {"parent_breeds": {"$in": [", ".join(keys), ", ".join(reversed(keys))]}},
            {"breed": {"$in": keys}}
        ]}
        return self._build_context(where, " and ".join(parent_breeds), species, notes, None, parent_breeds)
