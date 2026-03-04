"""Tests for OllamaVisionClient — analyze_breed, generate, parse, crossbreed logic."""
import pytest
from unittest.mock import AsyncMock, Mock, patch
import httpx

from src.services.ollama_client import OllamaVisionClient
from src.config import Settings


@pytest.fixture
def client():
    settings = Settings(
        OLLAMA_BASE_URL="http://test-ollama:11434",
        OLLAMA_MODEL="qwen3-vl:8b",
        OLLAMA_TIMEOUT=300,
        OLLAMA_TEMPERATURE=0.1,
    )
    return OllamaVisionClient(settings)


def _make_mock_http_client(response_content: str):
    mock_response = Mock()
    mock_response.json.return_value = {"message": {"content": response_content}}
    mock_response.raise_for_status = Mock()
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    return mock_client


# --- analyze_breed ---

@pytest.mark.asyncio
async def test_analyze_breed_standard_success(client):
    content = '{"breed": "Golden Retriever", "confidence": 0.85, "traits": {"size": "large", "energy_level": "high", "temperament": "friendly"}, "health_considerations": ["hip dysplasia"]}'
    mock_http = _make_mock_http_client(content)
    with patch('src.services.ollama_client.httpx.AsyncClient', return_value=mock_http):
        result = await client.analyze_breed("/9j/test", detect_crossbreed=False)
    assert result["breed"] == "Golden Retriever"
    assert result["confidence"] == 0.85


@pytest.mark.asyncio
async def test_analyze_breed_strips_data_uri_prefix(client):
    content = '{"breed": "Poodle", "confidence": 0.90, "traits": {"size": "medium", "energy_level": "high", "temperament": "intelligent"}, "health_considerations": []}'
    mock_http = _make_mock_http_client(content)
    with patch('src.services.ollama_client.httpx.AsyncClient', return_value=mock_http):
        await client.analyze_breed("data:image/jpeg;base64,/9j/test", detect_crossbreed=False)
    images = mock_http.post.call_args[1]["json"]["messages"][0]["images"]
    assert images[0] == "/9j/test"


@pytest.mark.asyncio
async def test_analyze_breed_low_confidence_adds_note(client):
    content = '{"breed": "Unknown", "confidence": 0.25, "traits": {"size": "medium", "energy_level": "low", "temperament": "calm"}, "health_considerations": []}'
    mock_http = _make_mock_http_client(content)
    with patch('src.services.ollama_client.httpx.AsyncClient', return_value=mock_http):
        result = await client.analyze_breed("/9j/test", detect_crossbreed=False)
    assert "note" in result
    assert "Low confidence" in result["note"]


@pytest.mark.asyncio
async def test_analyze_breed_high_confidence_no_note(client):
    content = '{"breed": "Labrador Retriever", "confidence": 0.95, "traits": {"size": "large", "energy_level": "high", "temperament": "playful"}, "health_considerations": []}'
    mock_http = _make_mock_http_client(content)
    with patch('src.services.ollama_client.httpx.AsyncClient', return_value=mock_http):
        result = await client.analyze_breed("/9j/test", detect_crossbreed=False)
    assert "note" not in result


@pytest.mark.asyncio
async def test_analyze_breed_crossbreed_mode(client):
    content = '{"breed_probabilities": [{"breed": "Golden Retriever", "probability": 0.55}, {"breed": "Poodle", "probability": 0.40}], "traits": {"size": "medium", "energy_level": "high", "temperament": "friendly"}, "health_considerations": []}'
    mock_http = _make_mock_http_client(content)
    with patch('src.services.ollama_client.httpx.AsyncClient', return_value=mock_http):
        result = await client.analyze_breed("/9j/test", detect_crossbreed=True)
    assert "breed_analysis" in result
    assert result["breed_analysis"]["is_likely_crossbreed"] is True


@pytest.mark.asyncio
async def test_analyze_breed_uses_crossbreed_prompt_when_requested(client):
    content = '{"breed_probabilities": [{"breed": "Labrador Retriever", "probability": 0.80}], "traits": {"size": "large", "energy_level": "high", "temperament": "friendly"}, "health_considerations": []}'
    mock_http = _make_mock_http_client(content)
    with patch('src.services.ollama_client.httpx.AsyncClient', return_value=mock_http):
        await client.analyze_breed("/9j/test", detect_crossbreed=True, top_n_breeds=3)
    prompt = mock_http.post.call_args[1]["json"]["messages"][0]["content"]
    assert "TOP 3" in prompt


@pytest.mark.asyncio
async def test_analyze_breed_uses_standard_prompt_when_not_crossbreed(client):
    content = '{"breed": "Beagle", "confidence": 0.80, "traits": {"size": "small", "energy_level": "high", "temperament": "curious"}, "health_considerations": []}'
    mock_http = _make_mock_http_client(content)
    with patch('src.services.ollama_client.httpx.AsyncClient', return_value=mock_http):
        await client.analyze_breed("/9j/test", detect_crossbreed=False)
    prompt = mock_http.post.call_args[1]["json"]["messages"][0]["content"]
    assert "breed name or Unknown" in prompt


@pytest.mark.asyncio
async def test_analyze_breed_http_error_raises_connection_error(client):
    with patch('src.services.ollama_client.httpx.AsyncClient') as mock_cls:
        mock_instance = AsyncMock()
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=None)
        mock_instance.post = AsyncMock(side_effect=httpx.HTTPError("Connection failed"))
        mock_cls.return_value = mock_instance
        with pytest.raises(ConnectionError, match="Failed to connect"):
            await client.analyze_breed("/9j/test", detect_crossbreed=False)


# --- _parse_response ---

def test_parse_response_valid_json(client):
    result = client._parse_response('{"breed": "Poodle", "confidence": 0.9}')
    assert result["breed"] == "Poodle"


def test_parse_response_markdown_code_block(client):
    content = '```json\n{"breed": "Poodle", "confidence": 0.9}\n```'
    result = client._parse_response(content)
    assert result["breed"] == "Poodle"


def test_parse_response_invalid_json_raises(client):
    with pytest.raises(RuntimeError, match="Failed to parse"):
        client._parse_response("this is definitely not json")


# --- _process_crossbreed_result ---

def test_process_crossbreed_result_empty_probs_returns_fallback(client):
    result = client._process_crossbreed_result({
        "breed_probabilities": [],
        "traits": {},
        "health_considerations": []
    })
    assert result["breed_analysis"]["primary_breed"] == "Unknown"
    assert result["breed_analysis"]["is_likely_crossbreed"] is True
    assert result["breed_analysis"]["confidence"] == 0.0


def test_process_crossbreed_result_purebred_high_confidence(client):
    result = client._process_crossbreed_result({
        "breed_probabilities": [
            {"breed": "Golden Retriever", "probability": 0.90},
            {"breed": "Labrador", "probability": 0.05}
        ],
        "traits": {"size": "large", "energy_level": "high", "temperament": "friendly"},
        "health_considerations": []
    })
    assert result["breed_analysis"]["is_likely_crossbreed"] is False
    assert result["breed_analysis"]["primary_breed"] == "Golden Retriever"


def test_process_crossbreed_result_detects_crossbreed_high_second(client):
    result = client._process_crossbreed_result({
        "breed_probabilities": [
            {"breed": "Golden Retriever", "probability": 0.55},
            {"breed": "Poodle", "probability": 0.40}
        ],
        "traits": {"size": "medium", "energy_level": "high", "temperament": "friendly"},
        "health_considerations": []
    })
    assert result["breed_analysis"]["is_likely_crossbreed"] is True
    assert result["breed_analysis"]["crossbreed_analysis"] is not None


def test_process_crossbreed_result_known_crossbreed_name(client):
    result = client._process_crossbreed_result({
        "breed_probabilities": [
            {"breed": "Golden Retriever", "probability": 0.55},
            {"breed": "Poodle", "probability": 0.40}
        ],
        "traits": {},
        "health_considerations": []
    })
    assert result["breed_analysis"]["crossbreed_analysis"]["common_name"] == "Goldendoodle"


def test_process_crossbreed_result_single_breed(client):
    result = client._process_crossbreed_result({
        "breed_probabilities": [
            {"breed": "Beagle", "probability": 0.80}
        ],
        "traits": {"size": "small", "energy_level": "high", "temperament": "curious"},
        "health_considerations": []
    })
    assert result["breed_analysis"]["primary_breed"] == "Beagle"
    assert result["breed_analysis"]["is_likely_crossbreed"] is False


def test_process_crossbreed_result_crossbreed_average_confidence(client):
    result = client._process_crossbreed_result({
        "breed_probabilities": [
            {"breed": "Golden Retriever", "probability": 0.55},
            {"breed": "Poodle", "probability": 0.40}
        ],
        "traits": {},
        "health_considerations": []
    })
    expected_confidence = round((0.55 + 0.40) / 2, 2)
    assert result["breed_analysis"]["confidence"] == pytest.approx(expected_confidence)


# --- _identify_crossbreed_name ---

def test_identify_crossbreed_name_known_pair(client):
    assert client._identify_crossbreed_name(["Golden Retriever", "Poodle"]) == "Goldendoodle"


def test_identify_crossbreed_name_reversed_pair(client):
    assert client._identify_crossbreed_name(["Poodle", "Golden Retriever"]) == "Goldendoodle"


def test_identify_crossbreed_name_unknown_pair(client):
    assert client._identify_crossbreed_name(["Husky", "Bulldog"]) is None


def test_identify_crossbreed_name_labradoodle(client):
    assert client._identify_crossbreed_name(["Labrador Retriever", "Poodle"]) == "Labradoodle"


# --- generate ---

@pytest.mark.asyncio
async def test_generate_success(client):
    mock_http = _make_mock_http_client("The golden retriever is a friendly breed.")
    with patch('src.services.ollama_client.httpx.AsyncClient', return_value=mock_http):
        result = await client.generate("Tell me about golden retrievers.")
    assert result == "The golden retriever is a friendly breed."


@pytest.mark.asyncio
async def test_generate_http_error_raises_connection_error(client):
    with patch('src.services.ollama_client.httpx.AsyncClient') as mock_cls:
        mock_instance = AsyncMock()
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=None)
        mock_instance.post = AsyncMock(side_effect=httpx.HTTPError("timeout"))
        mock_cls.return_value = mock_instance
        with pytest.raises(ConnectionError, match="Failed to connect"):
            await client.generate("some prompt")
