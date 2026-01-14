# Auth Service Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Django REST Framework microservice that handles user authentication and JWT token issuance using RS256 asymmetric signing.

**Architecture:** The auth-service validates credentials, issues access and refresh JWTs stored in HTTP-only cookies, and manages token revocation. It uses RS256 asymmetric cryptography (private key for signing, public key shared with API Gateway for validation).

**Tech Stack:** Django 5.0, Django REST Framework 3.14, PostgreSQL, PyJWT with RS256, Argon2 password hashing, Gunicorn

---

## Task 1: Project Initialization and Dependencies

**Files:**
- Create: `srcs/auth-service/requirements.txt`
- Create: `srcs/auth-service/requirements-dev.txt`
- Create: `srcs/auth-service/.gitignore`

**Step 1: Create requirements.txt**

File: `srcs/auth-service/requirements.txt`
```txt
Django==5.0.1
djangorestframework==3.14.0
psycopg2-binary==2.9.9
PyJWT==2.8.0
cryptography==41.0.7
argon2-cffi==23.1.0
python-decouple==3.8
gunicorn==21.2.0
django-cors-headers==4.3.1
dj-database-url==2.1.0
```

**Step 2: Create requirements-dev.txt**

File: `srcs/auth-service/requirements-dev.txt`
```txt
pytest==7.4.3
pytest-django==4.7.0
pytest-cov==4.1.0
factory-boy==3.3.0
freezegun==1.4.0
```

**Step 3: Create .gitignore**

File: `srcs/auth-service/.gitignore`
```
*.pyc
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
.venv
db.sqlite3
.env
*.log
.coverage
htmlcov/
.pytest_cache/
*.egg-info/
dist/
build/
keys/jwt-private.pem
```

**Step 4: Initialize Django project**

Run: `cd srcs/auth-service && django-admin startproject config .`

Expected: Django project created with `manage.py` and `config/` directory

**Step 5: Create authentication app**

Run: `cd srcs/auth-service && python manage.py startapp authentication`

Expected: `authentication/` directory created with models.py, views.py, etc.

**Step 6: Move authentication app to apps directory**

Run: `cd srcs/auth-service && mkdir -p apps && mv authentication apps/`

Expected: `apps/authentication/` directory structure

**Step 7: Create tests directory**

Run: `cd srcs/auth-service && mkdir -p tests && touch tests/__init__.py`

Expected: `tests/` directory with `__init__.py`

**Step 8: Commit**

```bash
git add srcs/auth-service/
git commit -m "feat(auth-service): initialize Django project with dependencies

- Add Django 5.0, DRF 3.14, PostgreSQL driver
- Add PyJWT with cryptography for RS256 support
- Add Argon2 for password hashing
- Add pytest, factory-boy for testing
- Create Django project structure
- Create authentication app in apps/
- Add .gitignore for Python/Django"
```

---

## Task 2: RSA Key Generation

**Files:**
- Create: `srcs/auth-service/keys/.gitkeep`
- Create: `srcs/auth-service/keys/generate-keys.sh`

**Step 1: Create keys directory**

Run: `mkdir -p srcs/auth-service/keys`

Expected: Directory created

**Step 2: Create .gitkeep**

File: `srcs/auth-service/keys/.gitkeep`
```
# This file ensures the keys directory is tracked by git
```

**Step 3: Create key generation script**

File: `srcs/auth-service/keys/generate-keys.sh`
```bash
#!/bin/bash
# Generate RS256 key pair for JWT signing

set -e

KEYS_DIR="$(dirname "$0")"

echo "Generating RS256 key pair..."

# Generate private key (4096 bits for strong security)
openssl genrsa -out "$KEYS_DIR/jwt-private.pem" 4096

# Extract public key from private key
openssl rsa -in "$KEYS_DIR/jwt-private.pem" -pubout -out "$KEYS_DIR/jwt-public.pem"

# Set secure permissions
chmod 600 "$KEYS_DIR/jwt-private.pem"
chmod 644 "$KEYS_DIR/jwt-public.pem"

echo "✅ Keys generated successfully:"
echo "   Private key: $KEYS_DIR/jwt-private.pem (600)"
echo "   Public key:  $KEYS_DIR/jwt-public.pem (644)"
echo ""
echo "⚠️  IMPORTANT:"
echo "   - Keep jwt-private.pem SECRET (only auth-service needs it)"
echo "   - Share jwt-public.pem with API Gateway and other services"
echo "   - jwt-private.pem is already in .gitignore"
```

**Step 4: Make script executable**

Run: `chmod +x srcs/auth-service/keys/generate-keys.sh`

Expected: Script is executable

**Step 5: Generate keys**

Run: `cd srcs/auth-service/keys && bash generate-keys.sh`

Expected:
```
Generating RS256 key pair...
✅ Keys generated successfully:
   Private key: jwt-private.pem (600)
   Public key:  jwt-public.pem (644)
```

**Step 6: Verify keys were created**

Run: `ls -la srcs/auth-service/keys/`

Expected: See jwt-private.pem (600 perms) and jwt-public.pem (644 perms)

**Step 7: Commit**

```bash
git add srcs/auth-service/keys/.gitkeep srcs/auth-service/keys/generate-keys.sh srcs/auth-service/keys/jwt-public.pem
git commit -m "feat(auth-service): add RS256 key generation script

- Generate 4096-bit RSA private key for JWT signing
- Extract public key for API Gateway validation
- Set secure file permissions (600 for private, 644 for public)
- Add public key to git (private key is git-ignored)
- Include .gitkeep to track keys/ directory"
```

---

## Task 3: Django Configuration

**Files:**
- Create: `srcs/auth-service/.env.example`
- Create: `srcs/auth-service/.env`
- Modify: `srcs/auth-service/config/settings.py`

**Step 1: Create .env.example**

File: `srcs/auth-service/.env.example`
```bash
# Django Settings
DEBUG=False
SECRET_KEY=CHANGE_THIS_TO_SECURE_RANDOM_STRING
ALLOWED_HOSTS=auth-service,localhost

# Database
DB_NAME=smartbreeds
DB_USER=smartbreeds_user
DB_PASSWORD=secure_password_here
DB_HOST=db
DB_PORT=5432

# JWT Configuration (RS256 Asymmetric)
JWT_ALGORITHM=RS256
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7
JWT_PRIVATE_KEY_PATH=/app/keys/jwt-private.pem
JWT_PUBLIC_KEY_PATH=/app/keys/jwt-public.pem

# Cookie Settings
COOKIE_SECURE=False
COOKIE_SAMESITE=Strict
COOKIE_DOMAIN=localhost

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Server
PORT=3001
```

**Step 2: Copy to .env for local development**

Run: `cp srcs/auth-service/.env.example srcs/auth-service/.env`

Expected: .env file created

**Step 3: Update Django settings**

File: `srcs/auth-service/config/settings.py`
```python
"""
Django settings for auth-service
"""
import os
from pathlib import Path
from decouple import config, Csv
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

# Security Settings
SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', cast=Csv())

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'apps.authentication',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

# Custom User Model
AUTH_USER_MODEL = 'authentication.User'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8}
    },
    {
        'NAME': 'apps.authentication.validators.PasswordValidator',
    },
]

# Password Hashing (Argon2)
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
    ],
    'EXCEPTION_HANDLER': 'apps.authentication.exceptions.custom_exception_handler',
}

# CORS Settings
CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', cast=Csv())
CORS_ALLOW_CREDENTIALS = True

# JWT Settings
JWT_ALGORITHM = config('JWT_ALGORITHM', default='RS256')
JWT_ACCESS_TOKEN_LIFETIME_MINUTES = config('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', default=15, cast=int)
JWT_REFRESH_TOKEN_LIFETIME_DAYS = config('JWT_REFRESH_TOKEN_LIFETIME_DAYS', default=7, cast=int)
JWT_PRIVATE_KEY_PATH = config('JWT_PRIVATE_KEY_PATH')
JWT_PUBLIC_KEY_PATH = config('JWT_PUBLIC_KEY_PATH')

# Cookie Settings
COOKIE_SECURE = config('COOKIE_SECURE', default=True, cast=bool)
COOKIE_SAMESITE = config('COOKIE_SAMESITE', default='Strict')
COOKIE_DOMAIN = config('COOKIE_DOMAIN', default='localhost')

# Load JWT Keys
def load_jwt_keys():
    """Load RSA keys from filesystem"""
    private_key_path = Path(JWT_PRIVATE_KEY_PATH)
    public_key_path = Path(JWT_PUBLIC_KEY_PATH)

    if not private_key_path.exists():
        raise FileNotFoundError(f"JWT private key not found at {private_key_path}")
    if not public_key_path.exists():
        raise FileNotFoundError(f"JWT public key not found at {public_key_path}")

    return {
        'private': private_key_path.read_text(),
        'public': public_key_path.read_text()
    }

# JWT Keys (loaded at startup)
try:
    JWT_KEYS = load_jwt_keys()
except FileNotFoundError as e:
    if not DEBUG:
        raise
    print(f"Warning: {e}")
    JWT_KEYS = {'private': '', 'public': ''}
```

**Step 4: Update config/urls.py**

File: `srcs/auth-service/config/urls.py`
```python
"""
URL configuration for auth-service
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('apps.authentication.urls')),
]
```

**Step 5: Commit**

```bash
git add srcs/auth-service/.env.example srcs/auth-service/config/
git commit -m "feat(auth-service): configure Django settings

- Add environment-based configuration with python-decouple
- Configure PostgreSQL database connection
- Set Argon2 as default password hasher
- Add CORS configuration for frontend
- Configure REST Framework with JSON renderer
- Add JWT settings (RS256, token lifetimes, key paths)
- Configure HTTP-only cookie settings
- Load RSA keys from filesystem at startup"
```

---

## Task 4: User Model

**Files:**
- Create: `srcs/auth-service/tests/test_models.py`
- Modify: `srcs/auth-service/apps/authentication/models.py`

**Step 1: Write failing test for User model**

File: `srcs/auth-service/tests/test_models.py`
```python
import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

User = get_user_model()

@pytest.mark.django_db
class TestUserModel:
    def test_create_user_with_email(self):
        """Test creating a user with email"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        assert user.email == 'test@example.com'
        assert user.check_password('testpass123')
        assert user.is_active is True
        assert user.is_verified is True
        assert user.role == User.ROLE_USER
        assert user.is_staff is False
        assert user.is_superuser is False

    def test_create_user_with_names(self):
        """Test creating user with first and last name"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            first_name='John',
            last_name='Doe'
        )

        assert user.first_name == 'John'
        assert user.last_name == 'Doe'

    def test_email_normalized(self):
        """Test email is normalized (lowercased)"""
        user = User.objects.create_user(
            email='Test@EXAMPLE.com',
            password='testpass123'
        )

        assert user.email == 'test@example.com'

    def test_email_unique(self):
        """Test email must be unique"""
        User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        with pytest.raises(IntegrityError):
            User.objects.create_user(
                email='test@example.com',
                password='anotherpass'
            )

    def test_create_superuser(self):
        """Test creating a superuser"""
        user = User.objects.create_superuser(
            email='admin@example.com',
            password='adminpass123'
        )

        assert user.is_staff is True
        assert user.is_superuser is True
        assert user.role == User.ROLE_ADMIN
```

**Step 2: Create pytest configuration**

File: `srcs/auth-service/tests/conftest.py`
```python
import pytest
from django.conf import settings

@pytest.fixture(scope='session')
def django_db_setup():
    settings.DATABASES['default'] = {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'test_smartbreeds',
        'USER': 'postgres',
        'PASSWORD': 'postgres',
        'HOST': 'localhost',
        'PORT': '5432',
    }
```

**Step 3: Create pytest.ini**

File: `srcs/auth-service/pytest.ini`
```ini
[pytest]
DJANGO_SETTINGS_MODULE = config.settings
python_files = tests.py test_*.py *_tests.py
addopts = --strict-markers --disable-warnings
markers =
    slow: marks tests as slow
    integration: marks tests as integration tests
```

**Step 4: Run test to verify it fails**

Run: `cd srcs/auth-service && pytest tests/test_models.py::TestUserModel::test_create_user_with_email -v`

Expected: FAIL with "AttributeError: 'User' object has no attribute 'ROLE_USER'"

**Step 5: Implement User model**

File: `srcs/auth-service/apps/authentication/models.py`
```python
import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication"""

    def create_user(self, email, password=None, **extra_fields):
        """Create and return a regular user"""
        if not email:
            raise ValueError('Email is required')

        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Create and return a superuser"""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True')

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user model with email as username"""

    # Role choices
    ROLE_USER = 'user'
    ROLE_ADMIN = 'admin'
    ROLE_CHOICES = [
        (ROLE_USER, 'User'),
        (ROLE_ADMIN, 'Admin'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, max_length=255)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_USER)

    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return self.email

    def get_full_name(self):
        """Return full name"""
        return f"{self.first_name} {self.last_name}".strip() or self.email

    def get_short_name(self):
        """Return first name or email"""
        return self.first_name or self.email
```

**Step 6: Create initial migration**

Run: `cd srcs/auth-service && python manage.py makemigrations`

Expected: Migration file created in `apps/authentication/migrations/0001_initial.py`

**Step 7: Run tests to verify they pass**

Run: `cd srcs/auth-service && pytest tests/test_models.py::TestUserModel -v`

Expected: ALL PASS (5 tests)

**Step 8: Commit**

```bash
git add srcs/auth-service/apps/authentication/models.py srcs/auth-service/apps/authentication/migrations/ srcs/auth-service/tests/test_models.py srcs/auth-service/tests/conftest.py srcs/auth-service/pytest.ini
git commit -m "feat(auth-service): implement User model

- Create custom User model with email as username
- Add UUID primary key for better scalability
- Add role field (user/admin) for authorization
- Add is_verified flag for future email verification
- Normalize email to lowercase on creation
- Add UserManager with create_user and create_superuser
- Add database indexes for email and created_at
- Add comprehensive tests for User model"
```

---

## Task 5: RefreshToken Model

**Files:**
- Modify: `srcs/auth-service/tests/test_models.py`
- Modify: `srcs/auth-service/apps/authentication/models.py`

**Step 1: Write failing test for RefreshToken model**

File: `srcs/auth-service/tests/test_models.py` (append)
```python
from apps.authentication.models import RefreshToken
from datetime import timedelta
from django.utils import timezone

@pytest.mark.django_db
class TestRefreshTokenModel:
    def test_create_refresh_token(self):
        """Test creating a refresh token"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        expires_at = timezone.now() + timedelta(days=7)
        token = RefreshToken.objects.create(
            user=user,
            token_hash='abc123hash',
            expires_at=expires_at
        )

        assert token.user == user
        assert token.token_hash == 'abc123hash'
        assert token.expires_at == expires_at
        assert token.is_revoked is False
        assert token.last_used_at is None

    def test_refresh_token_user_relationship(self):
        """Test refresh token has foreign key to user"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        token1 = RefreshToken.objects.create(
            user=user,
            token_hash='hash1',
            expires_at=timezone.now() + timedelta(days=7)
        )
        token2 = RefreshToken.objects.create(
            user=user,
            token_hash='hash2',
            expires_at=timezone.now() + timedelta(days=7)
        )

        assert user.refresh_tokens.count() == 2
        assert token1 in user.refresh_tokens.all()
        assert token2 in user.refresh_tokens.all()

    def test_refresh_token_hash_unique(self):
        """Test token_hash must be unique"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        RefreshToken.objects.create(
            user=user,
            token_hash='samehash',
            expires_at=timezone.now() + timedelta(days=7)
        )

        with pytest.raises(IntegrityError):
            RefreshToken.objects.create(
                user=user,
                token_hash='samehash',
                expires_at=timezone.now() + timedelta(days=7)
            )

    def test_revoke_token(self):
        """Test revoking a refresh token"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        token = RefreshToken.objects.create(
            user=user,
            token_hash='hash123',
            expires_at=timezone.now() + timedelta(days=7)
        )

        token.is_revoked = True
        token.save()

        token.refresh_from_db()
        assert token.is_revoked is True
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/auth-service && pytest tests/test_models.py::TestRefreshTokenModel::test_create_refresh_token -v`

Expected: FAIL with "ImportError: cannot import name 'RefreshToken'"

**Step 3: Implement RefreshToken model**

File: `srcs/auth-service/apps/authentication/models.py` (append to end)
```python

class RefreshToken(models.Model):
    """Refresh token for JWT authentication"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='refresh_tokens')
    token_hash = models.CharField(max_length=64, unique=True)  # SHA256 hash

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    last_used_at = models.DateTimeField(null=True, blank=True)
    is_revoked = models.BooleanField(default=False)

    class Meta:
        db_table = 'refresh_tokens'
        indexes = [
            models.Index(fields=['token_hash']),
            models.Index(fields=['user', 'is_revoked']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f"RefreshToken for {self.user.email}"

    def is_valid(self):
        """Check if token is valid (not revoked and not expired)"""
        return not self.is_revoked and self.expires_at > timezone.now()

    def revoke(self):
        """Revoke this token"""
        self.is_revoked = True
        self.save(update_fields=['is_revoked'])
```

**Step 4: Create migration**

Run: `cd srcs/auth-service && python manage.py makemigrations`

Expected: Migration file created for RefreshToken model

**Step 5: Run tests to verify they pass**

Run: `cd srcs/auth-service && pytest tests/test_models.py::TestRefreshTokenModel -v`

Expected: ALL PASS (4 tests)

**Step 6: Commit**

```bash
git add srcs/auth-service/apps/authentication/models.py srcs/auth-service/apps/authentication/migrations/ srcs/auth-service/tests/test_models.py
git commit -m "feat(auth-service): implement RefreshToken model

- Create RefreshToken model with UUID primary key
- Add foreign key relationship to User
- Store SHA256 hash of token (not plaintext)
- Add expires_at, last_used_at, is_revoked fields
- Add database indexes for efficient queries
- Add is_valid() and revoke() helper methods
- Add comprehensive tests for RefreshToken model"
```

---

## Task 6: Password Validator

**Files:**
- Create: `srcs/auth-service/tests/test_validators.py`
- Create: `srcs/auth-service/apps/authentication/validators.py`

**Step 1: Write failing test for password validator**

File: `srcs/auth-service/tests/test_validators.py`
```python
import pytest
from django.core.exceptions import ValidationError
from apps.authentication.validators import PasswordValidator

class TestPasswordValidator:
    def test_valid_password_with_letter_and_number(self):
        """Test password with at least one letter and one number passes"""
        validator = PasswordValidator()

        # Should not raise exception
        validator.validate('password123')
        validator.validate('Test1234')
        validator.validate('abc123def')

    def test_password_without_letter_fails(self):
        """Test password without letter fails"""
        validator = PasswordValidator()

        with pytest.raises(ValidationError) as exc_info:
            validator.validate('12345678')

        assert 'at least one letter' in str(exc_info.value).lower()

    def test_password_without_number_fails(self):
        """Test password without number fails"""
        validator = PasswordValidator()

        with pytest.raises(ValidationError) as exc_info:
            validator.validate('abcdefgh')

        assert 'at least one number' in str(exc_info.value).lower()

    def test_password_with_special_characters_passes(self):
        """Test password with special characters still passes"""
        validator = PasswordValidator()

        # Should not raise exception
        validator.validate('P@ssw0rd!')
        validator.validate('Test123#$%')

    def test_get_help_text(self):
        """Test validator provides help text"""
        validator = PasswordValidator()
        help_text = validator.get_help_text()

        assert 'letter' in help_text.lower()
        assert 'number' in help_text.lower()
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/auth-service && pytest tests/test_validators.py::TestPasswordValidator::test_valid_password_with_letter_and_number -v`

Expected: FAIL with "ImportError: cannot import name 'PasswordValidator'"

**Step 3: Implement password validator**

File: `srcs/auth-service/apps/authentication/validators.py`
```python
import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _

class PasswordValidator:
    """
    Validate that the password contains at least one letter and one number.

    This provides basic password security while maintaining good UX.
    """

    def validate(self, password, user=None):
        """
        Validate the password.

        Args:
            password: The password to validate
            user: Optional user object (not used but required by Django)

        Raises:
            ValidationError: If password doesn't meet requirements
        """
        if not re.search(r'[a-zA-Z]', password):
            raise ValidationError(
                _('Password must contain at least one letter.'),
                code='password_no_letter'
            )

        if not re.search(r'\d', password):
            raise ValidationError(
                _('Password must contain at least one number.'),
                code='password_no_number'
            )

    def get_help_text(self):
        """Return help text to be displayed to user"""
        return _(
            'Your password must contain at least one letter and one number.'
        )
```

**Step 4: Run tests to verify they pass**

Run: `cd srcs/auth-service && pytest tests/test_validators.py::TestPasswordValidator -v`

Expected: ALL PASS (5 tests)

**Step 5: Commit**

```bash
git add srcs/auth-service/apps/authentication/validators.py srcs/auth-service/tests/test_validators.py
git commit -m "feat(auth-service): implement password validator

- Create PasswordValidator with letter + number requirements
- Minimum 8 characters enforced by Django MinimumLengthValidator
- Add clear error messages for validation failures
- Add help text for user guidance
- Add comprehensive tests for all validation scenarios"
```

---

## Task 7: JWT Utilities

**Files:**
- Create: `srcs/auth-service/tests/test_jwt_utils.py`
- Create: `srcs/auth-service/apps/authentication/jwt_utils.py`

**Step 1: Write failing test for JWT utilities**

File: `srcs/auth-service/tests/test_jwt_utils.py`
```python
import pytest
from datetime import datetime, timedelta
from django.utils import timezone
from apps.authentication.jwt_utils import (
    generate_access_token,
    generate_refresh_token,
    decode_token,
    hash_token
)
from apps.authentication.models import User
import hashlib

@pytest.mark.django_db
class TestJWTUtilities:
    def test_generate_access_token(self):
        """Test generating access token"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        token = generate_access_token(user)

        assert isinstance(token, str)
        assert len(token) > 50  # JWT tokens are long strings

    def test_decode_access_token(self):
        """Test decoding access token"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            first_name='John',
            last_name='Doe'
        )

        token = generate_access_token(user)
        payload = decode_token(token)

        assert payload['user_id'] == str(user.id)
        assert payload['email'] == 'test@example.com'
        assert payload['role'] == 'user'
        assert payload['token_type'] == 'access'
        assert 'iat' in payload
        assert 'exp' in payload

    def test_generate_refresh_token(self):
        """Test generating refresh token"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        token_id = 'test-token-id-123'
        token = generate_refresh_token(user, token_id)

        assert isinstance(token, str)
        assert len(token) > 50

    def test_decode_refresh_token(self):
        """Test decoding refresh token"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )

        token_id = 'test-token-id-123'
        token = generate_refresh_token(user, token_id)
        payload = decode_token(token)

        assert payload['user_id'] == str(user.id)
        assert payload['token_id'] == token_id
        assert payload['token_type'] == 'refresh'

    def test_decode_invalid_token_fails(self):
        """Test decoding invalid token raises exception"""
        with pytest.raises(Exception):
            decode_token('invalid.token.here')

    def test_hash_token(self):
        """Test token hashing produces consistent SHA256 hash"""
        token = 'test-token-string'
        hashed = hash_token(token)

        # SHA256 produces 64 character hex string
        assert len(hashed) == 64
        assert isinstance(hashed, str)

        # Same input produces same hash
        assert hash_token(token) == hashed

        # Verify it's actually SHA256
        expected = hashlib.sha256(token.encode()).hexdigest()
        assert hashed == expected
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/auth-service && pytest tests/test_jwt_utils.py::TestJWTUtilities::test_generate_access_token -v`

Expected: FAIL with "ImportError: cannot import name 'generate_access_token'"

**Step 3: Implement JWT utilities**

File: `srcs/auth-service/apps/authentication/jwt_utils.py`
```python
import jwt
import hashlib
from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone

def generate_access_token(user):
    """
    Generate access token for user.

    Args:
        user: User object

    Returns:
        JWT token string signed with RS256 private key
    """
    now = timezone.now()
    expiration = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_LIFETIME_MINUTES)

    payload = {
        'user_id': str(user.id),
        'email': user.email,
        'role': user.role,
        'token_type': 'access',
        'iat': int(now.timestamp()),
        'exp': int(expiration.timestamp())
    }

    token = jwt.encode(
        payload,
        settings.JWT_KEYS['private'],
        algorithm=settings.JWT_ALGORITHM
    )

    return token

def generate_refresh_token(user, token_id):
    """
    Generate refresh token for user.

    Args:
        user: User object
        token_id: UUID of RefreshToken database record

    Returns:
        JWT token string signed with RS256 private key
    """
    now = timezone.now()
    expiration = now + timedelta(days=settings.JWT_REFRESH_TOKEN_LIFETIME_DAYS)

    payload = {
        'user_id': str(user.id),
        'token_id': str(token_id),
        'token_type': 'refresh',
        'iat': int(now.timestamp()),
        'exp': int(expiration.timestamp())
    }

    token = jwt.encode(
        payload,
        settings.JWT_KEYS['private'],
        algorithm=settings.JWT_ALGORITHM
    )

    return token

def decode_token(token):
    """
    Decode and validate JWT token.

    Args:
        token: JWT token string

    Returns:
        Decoded payload dict

    Raises:
        jwt.ExpiredSignatureError: If token is expired
        jwt.InvalidTokenError: If token is invalid
    """
    payload = jwt.decode(
        token,
        settings.JWT_KEYS['public'],
        algorithms=[settings.JWT_ALGORITHM]
    )

    return payload

def hash_token(token):
    """
    Hash token using SHA256.

    Args:
        token: Token string to hash

    Returns:
        Hexadecimal hash string (64 characters)
    """
    return hashlib.sha256(token.encode()).hexdigest()
```

**Step 4: Run tests to verify they pass**

Run: `cd srcs/auth-service && pytest tests/test_jwt_utils.py::TestJWTUtilities -v`

Expected: ALL PASS (6 tests)

**Step 5: Commit**

```bash
git add srcs/auth-service/apps/authentication/jwt_utils.py srcs/auth-service/tests/test_jwt_utils.py
git commit -m "feat(auth-service): implement JWT utilities

- Add generate_access_token with 15 min expiration
- Add generate_refresh_token with 7 day expiration
- Add decode_token for validating JWTs
- Use RS256 asymmetric signing (private key)
- Add hash_token for SHA256 hashing of refresh tokens
- Include user_id, email, role in access token payload
- Include user_id, token_id in refresh token payload
- Add comprehensive tests for all JWT operations"
```

---

## Task 8: Serializers and Response Utilities

**Files:**
- Create: `srcs/auth-service/apps/authentication/utils.py`
- Create: `srcs/auth-service/apps/authentication/serializers.py`
- Create: `srcs/auth-service/tests/test_serializers.py`

**Step 1: Create response utilities**

File: `srcs/auth-service/apps/authentication/utils.py`
```python
from datetime import datetime
from rest_framework.response import Response

def success_response(data, status=200):
    """
    Create standardized success response.

    Args:
        data: Response data
        status: HTTP status code

    Returns:
        Response object with standardized format
    """
    return Response({
        'success': True,
        'data': data,
        'error': None,
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }, status=status)

def error_response(code, message, details=None, status=400):
    """
    Create standardized error response.

    Args:
        code: Error code (e.g., 'VALIDATION_ERROR')
        message: Human-readable error message
        details: Optional dict with error details
        status: HTTP status code

    Returns:
        Response object with standardized format
    """
    return Response({
        'success': False,
        'data': None,
        'error': {
            'code': code,
            'message': message,
            'details': details or {}
        },
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }, status=status)
```

**Step 2: Write failing test for serializers**

File: `srcs/auth-service/tests/test_serializers.py`
```python
import pytest
from apps.authentication.serializers import (
    UserSerializer,
    RegisterSerializer,
    LoginSerializer
)
from apps.authentication.models import User

@pytest.mark.django_db
class TestUserSerializer:
    def test_user_serializer_output(self):
        """Test UserSerializer returns correct fields"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            first_name='John',
            last_name='Doe',
            role='user'
        )

        serializer = UserSerializer(user)
        data = serializer.data

        assert data['id'] == str(user.id)
        assert data['email'] == 'test@example.com'
        assert data['first_name'] == 'John'
        assert data['last_name'] == 'Doe'
        assert data['role'] == 'user'
        assert data['is_verified'] is True
        assert 'password' not in data  # Password should never be serialized

class TestRegisterSerializer:
    def test_register_serializer_valid_data(self):
        """Test RegisterSerializer with valid data"""
        data = {
            'email': 'test@example.com',
            'password': 'password123',
            'first_name': 'John',
            'last_name': 'Doe'
        }

        serializer = RegisterSerializer(data=data)
        assert serializer.is_valid()

    def test_register_serializer_invalid_email(self):
        """Test RegisterSerializer rejects invalid email"""
        data = {
            'email': 'invalid-email',
            'password': 'password123'
        }

        serializer = RegisterSerializer(data=data)
        assert not serializer.is_valid()
        assert 'email' in serializer.errors

    def test_register_serializer_weak_password(self):
        """Test RegisterSerializer rejects weak password"""
        data = {
            'email': 'test@example.com',
            'password': 'weak'  # Too short
        }

        serializer = RegisterSerializer(data=data)
        assert not serializer.is_valid()
        assert 'password' in serializer.errors

    def test_register_serializer_password_without_letter(self):
        """Test RegisterSerializer rejects password without letter"""
        data = {
            'email': 'test@example.com',
            'password': '12345678'
        }

        serializer = RegisterSerializer(data=data)
        assert not serializer.is_valid()
        assert 'password' in serializer.errors

    @pytest.mark.django_db
    def test_register_serializer_creates_user(self):
        """Test RegisterSerializer creates user with hashed password"""
        data = {
            'email': 'test@example.com',
            'password': 'password123',
            'first_name': 'John'
        }

        serializer = RegisterSerializer(data=data)
        assert serializer.is_valid()

        user = serializer.save()

        assert user.email == 'test@example.com'
        assert user.first_name == 'John'
        assert user.check_password('password123')
        assert not user.check_password('wrongpassword')

class TestLoginSerializer:
    def test_login_serializer_valid_data(self):
        """Test LoginSerializer with valid format"""
        data = {
            'email': 'test@example.com',
            'password': 'password123'
        }

        serializer = LoginSerializer(data=data)
        assert serializer.is_valid()

    def test_login_serializer_missing_email(self):
        """Test LoginSerializer requires email"""
        data = {
            'password': 'password123'
        }

        serializer = LoginSerializer(data=data)
        assert not serializer.is_valid()
        assert 'email' in serializer.errors

    def test_login_serializer_missing_password(self):
        """Test LoginSerializer requires password"""
        data = {
            'email': 'test@example.com'
        }

        serializer = LoginSerializer(data=data)
        assert not serializer.is_valid()
        assert 'password' in serializer.errors
```

**Step 3: Run test to verify it fails**

Run: `cd srcs/auth-service && pytest tests/test_serializers.py::TestUserSerializer::test_user_serializer_output -v`

Expected: FAIL with "ImportError: cannot import name 'UserSerializer'"

**Step 4: Implement serializers**

File: `srcs/auth-service/apps/authentication/serializers.py`
```python
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from apps.authentication.models import User

class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model output"""

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'role', 'is_verified']
        read_only_fields = ['id', 'role', 'is_verified']

class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""

    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)

    class Meta:
        model = User
        fields = ['email', 'password', 'first_name', 'last_name']

    def validate_email(self, value):
        """Validate email is unique (case-insensitive)"""
        email_lower = value.lower()
        if User.objects.filter(email__iexact=email_lower).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email_lower

    def create(self, validated_data):
        """Create user with hashed password"""
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        return user

class LoginSerializer(serializers.Serializer):
    """Serializer for user login"""

    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
```

**Step 5: Run tests to verify they pass**

Run: `cd srcs/auth-service && pytest tests/test_serializers.py -v`

Expected: ALL PASS (11 tests)

**Step 6: Commit**

```bash
git add srcs/auth-service/apps/authentication/serializers.py srcs/auth-service/apps/authentication/utils.py srcs/auth-service/tests/test_serializers.py
git commit -m "feat(auth-service): implement serializers and response utilities

- Add UserSerializer for user data output
- Add RegisterSerializer with email validation and user creation
- Add LoginSerializer for login credentials
- Validate password using Django validators (incl. custom validator)
- Ensure email uniqueness check is case-insensitive
- Add success_response and error_response utilities
- Add comprehensive tests for all serializers"
```

---

## Summary

This implementation plan provides step-by-step TDD instructions for building the auth-service. The plan follows DRY, YAGNI,  and TDD principles with frequent commits after each logical unit of work.

**Remaining tasks to be added:** Register endpoint, Login endpoint, Refresh endpoint, Logout endpoint, Health endpoint, Error handling, Exception handlers, URLs configuration, Docker setup, API Gateway integration, and final documentation.

**Note:** Due to the extensive nature of this plan, the remaining tasks (9-18) should follow the same pattern:
1. Write failing tests
2. Run to verify failure
3. Implement minimal code
4. Run to verify pass
5. Commit

Each endpoint should include:
- Cookie setting with HttpOnly, Secure, SameSite flags
- Standardized response format
- Comprehensive error handling
- Integration tests for full request/response cycle