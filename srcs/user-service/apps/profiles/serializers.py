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
            # Accept both string and dict formats
            if isinstance(value, dict):
                allowed_keys = {'street', 'city', 'state', 'zip', 'country'}
                if not set(value.keys()).issubset(allowed_keys):
                    raise serializers.ValidationError("Invalid address fields")
            elif not isinstance(value, str):
                raise serializers.ValidationError("Address must be a string or object")
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
            # Accept both string and dict formats
            if isinstance(value, dict):
                allowed_keys = {'street', 'city', 'state', 'zip', 'country'}
                if not set(value.keys()).issubset(allowed_keys):
                    raise serializers.ValidationError("Invalid address fields")
            elif not isinstance(value, str):
                raise serializers.ValidationError("Address must be a string or object")
        return value


class PetSerializer(serializers.ModelSerializer):
    """Serializer for pet profile"""

    class Meta:
        model = Pet
        fields = [
            'id', 'user_id', 'name', 'breed', 'breed_confidence',
            'species', 'age', 'weight', 'health_conditions',
            'image_url', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user_id', 'created_at', 'updated_at']

    def validate_age(self, value):
        """Age must be positive if provided"""
        if value is not None and value < 0:
            raise serializers.ValidationError("Age cannot be negative")
        return value

    def validate_weight(self, value):
        """Weight must be positive if provided"""
        if value is not None and value <= 0:
            raise serializers.ValidationError("Weight must be positive")
        return value

    def validate_breed_confidence(self, value):
        """Confidence must be between 0 and 1"""
        if value is not None and not (0 <= value <= 1):
            raise serializers.ValidationError("Confidence must be between 0 and 1")
        return value


class PetCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating pets (minimal required fields)"""

    class Meta:
        model = Pet
        fields = ['name', 'species', 'breed', 'age', 'weight', 'health_conditions']
        extra_kwargs = {
            'breed': {'required': False, 'allow_blank': True},
            'age': {'required': False},
            'weight': {'required': False},
            'health_conditions': {'required': False}
        }
    
    def validate_age(self, value):
        """Age must be positive if provided"""
        if value is not None and value < 0:
            raise serializers.ValidationError("Age cannot be negative")
        return value

    def validate_weight(self, value):
        """Weight must be positive if provided"""
        if value is not None and value <= 0:
            raise serializers.ValidationError("Weight must be positive")
        return value


class PetAnalysisSerializer(serializers.ModelSerializer):
    """Serializer for pet analysis history"""

    class Meta:
        model = PetAnalysis
        fields = [
            'id', 'pet_id', 'user_id', 'image_url',
            'breed_detected', 'confidence', 'traits',
            'raw_response', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class PetAnalysisCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating analysis records (from AI service results)"""

    class Meta:
        model = PetAnalysis
        fields = ['pet_id', 'user_id', 'image_url', 'breed_detected',
                  'confidence', 'traits', 'raw_response']
