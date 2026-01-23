import pytest
from pydantic import ValidationError
from src.models.requests import VisionAnalysisRequest, VisionAnalysisOptions
from src.models.responses import BreedTraits, VisionAnalysisData, VisionAnalysisResponse

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
