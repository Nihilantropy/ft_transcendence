from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from apps.authentication.models import User

# OWASP ASVS 2.1.2: passwords over 128 characters are denied
MAX_PASSWORD_LENGTH = 128
# Longest thing accepted as a 2FA code: a recovery code is 14 characters with its dashes
CODE_MAX_LENGTH = 32


def _require_two_factor_code(user, attrs):
    """A sensitive change by a user with 2FA on must carry a code (the view then verifies it)"""
    if user and user.two_factor_enabled and not attrs.get('code'):
        raise serializers.ValidationError({
            'code': 'A two-factor authentication code is required.'
        })

class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model output"""

    two_factor_enabled = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'role', 'is_verified', 'two_factor_enabled']
        read_only_fields = ['id', 'role', 'is_verified']

class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""

    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)

    class Meta:
        model = User
        fields = ['email', 'password', 'password_confirm', 'first_name', 'last_name']

    def validate_email(self, value):
        """Validate email is unique (case-insensitive)"""
        email_lower = value.lower()
        if User.objects.filter(email__iexact=email_lower).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email_lower

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Passwords do not match.'
            })
        return attrs

    def create(self, validated_data):
        """Create user with hashed password"""
        validated_data.pop('password_confirm')
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        return user

class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for password change"""

    current_password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        max_length=MAX_PASSWORD_LENGTH,
        style={'input_type': 'password'}
    )
    new_password_confirm = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    code = serializers.CharField(required=False, write_only=True, max_length=CODE_MAX_LENGTH)

    def validate_current_password(self, value):
        user = self.context.get('user')
        if user and not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value

    def validate_new_password(self, value):
        # Passing the user is what makes UserAttributeSimilarityValidator run at all
        validate_password(value, user=self.context.get('user'))
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({
                'new_password_confirm': 'New passwords do not match.'
            })
        if attrs['new_password'] == attrs['current_password']:
            raise serializers.ValidationError({
                'new_password': 'New password must be different from the current password.'
            })
        _require_two_factor_code(self.context.get('user'), attrs)
        return attrs


class UpdateProfileSerializer(serializers.Serializer):
    """
    Serializer for PATCH /me: first_name, last_name and email.

    Changing the email is a credential change: it needs the current password (and a 2FA code when
    2FA is on). That check runs before the uniqueness lookup so an address cannot be probed
    without the password. Fields outside the whitelist below can never reach the model.
    """

    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    email = serializers.EmailField(required=False, max_length=255)
    current_password = serializers.CharField(
        required=False,
        write_only=True,
        style={'input_type': 'password'}
    )
    code = serializers.CharField(required=False, write_only=True, max_length=CODE_MAX_LENGTH)

    def validate_email(self, value):
        return value.lower()

    def validate(self, attrs):
        user = self.context['user']

        # Re-submitting the current address is a no-op, not an email change
        if attrs.get('email') == user.email.lower():
            del attrs['email']

        if 'email' in attrs:
            password = attrs.get('current_password')
            if not password:
                raise serializers.ValidationError({
                    'current_password': 'Current password is required to change your email.'
                })
            if not user.check_password(password):
                raise serializers.ValidationError({
                    'current_password': 'Current password is incorrect.'
                })
            _require_two_factor_code(user, attrs)
            if User.objects.filter(email__iexact=attrs['email']).exclude(pk=user.pk).exists():
                raise serializers.ValidationError({
                    'email': 'A user with this email already exists.'
                })
        elif 'first_name' not in attrs and 'last_name' not in attrs:
            raise serializers.ValidationError('Provide at least one of first_name, last_name or email.')

        return attrs


class TwoFactorConfirmSerializer(serializers.Serializer):
    """Body of 2fa/enable and 2fa/disable: the current password plus a code"""

    current_password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    code = serializers.CharField(required=True, write_only=True, max_length=CODE_MAX_LENGTH)

    def validate_current_password(self, value):
        user = self.context.get('user')
        if user and not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value


class TwoFactorLoginSerializer(serializers.Serializer):
    """Body of login/2fa: the challenge token from the password step plus a code"""

    mfa_token = serializers.CharField(required=True, write_only=True)
    code = serializers.CharField(required=True, write_only=True, max_length=CODE_MAX_LENGTH)


class LoginSerializer(serializers.Serializer):
    """Serializer for user login"""

    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
