import pytest
import os
import tempfile
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend

# Generate test RSA key pair for RS256
_test_private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
    backend=default_backend()
)
_test_public_key = _test_private_key.public_key()

# Serialize keys to PEM format
TEST_PRIVATE_KEY_PEM = _test_private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
).decode('utf-8')

TEST_PUBLIC_KEY_PEM = _test_public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
).decode('utf-8')

# Create a temporary file for the public key
_temp_key_file = tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False)
_temp_key_file.write(TEST_PUBLIC_KEY_PEM)
_temp_key_file.close()
TEST_PUBLIC_KEY_PATH = _temp_key_file.name

# Set test environment variables
os.environ["JWT_PUBLIC_KEY_PATH"] = TEST_PUBLIC_KEY_PATH
os.environ["JWT_ALGORITHM"] = "RS256"
os.environ["AUTH_SERVICE_URL"] = "http://auth-service-test:3001"
os.environ["USER_SERVICE_URL"] = "http://user-service-test:3002"
os.environ["AI_SERVICE_URL"] = "http://ai-service-test:3003"
os.environ["REDIS_URL"] = "redis://redis-test:6379/0"
os.environ["RATE_LIMIT_PER_MINUTE"] = "100"

@pytest.fixture
def test_settings():
    """Provide test settings"""
    from config import settings
    return settings

@pytest.fixture
def test_private_key():
    """Provide test RSA private key (PEM format) for signing tokens"""
    return TEST_PRIVATE_KEY_PEM

@pytest.fixture
def test_public_key():
    """Provide test RSA public key (PEM format) for verifying tokens"""
    return TEST_PUBLIC_KEY_PEM

@pytest.fixture
def test_algorithm():
    """Provide test JWT algorithm"""
    return "RS256"

def pytest_sessionfinish(session, exitstatus):
    """Clean up temp key file after tests"""
    try:
        os.unlink(TEST_PUBLIC_KEY_PATH)
    except OSError:
        pass
