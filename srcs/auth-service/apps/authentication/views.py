"""
Authentication views for user login, registration, token refresh, and logout
"""
import json
import jwt
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.views import APIView

from apps.authentication import two_factor
from apps.authentication.models import User, RefreshToken, RecoveryCode, TwoFactorAuth
from apps.authentication.serializers import (
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
    ChangePasswordSerializer,
    UpdateProfileSerializer,
    TwoFactorConfirmSerializer,
    TwoFactorLoginSerializer,
)
from apps.authentication.utils import (
    success_response, 
    error_response, 
    issue_auth_tokens, 
    clear_auth_cookies,
    delete_user_cascade,
    get_authenticated_user,
    parse_json_body,
)
from apps.authentication.jwt_utils import decode_token, hash_token, generate_mfa_token


def second_factor_error(user, code, invalid_status):
    """
    Verify a 2FA code for `user`; returns None when it is good, else the error response.

    `invalid_status` is 401 on login/2fa (no session yet) and 422 on the authenticated endpoints:
    a 401 there would read as "session expired" to a frontend and log the user out.
    """
    result = two_factor.verify_second_factor(user, code)
    if result == 'ok':
        return None
    if result == 'locked':
        return error_response(
            code='RATE_LIMIT_EXCEEDED',
            message='Too many failed verification attempts. Try again later.',
            status=429
        )
    return error_response(
        code='INVALID_2FA_CODE',
        message='Invalid two-factor authentication code',
        status=invalid_status
    )


def validation_error(serializer):
    return error_response(
        code='VALIDATION_ERROR',
        message='Invalid input',
        details=serializer.errors,
        status=422
    )


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

        # Two-factor enabled: password alone is not enough. Hand out a short-lived challenge
        # instead of a session, and leave existing sessions alone until the second step succeeds
        # (otherwise anyone who knows the password could log the owner out by retrying).
        if user.two_factor_enabled:
            return success_response(
                data={'mfa_required': True, 'mfa_token': generate_mfa_token(user)},
                status=200
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


class TwoFactorLoginView(APIView):
    """
    POST /api/v1/auth/login/2fa

    Second login step for accounts with 2FA: exchange the challenge token from POST /login plus
    a TOTP (or recovery) code for the session cookies. Public at the gateway (no cookie yet).
    Single session policy: revokes previous refresh tokens once the code is accepted.
    """

    def post(self, request):
        serializer = TwoFactorLoginSerializer(data=parse_json_body(request))
        if not serializer.is_valid():
            return validation_error(serializer)

        try:
            payload = decode_token(serializer.validated_data['mfa_token'])
        except jwt.ExpiredSignatureError:
            return error_response(
                code='TOKEN_EXPIRED',
                message='Two-factor challenge has expired, log in again',
                status=401
            )
        except jwt.InvalidTokenError:
            return error_response(
                code='INVALID_TOKEN',
                message='Invalid two-factor challenge',
                status=401
            )

        if payload.get('token_type') != 'mfa':
            return error_response(
                code='INVALID_TOKEN',
                message='Invalid two-factor challenge',
                status=401
            )

        try:
            user = User.objects.get(id=payload.get('user_id'))
        except User.DoesNotExist:
            return error_response(
                code='INVALID_TOKEN',
                message='Invalid two-factor challenge',
                status=401
            )

        if not user.is_active:
            return error_response(
                code='ACCOUNT_DISABLED',
                message='Account is disabled',
                status=403
            )

        # 2FA was switched off after the challenge was issued: the challenge is void, log in again
        if not user.two_factor_enabled:
            return error_response(
                code='INVALID_TOKEN',
                message='Invalid two-factor challenge',
                status=401
            )

        error = second_factor_error(user, serializer.validated_data['code'], invalid_status=401)
        if error:
            return error

        # Revoke all previous refresh tokens (single session policy)
        RefreshToken.objects.filter(user=user, is_revoked=False).update(is_revoked=True)

        response = success_response(
            data={'user': UserSerializer(user).data},
            status=200
        )
        return issue_auth_tokens(user, response)


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

        # With 2FA on, the serializer has ensured a code was sent; it must also be right
        if user.two_factor_enabled:
            error = second_factor_error(user, serializer.validated_data['code'], invalid_status=422)
            if error:
                return error

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


class UpdateProfileView(APIView):
    """
    PATCH /api/v1/auth/me

    Update the authenticated user's first_name, last_name and/or email.
    Changing the email needs the current password (and a 2FA code when 2FA is on) and, because
    the access token embeds the email, revokes all sessions and re-issues fresh cookies.
    """

    def patch(self, request):
        user, error = get_authenticated_user(request)
        if error:
            return error

        serializer = UpdateProfileSerializer(data=parse_json_body(request), context={'user': user})
        if not serializer.is_valid():
            # Same mapping as registration: a taken address is a 409, not a generic 422
            if any('already exists' in str(e).lower() for e in serializer.errors.get('email', [])):
                return error_response(
                    code='EMAIL_ALREADY_EXISTS',
                    message='A user with this email already exists',
                    status=409
                )
            return validation_error(serializer)

        data = serializer.validated_data
        email_changed = 'email' in data

        if email_changed and user.two_factor_enabled:
            error = second_factor_error(user, data['code'], invalid_status=422)
            if error:
                return error

        # Explicit whitelist: nothing else in the payload can reach the model
        changed = [field for field in ('first_name', 'last_name', 'email') if field in data]
        for field in changed:
            setattr(user, field, data[field])

        try:
            with transaction.atomic():
                user.save(update_fields=changed + ['updated_at'])
        except IntegrityError:
            # Lost a race: another account took the address after the uniqueness check
            return error_response(
                code='EMAIL_ALREADY_EXISTS',
                message='A user with this email already exists',
                status=409
            )

        response = success_response(data={'user': UserSerializer(user).data}, status=200)

        if email_changed:
            RefreshToken.objects.filter(user=user, is_revoked=False).update(is_revoked=True)
            response = issue_auth_tokens(user, response)

        return response


class TwoFactorSetupView(APIView):
    """
    POST /api/v1/auth/2fa/setup

    Start enrolling an authenticator app: stage a fresh secret and return it with the otpauth://
    URI (the frontend renders the QR code). Nothing is enforced until 2fa/enable confirms a code,
    and calling this again replaces the pending secret.
    """

    def post(self, request):
        user, error = get_authenticated_user(request)
        if error:
            return error

        secret = two_factor.generate_secret()
        with transaction.atomic():
            record = TwoFactorAuth.objects.select_for_update().filter(user=user).first()
            if record and record.is_enabled:
                return error_response(
                    code='TWO_FACTOR_ALREADY_ENABLED',
                    message='Two-factor authentication is already enabled',
                    status=409
                )
            if record is None:
                record = TwoFactorAuth(user=user)
            record.secret_encrypted = two_factor.encrypt_secret(secret)
            record.last_used_step = 0
            record.failed_attempts = 0
            record.locked_until = None
            record.save()

        response = success_response(
            data={
                'secret': secret,
                'otpauth_uri': two_factor.provisioning_uri(secret, user.email),
                'issuer': settings.TWO_FACTOR_ISSUER,
                'algorithm': two_factor.ALGORITHM,
                'digits': two_factor.DIGITS,
                'period': two_factor.PERIOD,
            },
            status=200
        )
        response['Cache-Control'] = 'no-store'
        return response


class TwoFactorEnableView(APIView):
    """
    POST /api/v1/auth/2fa/enable

    Confirm the pending setup with the current password and a code from the authenticator app.
    Returns the recovery codes (the only time they are shown), revokes all sessions and re-issues
    fresh cookies. The password is required so a bare stolen session cannot enrol an attacker's
    authenticator and lock the owner out.
    """

    def post(self, request):
        user, error = get_authenticated_user(request)
        if error:
            return error

        serializer = TwoFactorConfirmSerializer(data=parse_json_body(request), context={'user': user})
        if not serializer.is_valid():
            return validation_error(serializer)

        with transaction.atomic():
            record = TwoFactorAuth.objects.select_for_update().filter(user=user).first()
            if record is None:
                return error_response(
                    code='TWO_FACTOR_SETUP_REQUIRED',
                    message='Start the setup first with POST /api/v1/auth/2fa/setup',
                    status=409
                )
            if record.is_enabled:
                return error_response(
                    code='TWO_FACTOR_ALREADY_ENABLED',
                    message='Two-factor authentication is already enabled',
                    status=409
                )

            code = two_factor.normalize_code(serializer.validated_data['code'])
            step = two_factor.matching_step(two_factor.decrypt_secret(record.secret_encrypted), code)
            if step is None:
                return error_response(
                    code='INVALID_2FA_CODE',
                    message='Invalid two-factor authentication code',
                    status=422
                )

            record.is_enabled = True
            record.enabled_at = timezone.now()
            record.last_used_step = step  # the confirming code is spent
            record.save(update_fields=['is_enabled', 'enabled_at', 'last_used_step'])
            recovery_codes = two_factor.generate_recovery_codes(user)

        RefreshToken.objects.filter(user=user, is_revoked=False).update(is_revoked=True)

        response = success_response(data={'recovery_codes': recovery_codes}, status=200)
        response = issue_auth_tokens(user, response)
        response['Cache-Control'] = 'no-store'
        return response


class TwoFactorDisableView(APIView):
    """
    POST /api/v1/auth/2fa/disable

    Turn 2FA off. Needs the current password and a valid TOTP or recovery code (subject to the
    same lockout as login). Wipes the secret and recovery codes, revokes all sessions and
    re-issues fresh cookies.
    """

    def post(self, request):
        user, error = get_authenticated_user(request)
        if error:
            return error

        serializer = TwoFactorConfirmSerializer(data=parse_json_body(request), context={'user': user})
        if not serializer.is_valid():
            return validation_error(serializer)

        if not user.two_factor_enabled:
            return error_response(
                code='TWO_FACTOR_NOT_ENABLED',
                message='Two-factor authentication is not enabled',
                status=409
            )

        error = second_factor_error(user, serializer.validated_data['code'], invalid_status=422)
        if error:
            return error

        with transaction.atomic():
            TwoFactorAuth.objects.filter(user=user).delete()
            RecoveryCode.objects.filter(user=user).delete()

        RefreshToken.objects.filter(user=user, is_revoked=False).update(is_revoked=True)

        response = success_response(
            data={'message': 'Two-factor authentication disabled'},
            status=200
        )
        return issue_auth_tokens(user, response)


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
