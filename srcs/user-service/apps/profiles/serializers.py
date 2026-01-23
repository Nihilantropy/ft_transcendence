from rest_framework import serializers
from apps.profiles.models import UserProfile, Pet, PetAnalysis


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile data"""

    class Meta:
        model = UserProfile
        fields = [
            'id', 'user_id', 'phone', 'address',
            'preferences', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user_id', 'created_at', 'updated_at']

    def validate_phone(self, value):
        """Basic phone validation"""
        if value and not value.replace('+', '').replace('-', '').replace(' ', '').isdigit():
            raise serializers.ValidationError("Invalid phone number format")
        return value

    def validate_address(self, value):
        """Validate address structure if provided"""
        if value:
            allowed_keys = {'street', 'city', 'state', 'zip', 'country'}
            if not set(value.keys()).issubset(allowed_keys):
                raise serializers.ValidationError("Invalid address fields")
        return value


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating profile (excludes user_id)"""

    class Meta:
        model = UserProfile
        fields = ['phone', 'address', 'preferences']

    def validate_phone(self, value):
        """Basic phone validation"""
        if value and not value.replace('+', '').replace('-', '').replace(' ', '').isdigit():
            raise serializers.ValidationError("Invalid phone number format")
        return value

    def validate_address(self, value):
        """Validate address structure if provided"""
        if value:
            allowed_keys = {'street', 'city', 'state', 'zip', 'country'}
            if not set(value.keys()).issubset(allowed_keys):
                raise serializers.ValidationError("Invalid address fields")
        return value
