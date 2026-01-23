from rest_framework import viewsets
from apps.profiles.models import UserProfile, Pet, PetAnalysis
from apps.profiles.serializers import (
    UserProfileSerializer, PetSerializer, PetAnalysisSerializer
)


class UserProfileViewSet(viewsets.ModelViewSet):
    """ViewSet for user profiles"""
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer


class PetViewSet(viewsets.ModelViewSet):
    """ViewSet for pet management"""
    queryset = Pet.objects.all()
    serializer_class = PetSerializer


class PetAnalysisViewSet(viewsets.ModelViewSet):
    """ViewSet for pet analysis history"""
    queryset = PetAnalysis.objects.all()
    serializer_class = PetAnalysisSerializer
