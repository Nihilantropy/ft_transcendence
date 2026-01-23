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
