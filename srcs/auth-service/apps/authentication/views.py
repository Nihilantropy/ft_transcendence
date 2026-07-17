"""
Authentication views for user login, registration, token refresh, and logout
"""
import json
import jwt
from rest_framework.views import APIView

from apps.authentication.models import User, RefreshToken
from apps.authentication.serializers import LoginSerializer, RegisterSerializer, UserSerializer, ChangePasswordSerializer
from apps.authentication.utils import (
    success_response, 
    error_response, 
    issue_auth_tokens, 
    clear_auth_cookies,
    delete_user_cascade
)
from apps.authentication.jwt_utils import decode_token, hash_token


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


class RefreshView(APIView):
    """
    POST /api/v1/auth/refresh

    Exchange a valid refresh token for new access and refresh tokens.
    Implements token rotation: old token is revoked, new token is issued.
    """

    def post(self, request):
        # 1. Extract refresh_token from cookies
        refresh_token = request.COOKIES.get('refresh_token')
        if not refresh_token:
            return error_response(
                code='MISSING_TOKEN',
                message='Refresh token is required',
                status=401
            )

        # 2. Decode JWT (using public key)
        try:
            payload = decode_token(refresh_token)
        except jwt.ExpiredSignatureError:
            return error_response(
                code='TOKEN_EXPIRED',
                message='Refresh token has expired',
                status=401
            )
        except jwt.InvalidTokenError:
            return error_response(
                code='INVALID_TOKEN',
                message='Invalid refresh token',
                status=401
            )

        # 2b. Check token_type is 'refresh'
        if payload.get('token_type') != 'refresh':
            return error_response(
                code='INVALID_TOKEN',
                message='Invalid refresh token',
                status=401
            )

        # 3. Find RefreshToken record by token_id (jti)
        token_id = payload.get('token_id')
        try:
            token_record = RefreshToken.objects.get(id=token_id)
        except RefreshToken.DoesNotExist:
            return error_response(
                code='INVALID_TOKEN',
                message='Invalid refresh token',
                status=401
            )

        # 4. Validate RefreshToken record
        # 4a. Check if revoked
        if token_record.is_revoked:
            return error_response(
                code='TOKEN_REVOKED',
                message='Refresh token has been revoked',
                status=401
            )

        # 4b. Check token hash matches
        if token_record.token_hash != hash_token(refresh_token):
            return error_response(
                code='INVALID_TOKEN',
                message='Invalid refresh token',
                status=401
            )

        # 5. Find user by user_id from JWT
        user_id = payload.get('user_id')
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return error_response(
                code='INVALID_TOKEN',
                message='Invalid refresh token',
                status=401
            )

        # 6. Check user status
        if not user.is_active:
            return error_response(
                code='ACCOUNT_DISABLED',
                message='Account is disabled',
                status=403
            )

        # 7. Revoke current refresh token (token rotation)
        token_record.is_revoked = True
        token_record.save(update_fields=['is_revoked'])

        # 8. Issue new tokens (reuse issue_auth_tokens helper)
        user_serializer = UserSerializer(user)
        response = success_response(
            data={'user': user_serializer.data},
            status=200
        )

        # Issue new tokens and set cookies
        response = issue_auth_tokens(user, response)

        return response


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout

    Revoke refresh token and clear authentication cookies.
    Always succeeds - gracefully handles missing/invalid/expired tokens.
    """

    def post(self, request):
        # Try to revoke token if present and valid
        refresh_token = request.COOKIES.get('refresh_token')
        if refresh_token:
            try:
                payload = decode_token(refresh_token)
                if payload.get('token_type') == 'refresh':
                    token_id = payload.get('token_id')
                    if token_id:
                        RefreshToken.objects.filter(id=token_id).update(is_revoked=True)
            except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
                # Token invalid/expired - still proceed with logout
                pass

        # Always return success and clear cookies
        response = success_response(
            data={'message': 'Successfully logged out'},
            status=200
        )
        response = clear_auth_cookies(response)

        return response


class VerifyView(APIView):
    """
    GET /api/v1/auth/verify

    Verify if the current access token is valid.
    Returns user information if token is valid, 401 if invalid/expired.
    """

    def get(self, request):
        # Extract access_token from cookies
        access_token = request.COOKIES.get('access_token')
        if not access_token:
            return error_response(
                code='MISSING_TOKEN',
                message='Access token is required',
                status=401
            )

        # Decode and validate token
        try:
            payload = decode_token(access_token)
        except jwt.ExpiredSignatureError:
            return error_response(
                code='TOKEN_EXPIRED',
                message='Access token has expired',
                status=401
            )
        except jwt.InvalidTokenError:
            return error_response(
                code='INVALID_TOKEN',
                message='Invalid access token',
                status=401
            )

        # Check token_type is 'access'
        if payload.get('token_type') != 'access':
            return error_response(
                code='INVALID_TOKEN',
                message='Invalid access token',
                status=401
            )

        # Find user by user_id
        user_id = payload.get('user_id')
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return error_response(
                code='INVALID_TOKEN',
                message='Invalid access token',
                status=401
            )

        # Check if account is active
        if not user.is_active:
            return error_response(
                code='ACCOUNT_DISABLED',
                message='Account is disabled',
                status=403
            )

        # Return user data
        user_serializer = UserSerializer(user)
        return success_response(
            data={'user': user_serializer.data, 'valid': True},
            status=200
        )


class DeleteUserView(APIView):
    """
    DELETE /api/v1/auth/delete
    
    Delete the currently authenticated user account with cascade deletion.
    Requires valid access token in cookies.
    
    Cascade flow:
    1. Delete user profile data from user-service (profiles, pets, analyses)
    2. Delete auth data from auth-service (user, refresh tokens)
    3. Clear authentication cookies
    """
    
    def delete(self, request):
        # Get access token from cookies
        access_token = request.COOKIES.get('access_token')
        if not access_token:
            return error_response(
                code='UNAUTHORIZED',
                message='Authentication required',
                status=401
            )
        
        # Decode and validate access token
        try:
            payload = decode_token(access_token)
        except jwt.ExpiredSignatureError:
            return error_response(
                code='TOKEN_EXPIRED',
                message='Access token has expired',
                status=401
            )
        except jwt.InvalidTokenError:
            return error_response(
                code='INVALID_TOKEN',
                message='Invalid access token',
                status=401
            )
        
        # Verify token type
        if payload.get('token_type') != 'access':
            return error_response(
                code='INVALID_TOKEN',
                message='Invalid access token',
                status=401
            )
        
        # Get user
        user_id = payload.get('user_id')
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return error_response(
                code='INVALID_TOKEN',
                message='User not found',
                status=401
            )
        
        # Store email and role for response message
        email = user.email
        user_role = payload.get('role', 'user')
        
        # Perform cascade deletion across microservices
        try:
            deletion_summary = delete_user_cascade(user_id, user_role)
        except Exception as e:
            return error_response(
                code='DELETION_FAILED',
                message=f'Failed to delete user account: {str(e)}',
                status=500
            )
        
        # Clear auth cookies and return success
        response = success_response(
            data={
                'message': f'User account {email} deleted successfully',
                'deleted': deletion_summary
            },
            status=200
        )
        clear_auth_cookies(response)
        
        return response


class ChangePasswordView(APIView):
    """
    PUT /api/v1/auth/change-password

    Change the authenticated user's password.
    Requires valid access token. Revokes all refresh tokens and re-issues fresh tokens.
    """

    def put(self, request):
        # Extract access_token from cookies
        access_token = request.COOKIES.get('access_token')
        if not access_token:
            return error_response(
                code='UNAUTHORIZED',
                message='Authentication required',
                status=401
            )

        # Decode and validate token
        try:
            payload = decode_token(access_token)
        except jwt.ExpiredSignatureError:
            return error_response(
                code='TOKEN_EXPIRED',
                message='Access token has expired',
                status=401
            )
        except jwt.InvalidTokenError:
            return error_response(
                code='INVALID_TOKEN',
                message='Invalid access token',
                status=401
            )

        # Check token_type is 'access'
        if payload.get('token_type') != 'access':
            return error_response(
                code='INVALID_TOKEN',
                message='Invalid access token',
                status=401
            )

        # Find user
        user_id = payload.get('user_id')
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return error_response(
                code='INVALID_TOKEN',
                message='Invalid access token',
                status=401
            )

        # Check if account is active
        if not user.is_active:
            return error_response(
                code='ACCOUNT_DISABLED',
                message='Account is disabled',
                status=403
            )

        # Parse JSON body
        try:
            data = json.loads(request.body) if request.body else {}
        except json.JSONDecodeError:
            data = {}

        # Validate input
        serializer = ChangePasswordSerializer(data=data, context={'user': user})
        if not serializer.is_valid():
            return error_response(
                code='VALIDATION_ERROR',
                message='Invalid input',
                details=serializer.errors,
                status=422
            )

        # Update password
        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password'])

        # Revoke all existing refresh tokens
        RefreshToken.objects.filter(user=user, is_revoked=False).update(is_revoked=True)

        # Issue fresh tokens
        response = success_response(
            data={'message': 'Password changed successfully'},
            status=200
        )
        response = issue_auth_tokens(user, response)

        return response


class HealthView(APIView):
    """
    GET /health

    Health check endpoint for Docker healthcheck and monitoring.
    Returns 200 OK if service is running.
    """

    def get(self, request):
        return success_response(
            data={'status': 'healthy', 'service': 'auth-service'},
            status=200
        )
