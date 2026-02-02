import pytest
from src.utils.responses import success_response, error_response

@pytest.mark.unit
def test_success_response_structure():
    data = {"message": "Success"}
    response = success_response(data)
    assert response["success"] is True
    assert response["data"] == data
    assert response["error"] is None
    assert "timestamp" in response

@pytest.mark.unit
def test_error_response_structure():
    response = error_response("NOT_FOUND", "Resource not found", {"resource_id": 123})
    assert response["success"] is False
    assert response["error"]["code"] == "NOT_FOUND"
