import pytest
from datetime import datetime, timedelta
from jose import jwt
from auth.jwt_utils import decode_jwt, JWTValidationError
from conftest import TEST_PRIVATE_KEY_PEM, TEST_PUBLIC_KEY_PEM

# Test JWT algorithm
TEST_ALGORITHM = "RS256"

def create_test_token(user_id: str, role: str = "user", exp_minutes: int = 30):
    """Helper to create test JWT tokens signed with RS256"""
    payload = {
        "user_id": user_id,
        "email": "test@example.com",
        "role": role,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=exp_minutes)
    }
    return jwt.encode(payload, TEST_PRIVATE_KEY_PEM, algorithm=TEST_ALGORITHM)

def test_decode_valid_jwt():
    """Test decoding a valid JWT token"""
    token = create_test_token("user123", "user")

    payload = decode_jwt(token, TEST_PUBLIC_KEY_PEM, TEST_ALGORITHM)

    assert payload["user_id"] == "user123"
    assert payload["role"] == "user"
    assert payload["email"] == "test@example.com"

def test_decode_expired_jwt_raises_error():
    """Test that expired JWT raises validation error"""
    token = create_test_token("user123", "user", exp_minutes=-10)

    with pytest.raises(JWTValidationError) as exc_info:
        decode_jwt(token, TEST_PUBLIC_KEY_PEM, TEST_ALGORITHM)

    assert "expired" in str(exc_info.value).lower()

def test_decode_invalid_signature_raises_error():
    """Test that invalid signature raises validation error"""
    token = create_test_token("user123", "user")

    # Generate a different key pair for wrong key test
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.backends import default_backend

    wrong_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    ).public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')

    with pytest.raises(JWTValidationError) as exc_info:
        decode_jwt(token, wrong_key, TEST_ALGORITHM)

    assert "invalid" in str(exc_info.value).lower()

def test_decode_malformed_token_raises_error():
    """Test that malformed token raises validation error"""
    malformed_token = "not.a.valid.jwt"

    with pytest.raises(JWTValidationError):
        decode_jwt(malformed_token, TEST_PUBLIC_KEY_PEM, TEST_ALGORITHM)
