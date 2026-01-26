"""RAG service for retrieval-augmented generation."""

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
        self._collection = self._chroma_client.get_or_create_collection(
            name=config.CHROMA_COLLECTION_NAME
        )

        logger.info(f"Initialized RAG service with collection: {config.CHROMA_COLLECTION_NAME}")

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
            model=self.config.OLLAMA_MODEL
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

        # Generate IDs
        ids = [f"chunk_{i}_{hash(c.content) % 10000}" for i, c in enumerate(chunks)]

        # Add to collection
        self._collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=[c.metadata for c in chunks]
        )

        logger.info(f"Added {len(chunks)} chunks to collection")
        return len(chunks)

    def get_stats(self) -> Dict[str, Any]:
        """Get collection statistics.

        Returns:
            Dict with collection stats
        """
        return {
            "collection_name": self.config.CHROMA_COLLECTION_NAME,
            "document_count": self._collection.count()
        }
