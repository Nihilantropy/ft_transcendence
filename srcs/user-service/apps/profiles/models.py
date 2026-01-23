import uuid
from django.db import models


class UserProfile(models.Model):
    """Extended user profile data"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(unique=True, db_index=True)

    phone = models.CharField(max_length=20, blank=True)
    address = models.JSONField(null=True, blank=True)
    preferences = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_profiles'
        indexes = [
            models.Index(fields=['user_id']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"Profile for {self.user_id}"
