"""
Django settings for auth-service
"""
import os
from pathlib import Path
from decouple import config, Csv

BASE_DIR = Path(__file__).resolve().parent.parent

# Security Settings
SECRET_KEY = config('SECRET_KEY', default='django-insecure-dev-key-change-in-production')
DEBUG = config('DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='auth-service,localhost', cast=Csv())

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
        'NAME': config('DB_NAME', default='smartbreeds'),
        'USER': config('DB_USER', default='smartbreeds_user'),
        'PASSWORD': config('DB_PASSWORD', default='smartbreeds_password'),
        'HOST': config('DB_HOST', default='db'),
        'PORT': config('DB_PORT', default='5432'),
        'ATOMIC_REQUESTS': False,
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
}

# CORS Settings
CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', default='http://localhost:5173,http://localhost:3000', cast=Csv())
CORS_ALLOW_CREDENTIALS = True

# JWT Settings
JWT_ALGORITHM = config('JWT_ALGORITHM', default='RS256')
JWT_ACCESS_TOKEN_LIFETIME_MINUTES = config('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', default=15, cast=int)
JWT_REFRESH_TOKEN_LIFETIME_DAYS = config('JWT_REFRESH_TOKEN_LIFETIME_DAYS', default=7, cast=int)
JWT_PRIVATE_KEY_PATH = config('JWT_PRIVATE_KEY_PATH', default=str(BASE_DIR / 'keys' / 'jwt-private.pem'))
JWT_PUBLIC_KEY_PATH = config('JWT_PUBLIC_KEY_PATH', default=str(BASE_DIR / 'keys' / 'jwt-public.pem'))

# Cookie Settings
COOKIE_SECURE = config('COOKIE_SECURE', default=False, cast=bool)
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
