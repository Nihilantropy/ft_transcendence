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


class Pet(models.Model):
    """Pet profile owned by a user"""

    SPECIES_CHOICES = [
        ('dog', 'Dog'),
        ('cat', 'Cat'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(db_index=True)

    name = models.CharField(max_length=100)
    breed = models.CharField(max_length=100, blank=True)
    breed_confidence = models.FloatField(null=True, blank=True)
    species = models.CharField(max_length=10, choices=SPECIES_CHOICES, default='dog')

    age = models.IntegerField(null=True, blank=True)
    weight = models.FloatField(null=True, blank=True)
    health_conditions = models.JSONField(default=list, blank=True)

    image_url = models.CharField(max_length=500, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pets'
        indexes = [
            models.Index(fields=['user_id', 'created_at']),
            models.Index(fields=['species']),
        ]

    def __str__(self):
        return f"{self.name} ({self.species})"
