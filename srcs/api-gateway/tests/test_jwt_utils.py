import pytest
from datetime import datetime, timedelta
from jose import jwt
from auth.jwt_utils import decode_jwt, JWTValidationError

# Test JWT secret and algorithm
TEST_SECRET = "test-secret-key-for-testing"
TEST_ALGORITHM = "HS256"

def create_test_token(user_id: str, role: str = "user", exp_minutes: int = 30):
    """Helper to create test JWT tokens"""
    payload = {
        "user_id": user_id,
        "email": "test@example.com",
        "role": role,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=exp_minutes)
    }
    return jwt.encode(payload, TEST_SECRET, algorithm=TEST_ALGORITHM)

def test_decode_valid_jwt():
    """Test decoding a valid JWT token"""
    token = create_test_token("user123", "user")

    payload = decode_jwt(token, TEST_SECRET, TEST_ALGORITHM)

    assert payload["user_id"] == "user123"
    assert payload["role"] == "user"
    assert payload["email"] == "test@example.com"

def test_decode_expired_jwt_raises_error():
    """Test that expired JWT raises validation error"""
    token = create_test_token("user123", "user", exp_minutes=-10)

    with pytest.raises(JWTValidationError) as exc_info:
        decode_jwt(token, TEST_SECRET, TEST_ALGORITHM)

    assert "expired" in str(exc_info.value).lower()

def test_decode_invalid_signature_raises_error():
    """Test that invalid signature raises validation error"""
    token = create_test_token("user123", "user")
    wrong_secret = "wrong-secret"

    with pytest.raises(JWTValidationError) as exc_info:
        decode_jwt(token, wrong_secret, TEST_ALGORITHM)

    assert "signature" in str(exc_info.value).lower()

def test_decode_malformed_token_raises_error():
    """Test that malformed token raises validation error"""
    malformed_token = "not.a.valid.jwt"

    with pytest.raises(JWTValidationError):
        decode_jwt(malformed_token, TEST_SECRET, TEST_ALGORITHM)
