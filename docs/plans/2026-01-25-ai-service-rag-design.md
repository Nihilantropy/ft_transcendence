# AI Service Phase 2: RAG System Design

**Date:** 2026-01-25
**Status:** Draft
**Author:** Brainstorming session

---

## 1. Overview

### Purpose

Implement a Retrieval-Augmented Generation (RAG) system for the SmartBreeds AI Service to provide:

1. **Pet health Q&A chatbot** - Users ask questions like "What should I feed my Golden Retriever?" and get answers grounded in veterinary knowledge
2. **Enhanced breed analysis** - After vision identifies a breed, RAG retrieves detailed breed-specific information (care guides, common health issues, temperament details)
3. **Product recommendation explanations** - RAG generates natural language explanations for why certain products suit specific breeds

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Minimal (ChromaDB + sentence-transformers) | Matches existing direct-Ollama style, full control, minimal dependencies |
| Vector Store | ChromaDB (embedded) | No separate container, runs in-process, sufficient for scale |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) | 384 dimensions, fast, good quality, runs locally |
| LLM | qwen3-vl:8b (existing) | Reuse current model, handles text-only prompts fine, no model switching overhead |
| Ingestion | Auto-sync + Admin API | Easy dev workflow with production-ready API control |
| Vision integration | Configurable (`enrich` parameter) | Frontend controls speed vs richness per request |
| MCP Tools | Future enhancement | Start with RAG, add MCP tools later for external sources |

---

## 2. Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI Service                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Vision    │  │   RAG       │  │   Recommendations       │  │
│  │   Route     │  │   Route     │  │   Route (Phase 3)       │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                     │                 │
│         └────────────────┼─────────────────────┘                 │
│                          │                                       │
│                          ▼                                       │
│                 ┌─────────────────┐                              │
│                 │   RAG Service   │                              │
│                 │  (orchestrator) │                              │
│                 └────────┬────────┘                              │
│                          │                                       │
│         ┌────────────────┼────────────────┐                      │
│         ▼                ▼                ▼                      │
│  ┌────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │  Embedder  │  │  ChromaDB   │  │   Ollama    │               │
│  │ (sentence- │  │  (vector    │  │   (LLM)     │               │
│  │ transformers)│ │   store)    │  │             │               │
│  └────────────┘  └─────────────┘  └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

### Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERACTIONS                         │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐        ┌──────────────┐
   │  Vision  │        │  Chat    │        │ Product Recs │
   │ Analysis │        │  Q&A     │        │              │
   └────┬─────┘        └────┬─────┘        └──────┬───────┘
        │                   │                     │
        ▼                   ▼                     ▼
   breed_id +          user question        breed_id +
   confidence                               user preferences
        │                   │                     │
        └───────────────────┼─────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   RAG Query   │
                    │  (ChromaDB)   │
                    └───────┬───────┘
                            │
                            ▼
                    Retrieved context
                    (breed info, health
                    guides, care tips)
                            │
                            ▼
                    ┌───────────────┐
                    │  Ollama LLM   │
                    │ qwen3-vl:8b   │
                    └───────────────┘
```

### Ollama Model Strategy

```
Ollama:
  - qwen3-vl:8b → Vision analysis (with image)
  - qwen3-vl:8b → RAG text generation (text-only, same model)
  - Future: potentially add specialized text model if needed
```

**Rationale:** Vision-language models handle text-only prompts fine. For RAG, the task is mainly "synthesize retrieved chunks into coherent answer" - not heavy reasoning. Single model avoids switching overhead and keeps VRAM usage low.

---

## 3. Data Model & Storage

### ChromaDB Collection Structure

```python
# Single collection with metadata filtering
Collection: "pet_knowledge"

Document Schema:
{
    "id": "breed_golden_retriever_health_001",  # Unique chunk ID
    "content": "Golden Retrievers are prone to hip dysplasia...",  # Text chunk
    "metadata": {
        "source_file": "breeds/dogs/golden_retriever.md",
        "doc_type": "breed",           # breed | health | care_guide
        "species": "dog",              # dog | cat | null (general)
        "breed": "golden_retriever",   # null if not breed-specific
        "topics": ["health", "joints", "genetics"],
        "chunk_index": 3,              # Position in original doc
        "updated_at": "2026-01-25T10:00:00Z"
    }
}
```

**Why single collection with metadata filtering:**
- Simpler than multiple collections
- ChromaDB supports efficient metadata filtering (`where={"breed": "golden_retriever"}`)
- Allows cross-topic queries ("health issues for large dogs")

### Storage Layout

```
srcs/ai/
├── data/
│   ├── knowledge_base/          # Source documents (git-tracked)
│   │   ├── breeds/dogs/*.md
│   │   ├── breeds/cats/*.md
│   │   ├── health/*.md
│   │   └── care_guides/*.md
│   └── chroma/                  # Vector DB (Docker volume, NOT git-tracked)
│       └── pet_knowledge/
```

### Document Format (Markdown with Frontmatter)

```markdown
---
doc_type: breed
species: dog
breed: golden_retriever
topics: [health, temperament, care, nutrition]
---

# Golden Retriever

## Overview
Golden Retrievers are friendly, intelligent dogs...

## Health Considerations
- **Hip Dysplasia**: Common in large breeds...
- **Cancer**: Higher risk than average...

## Care Requirements
...
```

---

## 4. API Endpoints

### New RAG Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/rag/query` | Ask questions, get RAG-augmented answers |
| POST | `/api/v1/rag/ingest` | Admin: add documents at runtime |
| GET | `/api/v1/rag/status` | Health check: collection stats |

### Updated Vision Endpoint

| Method | Endpoint | Change |
|--------|----------|--------|
| POST | `/api/v1/vision/analyze` | Add `enrich` option |

---

### RAG Query Endpoint

```
POST /api/v1/rag/query

Request:
{
    "question": "What health issues affect Golden Retrievers?",
    "filters": {                    // Optional metadata filters
        "species": "dog",
        "breed": "golden_retriever" // null = search all breeds
    },
    "top_k": 5                      // Number of chunks to retrieve
}

Response:
{
    "success": true,
    "data": {
        "answer": "Golden Retrievers are prone to several health conditions...",
        "sources": [
            {
                "content": "Hip dysplasia is common in Golden Retrievers...",
                "source_file": "breeds/dogs/golden_retriever.md",
                "relevance_score": 0.89
            },
            ...
        ],
        "model": "qwen3-vl:8b"
    },
    "timestamp": "2026-01-25T12:00:00Z"
}
```

### Vision Analyze (Updated)

```
POST /api/v1/vision/analyze

Request:
{
    "image": "data:image/jpeg;base64,...",
    "options": {
        "return_traits": true,
        "return_health_info": true,
        "enrich": true              // NEW: fetch RAG context
    }
}

Response (with enrich=true):
{
    "success": true,
    "data": {
        "breed": "Golden Retriever",
        "confidence": 0.92,
        "traits": {...},
        "health_considerations": ["Hip dysplasia", "Cancer risk"],
        "enriched_info": {          // NEW: RAG-augmented details
            "description": "Golden Retrievers are friendly...",
            "care_summary": "Require daily exercise...",
            "sources": ["breeds/dogs/golden_retriever.md"]
        }
    }
}
```

### Ingest Endpoint (Admin)

```
POST /api/v1/rag/ingest

Request:
{
    "content": "# Dental Care for Dogs\n\nRegular brushing...",
    "metadata": {
        "doc_type": "health",
        "species": "dog",
        "topics": ["dental", "care"]
    },
    "source_name": "dental_care.md"  // For tracking
}

Response:
{
    "success": true,
    "data": {
        "chunks_created": 4,
        "document_id": "health_dental_care"
    }
}
```

---

## 5. Service Implementation

### File Structure

```
srcs/ai/src/
├── services/
│   ├── ollama_client.py        # Existing (vision)
│   ├── image_processor.py      # Existing
│   ├── rag_service.py          # NEW: RAG orchestrator
│   ├── embedder.py             # NEW: sentence-transformers wrapper
│   └── document_processor.py   # NEW: chunking & metadata extraction
├── routes/
│   ├── vision.py               # Update: add enrich option
│   └── rag.py                  # NEW: query, ingest, status endpoints
└── models/
    ├── requests.py             # Update: add RAG request models
    └── responses.py            # Update: add RAG response models
```

### RAG Service (Core Orchestrator)

```python
class RAGService:
    def __init__(self, embedder, chroma_client, ollama_client):
        self.embedder = embedder
        self.collection = chroma_client.get_collection("pet_knowledge")
        self.ollama = ollama_client

    async def query(self, question: str, filters: dict, top_k: int) -> RAGResponse:
        # 1. Embed the question
        query_embedding = self.embedder.embed(question)

        # 2. Search ChromaDB
        results = self.collection.query(
            query_embeddings=[query_embedding],
            where=filters,  # {"breed": "golden_retriever"}
            n_results=top_k
        )

        # 3. Build prompt with retrieved context
        context = self._format_context(results)
        prompt = f"""Answer based on this context:

{context}

Question: {question}

Answer concisely and cite sources when possible."""

        # 4. Generate answer via Ollama
        answer = await self.ollama.generate(prompt)

        return RAGResponse(answer=answer, sources=results)

    async def enrich_breed(self, breed: str) -> EnrichedInfo:
        # Targeted query for breed-specific info
        return await self.query(
            question=f"Summarize key facts about {breed}",
            filters={"breed": breed.lower().replace(" ", "_")},
            top_k=3
        )
```

### Document Processor (Chunking)

```python
class DocumentProcessor:
    CHUNK_SIZE = 500      # tokens
    CHUNK_OVERLAP = 50    # tokens overlap for context continuity

    def process(self, content: str, metadata: dict) -> List[Chunk]:
        # 1. Parse frontmatter (YAML header)
        doc_metadata, body = self._parse_frontmatter(content)
        merged_metadata = {**doc_metadata, **metadata}

        # 2. Split by headers first (preserve semantic units)
        sections = self._split_by_headers(body)

        # 3. Chunk large sections with overlap
        chunks = []
        for section in sections:
            chunks.extend(self._chunk_text(section, self.CHUNK_SIZE, self.CHUNK_OVERLAP))

        # 4. Attach metadata to each chunk
        return [Chunk(content=c, metadata=merged_metadata) for c in chunks]
```

### Embedder Service

```python
from sentence_transformers import SentenceTransformer

class Embedder:
    MODEL_NAME = "all-MiniLM-L6-v2"  # 384 dimensions

    def __init__(self):
        self.model = SentenceTransformer(self.MODEL_NAME)

    def embed(self, text: str) -> List[float]:
        return self.model.encode(text).tolist()

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return self.model.encode(texts).tolist()
```

---

## 6. Initialization & Auto-Sync

### Startup Sequence

```python
# main.py lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize embedder (loads model into memory)
    embedder = Embedder()

    # 2. Initialize ChromaDB (persistent storage)
    chroma_client = chromadb.PersistentClient(path="./data/chroma")
    collection = chroma_client.get_or_create_collection("pet_knowledge")

    # 3. Auto-sync knowledge base (on startup)
    doc_processor = DocumentProcessor()
    await sync_knowledge_base(
        knowledge_dir="./data/knowledge_base",
        collection=collection,
        embedder=embedder,
        doc_processor=doc_processor
    )

    # 4. Initialize RAG service
    rag_service = RAGService(embedder, chroma_client, ollama_client)
    app.state.rag_service = rag_service

    yield

    # Cleanup (if needed)
```

### Auto-Sync Logic

```python
async def sync_knowledge_base(knowledge_dir, collection, embedder, doc_processor):
    """Sync filesystem documents to ChromaDB on startup."""

    for filepath in Path(knowledge_dir).rglob("*.md"):
        # Check if document needs re-indexing
        doc_id = generate_doc_id(filepath)
        file_mtime = filepath.stat().st_mtime

        existing = collection.get(where={"source_file": str(filepath)})
        if existing and existing_is_current(existing, file_mtime):
            continue  # Skip unchanged files

        # Process and index document
        content = filepath.read_text()
        chunks = doc_processor.process(content, {"source_file": str(filepath)})

        # Delete old chunks, add new ones
        collection.delete(where={"source_file": str(filepath)})
        collection.add(
            ids=[f"{doc_id}_{i}" for i in range(len(chunks))],
            documents=[c.content for c in chunks],
            embeddings=embedder.embed_batch([c.content for c in chunks]),
            metadatas=[c.metadata for c in chunks]
        )

    logger.info(f"Knowledge base synced: {collection.count()} chunks indexed")
```

---

## 7. Dependencies

### New Requirements

```txt
# Add to requirements.txt

# Vector Store
chromadb==1.4.1

# Embeddings
sentence-transformers==5.2.0

# Document Processing
pyyaml==6.0.1           # Frontmatter parsing
tiktoken==0.12.0        # Token counting for chunking
```

### Docker Considerations

- ChromaDB runs embedded (no separate container)
- sentence-transformers downloads model on first run (~90MB)
- Add volume mount for ChromaDB persistence:

```yaml
# docker-compose.yml
ai-service:
  volumes:
    - ./srcs/ai/src:/app/src
    - ./srcs/ai/data/knowledge_base:/app/data/knowledge_base:ro
    - ai-chroma-data:/app/data/chroma  # Persistent volume

volumes:
  ai-chroma-data:
```

---

## 8. Future Enhancements

### MCP Tools Integration (Future)

When ready to add external data sources:

```
┌─────────────────┐
│   LLM Router    │ ← Decides retrieval strategy
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐  ┌─────────┐
│  RAG  │  │MCP Tools│
│       │  │         │
│Breed  │  │• PubMed │
│guides │  │• Product│
│Health │  │  catalog│
│FAQs   │  │• Papers │
└───┬───┘  └────┬────┘
    │           │
    └─────┬─────┘
          ▼
   Combined Context
```

### DeepSeek-OCR Integration (Future - Contexts Optical Compression)

**Reference:** [DeepSeek-OCR Paper](https://github.com/deepseek-ai/DeepSeek-OCR) - "Contexts Optical Compression"

**What it is:** A vision-language model that compresses text into vision tokens by rendering text to images. Achieves 7-20× compression with high fidelity (97% precision at <10× compression, ~60% at 20×).

**Why it's beneficial for SmartBreeds:**

| Use Case | Benefit | Impact |
|----------|---------|--------|
| Chat history compression | Render older conversation rounds to images, progressively downsample | 10-20× context savings per user session |
| Scientific PDF ingestion | Directly process veterinary research papers, breed studies | Richer knowledge base without manual extraction |
| Vet record analysis | Users upload scanned vet records, prescriptions | Enhanced personalized health recommendations |
| Memory-efficient RAG | Store knowledge chunks as compressed vision tokens | Larger knowledge base in same VRAM budget |

**Architecture Integration:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Future AI Service with DeepSeek-OCR              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐     ┌──────────────────┐                     │
│  │   User Chat      │     │   Document       │                     │
│  │   Session        │     │   Upload         │                     │
│  └────────┬─────────┘     └────────┬─────────┘                     │
│           │                        │                               │
│           ▼                        ▼                               │
│  ┌──────────────────┐     ┌──────────────────┐                     │
│  │  Chat History    │     │   DeepSeek-OCR   │                     │
│  │  Compressor      │     │   Ingestion      │                     │
│  │                  │     │                  │                     │
│  │ Recent: text     │     │ PDF → vision     │                     │
│  │ Older: 640×640   │     │ tokens (100-800  │                     │
│  │ Ancient: 512×512 │     │ per page)        │                     │
│  └────────┬─────────┘     └────────┬─────────┘                     │
│           │                        │                               │
│           └────────────┬───────────┘                               │
│                        ▼                                           │
│              ┌──────────────────┐                                  │
│              │   DeepEncoder    │  ← 380M params                   │
│              │   (SAM + CLIP)   │    (can run on same GPU)         │
│              └────────┬─────────┘                                  │
│                       │                                            │
│                       ▼                                            │
│              ┌──────────────────┐                                  │
│              │   Compressed     │                                  │
│              │   Vision Tokens  │                                  │
│              │   (64-400 per    │                                  │
│              │    context unit) │                                  │
│              └────────┬─────────┘                                  │
│                       │                                            │
│                       ▼                                            │
│              ┌──────────────────┐                                  │
│              │   LLM Generation │  ← qwen3-vl or DeepSeek decoder  │
│              └──────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────┘
```

**"Forgetting Mechanism" for Chat History:**

Inspired by human memory decay - recent information stays clear, older fades:

```
Conversation Timeline:
├── Current turn      → Full text tokens (no compression)
├── 1-3 turns ago     → Text tokens (no compression)
├── 4-10 turns ago    → Rendered to 1280×1280 → 400 vision tokens (~3× compression)
├── 11-20 turns ago   → Rendered to 640×640 → 100 vision tokens (~10× compression)
└── 21+ turns ago     → Rendered to 512×512 → 64 vision tokens (~15× compression)

Result: Theoretically unlimited conversation history with graceful degradation
```

**Concrete Example - Scientific PDF Ingestion:**

```python
# Future: Ingest veterinary research paper
async def ingest_scientific_pdf(pdf_path: str) -> IngestResult:
    """
    Instead of: PDF → text extraction → chunking → 6000+ tokens/page
    With DeepSeek-OCR: PDF → vision encoding → 100-800 tokens/page

    A 50-page veterinary study on Golden Retriever hip dysplasia:
    - Traditional: ~300,000 text tokens
    - DeepSeek-OCR: ~25,000 vision tokens (12× compression)
    """
    pages = render_pdf_to_images(pdf_path, dpi=200)

    for page_img in pages:
        # DeepEncoder compresses page to vision tokens
        vision_tokens = deep_encoder.encode(page_img, mode="gundam")  # ~800 tokens

        # Store in ChromaDB with vision token embeddings
        collection.add(
            embeddings=vision_tokens,
            metadatas={"source": pdf_path, "page": page_num, "type": "scientific"}
        )
```

**Implementation Considerations:**

| Aspect | Approach |
|--------|----------|
| Model hosting | DeepEncoder (380M) can share GPU with qwen3-vl; or use CPU for encoding |
| Decoder choice | Can use existing qwen3-vl OR switch to DeepSeek3B-MoE (570M activated) |
| Gradual rollout | Start with PDF ingestion only, then add chat compression |
| Fallback | Keep text-based RAG as fallback for precision-critical queries |

**When to Implement:**

Triggers for adding DeepSeek-OCR:
1. Knowledge base exceeds 10,000 documents
2. Users request vet record upload feature
3. Chat sessions regularly exceed 20 turns
4. Need to ingest scientific literature at scale

**Resources:**
- GitHub: https://github.com/deepseek-ai/DeepSeek-OCR
- Model weights: Publicly available (Tiny/Small/Base/Large/Gundam variants)
- VRAM: ~2-4GB for DeepEncoder depending on resolution mode

---

### Other Enhancements

- Response caching by question hash (Redis)
- Feedback loop for answer quality improvement
- A/B testing for different prompts
- Analytics on popular queries

---

## 9. Testing Strategy

### Unit Tests

- `test_embedder.py` - Embedding generation
- `test_document_processor.py` - Chunking, frontmatter parsing
- `test_rag_service.py` - Query flow with mocked ChromaDB

### Integration Tests

- `test_integration_rag.py` - Full RAG pipeline with real ChromaDB
- `test_integration_vision_enrich.py` - Vision + RAG enrichment

### Test Data

```
srcs/ai/tests/fixtures/
├── sample_breed.md        # Test document
├── sample_health.md       # Test document
└── test_knowledge_base/   # Mini knowledge base for tests
```

---

## 10. Open Questions

1. **Initial content**: What breed/health documents to seed the knowledge base with?
2. **Rate limiting**: Should RAG queries have separate rate limits from vision?
3. **Caching**: Cache RAG responses by question hash?
4. **Monitoring**: What metrics to track (query latency, retrieval relevance)?

---

## 11. Next Steps

1. Review and approve this design
2. Create implementation plan with TDD approach
3. Set up git worktree for isolated development
4. Implement in phases:
   - Phase 2a: Core RAG (embedder, ChromaDB, document processor)
   - Phase 2b: RAG endpoints (query, ingest, status)
   - Phase 2c: Vision enrichment integration
