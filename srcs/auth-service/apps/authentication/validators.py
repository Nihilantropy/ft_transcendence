"""
Password validators for authentication app
"""
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
