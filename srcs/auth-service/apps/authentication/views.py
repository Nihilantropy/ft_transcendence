"""
Authentication views for user login, registration, token refresh, and logout
"""
import json
from rest_framework.views import APIView

from apps.authentication.models import User, RefreshToken
from apps.authentication.serializers import LoginSerializer, RegisterSerializer, UserSerializer
from apps.authentication.utils import success_response, error_response, issue_auth_tokens


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

        # Prepare response with user data
        user_serializer = UserSerializer(user)
        response = success_response(
            data={'user': user_serializer.data},
            status=200
        )

        # Issue tokens and set cookies
        response = issue_auth_tokens(user, response)

        return response


class RegisterView(APIView):
    """
    POST /api/v1/auth/register

    Register a new user account and issue JWT tokens as HTTP-only cookies.
    Auto-login: user is immediately logged in after registration.
    """

    def post(self, request):
        # Parse JSON body
        try:
            data = json.loads(request.body) if request.body else {}
        except json.JSONDecodeError:
            data = {}

        # Validate input
        serializer = RegisterSerializer(data=data)
        if not serializer.is_valid():
            # Check if error is duplicate email
            if 'email' in serializer.errors:
                for error in serializer.errors['email']:
                    if 'already exists' in str(error).lower():
                        return error_response(
                            code='EMAIL_ALREADY_EXISTS',
                            message='A user with this email already exists',
                            status=409
                        )

            return error_response(
                code='VALIDATION_ERROR',
                message='Invalid input',
                details=serializer.errors,
                status=422
            )

        # Create user via serializer (handles password hashing)
        user = serializer.save()

        # Prepare response with user data
        user_serializer = UserSerializer(user)
        response = success_response(
            data={'user': user_serializer.data},
            status=201
        )

        # Issue tokens and set cookies
        response = issue_auth_tokens(user, response)

        return response
