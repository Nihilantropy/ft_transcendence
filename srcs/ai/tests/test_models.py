import pytest
from pydantic import ValidationError
from src.models.requests import VisionAnalysisRequest, VisionAnalysisOptions, RAGQueryRequest, RAGIngestRequest
from src.models.responses import BreedTraits, VisionAnalysisData, VisionAnalysisResponse, RAGQueryResponse, RAGSourceData, RAGIngestResponse, RAGStatusResponse

class TestRequestModels:
    def test_vision_analysis_request_valid(self):
        """Test valid vision analysis request."""
        request = VisionAnalysisRequest(
            image="data:image/jpeg;base64,/9j/4AAQSkZJRg==",
            options=VisionAnalysisOptions(return_traits=True)
        )

        assert request.image.startswith("data:image/")
        assert request.options.return_traits is True

    def test_vision_analysis_request_invalid_image(self):
        """Test invalid image format raises error."""
        with pytest.raises(ValidationError) as exc_info:
            VisionAnalysisRequest(image="not-a-data-uri")

        assert "Image must be a data URI" in str(exc_info.value)

    def test_vision_analysis_options_defaults(self):
        """Test default options."""
        options = VisionAnalysisOptions()

        assert options.return_traits is True
        assert options.return_health_info is True

class TestResponseModels:
    def test_breed_traits_valid(self):
        """Test breed traits model."""
        traits = BreedTraits(
            size="large",
            energy_level="high",
            temperament="friendly"
        )

        assert traits.size == "large"
        assert traits.energy_level == "high"

    def test_vision_analysis_data_valid(self):
        """Test vision analysis data model."""
        data = VisionAnalysisData(
            breed="Golden Retriever",
            confidence=0.92,
            traits=BreedTraits(size="large", energy_level="high", temperament="friendly"),
            health_considerations=["Hip dysplasia"],
            note=None
        )

        assert data.breed == "Golden Retriever"
        assert data.confidence == 0.92
        assert data.note is None

    def test_vision_analysis_data_confidence_validation(self):
        """Test confidence must be 0.0-1.0."""
        with pytest.raises(ValidationError):
            VisionAnalysisData(
                breed="Test",
                confidence=1.5,  # Invalid
                traits=BreedTraits(size="medium", energy_level="medium", temperament="test"),
                health_considerations=[]
            )


class TestRAGModels:
    def test_rag_query_request_valid(self):
        """Test valid RAG query request."""
        request = RAGQueryRequest(
            question="What health issues affect Golden Retrievers?",
            filters={"species": "dog", "breed": "golden_retriever"},
            top_k=5
        )
        assert request.question == "What health issues affect Golden Retrievers?"
        assert request.filters["breed"] == "golden_retriever"
        assert request.top_k == 5

    def test_rag_query_request_defaults(self):
        """Test RAG query request has sensible defaults."""
        request = RAGQueryRequest(question="General question")
        assert request.filters is None
        assert request.top_k == 5

    def test_rag_query_request_empty_question_fails(self):
        """Test empty question raises validation error."""
        with pytest.raises(ValueError):
            RAGQueryRequest(question="")

    def test_rag_ingest_request_valid(self):
        """Test valid RAG ingest request."""
        request = RAGIngestRequest(
            content="# Golden Retriever\n\nFriendly dogs...",
            metadata={"doc_type": "breed", "species": "dog"},
            source_name="golden_retriever.md"
        )
        assert "Golden Retriever" in request.content
        assert request.metadata["doc_type"] == "breed"

    def test_rag_source_data_structure(self):
        """Test RAGSourceData has required fields."""
        source = RAGSourceData(
            content="Some content",
            source_file="breeds/dog.md",
            relevance_score=0.89
        )
        assert source.content == "Some content"
        assert source.relevance_score == 0.89

    def test_rag_query_response_structure(self):
        """Test RAGQueryResponse structure."""
        source = RAGSourceData(
            content="Test",
            source_file="test.md",
            relevance_score=0.9
        )
        data = RAGQueryResponse(
            answer="The answer is...",
            sources=[source],
            model="qwen3-vl:8b"
        )
        assert data.answer == "The answer is..."
        assert len(data.sources) == 1
