import pytest
from apps.authentication.serializers import (
    UserSerializer,
    RegisterSerializer,
    LoginSerializer,
    ChangePasswordSerializer,
    UpdateProfileSerializer,
    TwoFactorConfirmSerializer,
    TwoFactorLoginSerializer
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

    def test_two_factor_enabled_reflects_the_account(self, enable_two_factor):
        """Clients learn from the user object whether a login will need a second step"""
        user = User.objects.create_user(email='test@example.com', password='testpass123')
        assert UserSerializer(user).data['two_factor_enabled'] is False

        enable_two_factor(user)

        assert UserSerializer(user).data['two_factor_enabled'] is True

    def test_two_factor_enabled_cannot_be_written(self):
        user = User.objects.create_user(email='test@example.com', password='testpass123')

        serializer = UserSerializer(user, data={'two_factor_enabled': True}, partial=True)

        assert serializer.is_valid()
        assert 'two_factor_enabled' not in serializer.validated_data


@pytest.mark.django_db
class TestRegisterSerializer:
    def test_register_serializer_valid_data(self):
        """Test RegisterSerializer with valid data"""
        data = {
            'email': 'test@example.com',
            'password': 'password123',
            'password_confirm': 'password123',
            'first_name': 'John',
            'last_name': 'Doe'
        }

        serializer = RegisterSerializer(data=data)
        assert serializer.is_valid()

    def test_register_serializer_invalid_email(self):
        """Test RegisterSerializer rejects invalid email"""
        data = {
            'email': 'invalid-email',
            'password': 'password123',
            'password_confirm': 'password123'
        }

        serializer = RegisterSerializer(data=data)
        assert not serializer.is_valid()
        assert 'email' in serializer.errors

    def test_register_serializer_weak_password(self):
        """Test RegisterSerializer rejects weak password"""
        data = {
            'email': 'test@example.com',
            'password': 'weak',  # Too short
            'password_confirm': 'weak'
        }

        serializer = RegisterSerializer(data=data)
        assert not serializer.is_valid()
        assert 'password' in serializer.errors

    def test_register_serializer_password_without_letter(self):
        """Test RegisterSerializer rejects password without letter"""
        data = {
            'email': 'test@example.com',
            'password': '12345678',
            'password_confirm': '12345678'
        }

        serializer = RegisterSerializer(data=data)
        assert not serializer.is_valid()
        assert 'password' in serializer.errors

    def test_register_serializer_creates_user(self):
        """Test RegisterSerializer creates user with hashed password"""
        data = {
            'email': 'test@example.com',
            'password': 'password123',
            'password_confirm': 'password123',
            'first_name': 'John'
        }

        serializer = RegisterSerializer(data=data)
        assert serializer.is_valid()

        user = serializer.save()

        assert user.email == 'test@example.com'
        assert user.first_name == 'John'
        assert user.check_password('password123')
        assert not user.check_password('wrongpassword')

    def test_register_serializer_passwords_dont_match(self):
        """Test RegisterSerializer rejects mismatched passwords"""
        data = {
            'email': 'test@example.com',
            'password': 'password123',
            'password_confirm': 'different456'
        }

        serializer = RegisterSerializer(data=data)
        assert not serializer.is_valid()
        assert 'password_confirm' in serializer.errors

    def test_register_serializer_missing_password_confirm(self):
        """Test RegisterSerializer requires password_confirm"""
        data = {
            'email': 'test@example.com',
            'password': 'password123'
        }

        serializer = RegisterSerializer(data=data)
        assert not serializer.is_valid()
        assert 'password_confirm' in serializer.errors

@pytest.mark.django_db
class TestChangePasswordSerializer:
    @pytest.fixture
    def user(self):
        return User.objects.create_user(
            email='test@example.com',
            password='oldpass123'
        )

    def test_valid_data(self, user):
        """Valid change password data passes validation"""
        data = {
            'current_password': 'oldpass123',
            'new_password': 'newpass456',
            'new_password_confirm': 'newpass456'
        }
        serializer = ChangePasswordSerializer(data=data, context={'user': user})
        assert serializer.is_valid()

    def test_wrong_current_password(self, user):
        """Wrong current password fails validation"""
        data = {
            'current_password': 'wrongpass123',
            'new_password': 'newpass456',
            'new_password_confirm': 'newpass456'
        }
        serializer = ChangePasswordSerializer(data=data, context={'user': user})
        assert not serializer.is_valid()
        assert 'current_password' in serializer.errors

    def test_passwords_dont_match(self, user):
        """Mismatched new passwords fail validation"""
        data = {
            'current_password': 'oldpass123',
            'new_password': 'newpass456',
            'new_password_confirm': 'different789'
        }
        serializer = ChangePasswordSerializer(data=data, context={'user': user})
        assert not serializer.is_valid()
        assert 'new_password_confirm' in serializer.errors

    def test_weak_new_password(self, user):
        """Weak new password fails Django validators"""
        data = {
            'current_password': 'oldpass123',
            'new_password': 'weak',
            'new_password_confirm': 'weak'
        }
        serializer = ChangePasswordSerializer(data=data, context={'user': user})
        assert not serializer.is_valid()
        assert 'new_password' in serializer.errors

    def test_new_password_without_number(self, user):
        """New password without number fails validation"""
        data = {
            'current_password': 'oldpass123',
            'new_password': 'abcdefgh',
            'new_password_confirm': 'abcdefgh'
        }
        serializer = ChangePasswordSerializer(data=data, context={'user': user})
        assert not serializer.is_valid()
        assert 'new_password' in serializer.errors

    def test_new_password_without_letter(self, user):
        """New password without letter fails validation"""
        data = {
            'current_password': 'oldpass123',
            'new_password': '12345678',
            'new_password_confirm': '12345678'
        }
        serializer = ChangePasswordSerializer(data=data, context={'user': user})
        assert not serializer.is_valid()
        assert 'new_password' in serializer.errors

    def test_missing_current_password(self, user):
        """Missing current_password fails validation"""
        data = {
            'new_password': 'newpass456',
            'new_password_confirm': 'newpass456'
        }
        serializer = ChangePasswordSerializer(data=data, context={'user': user})
        assert not serializer.is_valid()
        assert 'current_password' in serializer.errors

    def test_missing_new_password(self, user):
        """Missing new_password fails validation"""
        data = {
            'current_password': 'oldpass123',
            'new_password_confirm': 'newpass456'
        }
        serializer = ChangePasswordSerializer(data=data, context={'user': user})
        assert not serializer.is_valid()
        assert 'new_password' in serializer.errors

    def test_missing_new_password_confirm(self, user):
        """Missing new_password_confirm fails validation"""
        data = {
            'current_password': 'oldpass123',
            'new_password': 'newpass456'
        }
        serializer = ChangePasswordSerializer(data=data, context={'user': user})
        assert not serializer.is_valid()
        assert 'new_password_confirm' in serializer.errors


    def test_new_password_must_differ_from_current(self, user):
        data = {
            'current_password': 'oldpass123',
            'new_password': 'oldpass123',
            'new_password_confirm': 'oldpass123'
        }
        serializer = ChangePasswordSerializer(data=data, context={'user': user})
        assert not serializer.is_valid()
        assert 'new_password' in serializer.errors

    def test_new_password_similar_to_email_is_rejected(self, user):
        """The similarity validator only works when it is given the user"""
        data = {
            'current_password': 'oldpass123',
            'new_password': 'example1',  # user email is test@example.com
            'new_password_confirm': 'example1'
        }
        serializer = ChangePasswordSerializer(data=data, context={'user': user})
        assert not serializer.is_valid()
        assert 'new_password' in serializer.errors

    def test_new_password_of_128_characters_is_accepted(self, user):
        password = 'a1' * 64
        data = {
            'current_password': 'oldpass123',
            'new_password': password,
            'new_password_confirm': password
        }
        assert ChangePasswordSerializer(data=data, context={'user': user}).is_valid()

    def test_new_password_over_128_characters_is_rejected(self, user):
        password = 'a1' * 64 + 'a'
        data = {
            'current_password': 'oldpass123',
            'new_password': password,
            'new_password_confirm': password
        }
        serializer = ChangePasswordSerializer(data=data, context={'user': user})
        assert not serializer.is_valid()
        assert 'new_password' in serializer.errors

    def test_code_is_not_required_without_two_factor(self, user):
        data = {
            'current_password': 'oldpass123',
            'new_password': 'newpass456',
            'new_password_confirm': 'newpass456'
        }
        assert ChangePasswordSerializer(data=data, context={'user': user}).is_valid()

    def test_code_is_required_when_two_factor_is_enabled(self, user, enable_two_factor):
        enable_two_factor(user)
        data = {
            'current_password': 'oldpass123',
            'new_password': 'newpass456',
            'new_password_confirm': 'newpass456'
        }
        serializer = ChangePasswordSerializer(data=data, context={'user': user})
        assert not serializer.is_valid()
        assert 'code' in serializer.errors

    def test_code_is_accepted_when_two_factor_is_enabled(self, user, enable_two_factor):
        enable_two_factor(user)
        data = {
            'current_password': 'oldpass123',
            'new_password': 'newpass456',
            'new_password_confirm': 'newpass456',
            'code': '123456'
        }
        assert ChangePasswordSerializer(data=data, context={'user': user}).is_valid()


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


@pytest.mark.django_db
class TestUpdateProfileSerializer:
    """PATCH /api/v1/auth/me payload. `user` (test@example.com / testpass123) comes from conftest"""

    def serializer(self, user, **data):
        return UpdateProfileSerializer(data=data, context={'user': user})

    def test_names_alone_need_no_password(self, user):
        serializer = self.serializer(user, first_name='Ada', last_name='Lovelace')

        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data == {'first_name': 'Ada', 'last_name': 'Lovelace'}

    def test_one_field_is_enough(self, user):
        assert self.serializer(user, last_name='Lovelace').is_valid()

    def test_names_are_trimmed(self, user):
        serializer = self.serializer(user, first_name='  Ada  ')

        assert serializer.is_valid()
        assert serializer.validated_data['first_name'] == 'Ada'

    def test_blank_name_clears_it(self, user):
        serializer = self.serializer(user, first_name='')

        assert serializer.is_valid()
        assert serializer.validated_data['first_name'] == ''

    @pytest.mark.parametrize('field', ['first_name', 'last_name'])
    def test_name_over_150_characters_is_rejected(self, user, field):
        serializer = self.serializer(user, **{field: 'x' * 151})

        assert not serializer.is_valid()
        assert field in serializer.errors

    def test_email_is_lowercased(self, user):
        serializer = self.serializer(user, email='New@Example.COM', current_password='testpass123')

        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data['email'] == 'new@example.com'

    def test_email_change_requires_the_current_password(self, user):
        serializer = self.serializer(user, email='new@example.com')

        assert not serializer.is_valid()
        assert 'current_password' in serializer.errors

    def test_email_change_rejects_a_wrong_password(self, user):
        serializer = self.serializer(user, email='new@example.com', current_password='wrongpass1')

        assert not serializer.is_valid()
        assert 'current_password' in serializer.errors

    def test_invalid_email_is_rejected(self, user):
        serializer = self.serializer(user, email='not-an-email', current_password='testpass123')

        assert not serializer.is_valid()
        assert 'email' in serializer.errors

    def test_email_over_255_characters_is_rejected(self, user):
        serializer = self.serializer(user, email='a' * 250 + '@example.com', current_password='testpass123')

        assert not serializer.is_valid()
        assert 'email' in serializer.errors

    def test_own_email_is_a_no_op_that_needs_no_password(self, user):
        serializer = self.serializer(user, email='TEST@example.com', first_name='Ada')

        assert serializer.is_valid(), serializer.errors
        assert 'email' not in serializer.validated_data

    def test_own_email_alone_leaves_nothing_to_update(self, user):
        serializer = self.serializer(user, email='test@example.com')

        assert not serializer.is_valid()
        assert 'non_field_errors' in serializer.errors

    def test_email_taken_by_another_user_is_rejected_case_insensitively(self, user):
        User.objects.create_user(email='taken@example.com', password='testpass123')
        serializer = self.serializer(user, email='TAKEN@example.com', current_password='testpass123')

        assert not serializer.is_valid()
        assert 'already exists' in str(serializer.errors['email']).lower()

    def test_password_is_checked_before_uniqueness_so_the_address_cannot_be_probed(self, user):
        """Without the password a caller must not learn whether an address is registered"""
        User.objects.create_user(email='taken@example.com', password='testpass123')
        serializer = self.serializer(user, email='taken@example.com')

        assert not serializer.is_valid()
        assert 'current_password' in serializer.errors
        assert 'email' not in serializer.errors

    def test_empty_payload_is_rejected(self, user):
        serializer = self.serializer(user)

        assert not serializer.is_valid()
        assert 'non_field_errors' in serializer.errors

    def test_fields_outside_the_whitelist_are_ignored(self, user):
        """Mass assignment: role, is_staff, is_verified... are not fields of this serializer"""
        serializer = self.serializer(
            user, first_name='Ada', role='admin', is_staff=True, is_superuser=True, is_verified=False, id='x'
        )

        assert serializer.is_valid()
        assert serializer.validated_data == {'first_name': 'Ada'}

    def test_email_change_requires_a_code_when_two_factor_is_enabled(self, user, enable_two_factor):
        enable_two_factor(user)
        serializer = self.serializer(user, email='new@example.com', current_password='testpass123')

        assert not serializer.is_valid()
        assert 'code' in serializer.errors

    def test_email_change_accepts_a_code_when_two_factor_is_enabled(self, user, enable_two_factor):
        enable_two_factor(user)
        serializer = self.serializer(
            user, email='new@example.com', current_password='testpass123', code='123456'
        )

        assert serializer.is_valid(), serializer.errors

    def test_name_change_needs_no_code_even_when_two_factor_is_enabled(self, user, enable_two_factor):
        enable_two_factor(user)

        assert self.serializer(user, first_name='Ada').is_valid()


@pytest.mark.django_db
class TestTwoFactorConfirmSerializer:
    """Body of 2fa/enable and 2fa/disable: password plus a code"""

    def serializer(self, user, **data):
        return TwoFactorConfirmSerializer(data=data, context={'user': user})

    def test_valid(self, user):
        assert self.serializer(user, current_password='testpass123', code='123456').is_valid()

    def test_wrong_password(self, user):
        serializer = self.serializer(user, current_password='wrongpass1', code='123456')

        assert not serializer.is_valid()
        assert 'current_password' in serializer.errors

    @pytest.mark.parametrize('missing', ['current_password', 'code'])
    def test_both_fields_are_required(self, user, missing):
        data = {'current_password': 'testpass123', 'code': '123456'}
        del data[missing]
        serializer = self.serializer(user, **data)

        assert not serializer.is_valid()
        assert missing in serializer.errors

    def test_blank_code_is_rejected(self, user):
        serializer = self.serializer(user, current_password='testpass123', code='')

        assert not serializer.is_valid()
        assert 'code' in serializer.errors

    def test_oversized_code_is_rejected(self, user):
        serializer = self.serializer(user, current_password='testpass123', code='1' * 33)

        assert not serializer.is_valid()
        assert 'code' in serializer.errors


class TestTwoFactorLoginSerializer:
    def test_valid(self):
        assert TwoFactorLoginSerializer(data={'mfa_token': 'a.b.c', 'code': '123456'}).is_valid()

    @pytest.mark.parametrize('missing', ['mfa_token', 'code'])
    def test_both_fields_are_required(self, missing):
        data = {'mfa_token': 'a.b.c', 'code': '123456'}
        del data[missing]
        serializer = TwoFactorLoginSerializer(data=data)

        assert not serializer.is_valid()
        assert missing in serializer.errors

    def test_blank_code_is_rejected(self):
        serializer = TwoFactorLoginSerializer(data={'mfa_token': 'a.b.c', 'code': ''})

        assert not serializer.is_valid()
        assert 'code' in serializer.errors

    def test_oversized_code_is_rejected(self):
        serializer = TwoFactorLoginSerializer(data={'mfa_token': 'a.b.c', 'code': '1' * 33})

        assert not serializer.is_valid()
        assert 'code' in serializer.errors
