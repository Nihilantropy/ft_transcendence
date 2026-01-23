from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.profiles.models import UserProfile, Pet, PetAnalysis
from apps.profiles.serializers import (
    UserProfileSerializer, UserProfileUpdateSerializer,
    PetSerializer, PetCreateSerializer,
    PetAnalysisSerializer, PetAnalysisCreateSerializer
)
from apps.profiles.permissions import IsOwnerOrAdmin
from apps.profiles.utils import success_response, error_response


class UserProfileViewSet(viewsets.ModelViewSet):
    """ViewSet for user profiles - only supports /me endpoint"""
    serializer_class = UserProfileSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        user_id = self.request.user_id
        return UserProfile.objects.filter(user_id=user_id)

    @action(detail=False, methods=['get', 'put', 'patch'])
    def me(self, request):
        """GET/PUT/PATCH /api/v1/users/me"""
        user_id = request.user_id

        if request.method == 'GET':
            profile, created = UserProfile.objects.get_or_create(user_id=user_id)
            serializer = UserProfileSerializer(profile)
            return Response(success_response(serializer.data))

        else:  # PUT or PATCH
            profile, created = UserProfile.objects.get_or_create(user_id=user_id)
            serializer = UserProfileUpdateSerializer(
                profile,
                data=request.data,
                partial=(request.method == 'PATCH')
            )

            if serializer.is_valid():
                serializer.save()
                response_serializer = UserProfileSerializer(profile)
                return Response(success_response(response_serializer.data))

            return Response(
                error_response('VALIDATION_ERROR', 'Invalid input', serializer.errors),
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )


class PetViewSet(viewsets.ModelViewSet):
    """ViewSet for pet management"""
    queryset = Pet.objects.all()
    serializer_class = PetSerializer


class PetAnalysisViewSet(viewsets.ModelViewSet):
    """ViewSet for pet analysis history"""
    queryset = PetAnalysis.objects.all()
    serializer_class = PetAnalysisSerializer
