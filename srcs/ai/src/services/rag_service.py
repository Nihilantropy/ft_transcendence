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

    async def enrich_breed(self, breed: str) -> Dict[str, Any]:
        """Get enriched information for a specific breed.

        Args:
            breed: Breed name (e.g., "Golden Retriever")

        Returns:
            Dict with description, care_summary, and sources
        """
        # Normalize breed name for filter
        breed_key = breed.lower().replace(" ", "_")

        # Query for breed-specific information
        response = await self.query(
            question=f"Summarize key facts, temperament, and care requirements for {breed}",
            filters={"breed": breed_key},
            top_k=3
        )

        # Handle no results
        if not response.sources:
            return {
                "description": "No detailed information available for this breed.",
                "care_summary": "Consult a veterinarian for breed-specific care advice.",
                "sources": []
            }

        # Extract care-related query
        care_response = await self.query(
            question=f"What are the care requirements and health considerations for {breed}?",
            filters={"breed": breed_key},
            top_k=2
        )

        return {
            "description": response.answer,
            "care_summary": care_response.answer,
            "sources": list(set(s.source_file for s in response.sources + care_response.sources))
        }

    async def get_breed_context(self, breed: str) -> Dict[str, Any]:
        """Retrieve context for a single breed (purebred).

        Args:
            breed: Normalized breed name (e.g., "golden_retriever")

        Returns:
            Dict with breed description, care, health info, sources
        """
        breed_display = breed.replace("_", " ").title()

        # Query ChromaDB
        query_text = f"{breed_display} breed characteristics health care requirements"
        query_embedding = self.embedder.embed_text(query_text)

        results = self._collection.query(
            query_embeddings=[query_embedding],
            n_results=5
        )

        # Extract sources
        sources = []
        if results["metadatas"] and len(results["metadatas"]) > 0:
            for metadata_list in results["metadatas"]:
                for metadata in metadata_list:
                    sources.append(metadata.get("source", "unknown"))

        # Extract documents
        documents = []
        if results["documents"] and len(results["documents"]) > 0:
            for doc_list in results["documents"]:
                documents.extend(doc_list)

        # Synthesize context from retrieved documents
        description = documents[0] if len(documents) >= 1 else "No information available"
        care_summary = documents[1] if len(documents) > 1 else "Standard care recommended"
        health_info = documents[2] if len(documents) > 2 else "Consult veterinarian for health information"

        return {
            "breed": breed_display,
            "parent_breeds": None,
            "description": description[:500],  # Limit length
            "care_summary": care_summary[:300],
            "health_info": health_info[:300],
            "sources": list(set(sources))  # Deduplicate
        }

    async def get_crossbreed_context(self, parent_breeds: List[str]) -> Dict[str, Any]:
        """Retrieve context for crossbreed parent breeds.

        Args:
            parent_breeds: List like ["Golden Retriever", "Poodle"]

        Returns:
            Dict with combined breed context
        """
        all_documents = []
        all_sources = []

        # Query for each parent breed
        for breed in parent_breeds:
            query_text = f"{breed} breed characteristics health care requirements"
            query_embedding = self.embedder.embed_text(query_text)

            results = self._collection.query(
                query_embeddings=[query_embedding],
                n_results=3
            )

            # Collect documents
            if results["documents"] and len(results["documents"]) > 0:
                for doc_list in results["documents"]:
                    all_documents.extend(doc_list)

            # Collect sources
            if results["metadatas"] and len(results["metadatas"]) > 0:
                for metadata_list in results["metadatas"]:
                    for metadata in metadata_list:
                        all_sources.append(metadata.get("source", "unknown"))

        # Combine contexts
        description = " ".join(all_documents[:3]) if len(all_documents) >= 3 else " ".join(all_documents)
        care_summary = " ".join(all_documents[3:5]) if len(all_documents) > 3 else "Standard care recommended"
        health_info = " ".join(all_documents[5:7]) if len(all_documents) > 5 else "Consult veterinarian for health information"

        return {
            "breed": None,
            "parent_breeds": parent_breeds,
            "description": description[:500],
            "care_summary": care_summary[:300],
            "health_info": health_info[:300],
            "sources": list(set(all_sources))
        }
