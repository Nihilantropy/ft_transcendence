from datetime import datetime
from src.utils.responses import success_response, error_response

def test_success_response():
    """Test success response format."""
    data = {"breed": "Golden Retriever", "confidence": 0.92}
    response = success_response(data)

    assert response["success"] is True
    assert response["data"] == data
    assert response["error"] is None
    assert "timestamp" in response
    assert response["timestamp"].endswith("Z")

def test_error_response():
    """Test error response format."""
    response = error_response(
        code="TEST_ERROR",
        message="Test error message",
        details={"field": "value"}
    )

    assert response["success"] is False
    assert response["data"] is None
    assert response["error"]["code"] == "TEST_ERROR"
    assert response["error"]["message"] == "Test error message"
    assert response["error"]["details"] == {"field": "value"}
    assert "timestamp" in response

def test_error_response_without_details():
    """Test error response without details."""
    response = error_response(
        code="SIMPLE_ERROR",
        message="Simple error"
    )

    assert response["error"]["details"] == {}
