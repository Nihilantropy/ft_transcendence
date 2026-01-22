"""
Authentication views for user login, registration, token refresh, and logout
"""
import json
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from rest_framework.views import APIView

from apps.authentication.models import User, RefreshToken
from apps.authentication.serializers import LoginSerializer, UserSerializer
from apps.authentication.jwt_utils import generate_access_token, generate_refresh_token, hash_token
from apps.authentication.utils import success_response, error_response


class LoginView(APIView):
    """
    POST /api/v1/auth/login

    Authenticate user with email and password, issue JWT tokens as HTTP-only cookies.
    Single session policy: revokes previous refresh tokens on login.
    """

    def post(self, request):
        # Parse JSON body
        try:
            data = json.loads(request.body) if request.body else {}
        except json.JSONDecodeError:
            data = {}

        # Validate input
        serializer = LoginSerializer(data=data)
        if not serializer.is_valid():
            return error_response(
                code='VALIDATION_ERROR',
                message='Invalid input',
                details=serializer.errors,
                status=422
            )

        email = serializer.validated_data['email'].lower()
        password = serializer.validated_data['password']

        # Find user by email (case-insensitive)
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return error_response(
                code='INVALID_CREDENTIALS',
                message='Invalid email or password',
                status=401
            )

        # Check if account is active
        if not user.is_active:
            return error_response(
                code='ACCOUNT_DISABLED',
                message='Account is disabled',
                status=403
            )

        # Verify password
        if not user.check_password(password):
            return error_response(
                code='INVALID_CREDENTIALS',
                message='Invalid email or password',
                status=401
            )

        # Revoke all previous refresh tokens (single session policy)
        RefreshToken.objects.filter(user=user, is_revoked=False).update(is_revoked=True)

        # Generate access token
        access_token = generate_access_token(user)

        # Create refresh token record
        refresh_token_record = RefreshToken.objects.create(
            user=user,
            token_hash='placeholder',  # Will be updated after token generation
            expires_at=timezone.now() + timedelta(days=settings.JWT_REFRESH_TOKEN_LIFETIME_DAYS)
        )

        # Generate refresh token
        refresh_token = generate_refresh_token(user, refresh_token_record.id)

        # Update token hash in database
        refresh_token_record.token_hash = hash_token(refresh_token)
        refresh_token_record.save(update_fields=['token_hash'])

        # Prepare response with user data
        user_serializer = UserSerializer(user)
        response = success_response(
            data={'user': user_serializer.data},
            status=200
        )

        # Set HTTP-only cookies
        response.set_cookie(
            key='access_token',
            value=access_token,
            max_age=settings.JWT_ACCESS_TOKEN_LIFETIME_MINUTES * 60,
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            domain=settings.COOKIE_DOMAIN if settings.COOKIE_DOMAIN != 'localhost' else None
        )

        response.set_cookie(
            key='refresh_token',
            value=refresh_token,
            max_age=settings.JWT_REFRESH_TOKEN_LIFETIME_DAYS * 24 * 60 * 60,
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            path='/api/v1/auth/refresh',
            domain=settings.COOKIE_DOMAIN if settings.COOKIE_DOMAIN != 'localhost' else None
        )

        return response
