from rest_framework import viewsets, status
from rest_framework.decorators import action
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
            return success_response(serializer.data)

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
                return success_response(response_serializer.data)

            return error_response('VALIDATION_ERROR', 'Invalid input', serializer.errors, status=422)


class PetViewSet(viewsets.ModelViewSet):
    """ViewSet for pet management"""
    serializer_class = PetSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        user_id = self.request.user_id
        user_role = self.request.user_role

        if user_role == 'admin':
            return Pet.objects.all()
        return Pet.objects.filter(user_id=user_id)

    def list(self, request):
        """GET /api/v1/pets"""
        queryset = self.get_queryset()
        serializer = PetSerializer(queryset, many=True)
        return success_response(serializer.data)

    def create(self, request):
        """POST /api/v1/pets"""
        serializer = PetCreateSerializer(data=request.data)

        if serializer.is_valid():
            pet = serializer.save(user_id=request.user_id)
            response_serializer = PetSerializer(pet)
            return success_response(response_serializer.data, status=201)

        return error_response('VALIDATION_ERROR', 'Invalid input', serializer.errors, status=422)

    def retrieve(self, request, pk=None):
        """GET /api/v1/pets/{id}"""
        try:
            pet = self.get_queryset().get(pk=pk)
            self.check_object_permissions(request, pet)
            serializer = PetSerializer(pet)
            return success_response(serializer.data)
        except Pet.DoesNotExist:
            return error_response('NOT_FOUND', 'Pet not found', status=404)

    def update(self, request, pk=None):
        """PUT /api/v1/pets/{id}"""
        try:
            pet = self.get_queryset().get(pk=pk)
            self.check_object_permissions(request, pet)
            serializer = PetSerializer(pet, data=request.data)

            if serializer.is_valid():
                serializer.save()
                return success_response(serializer.data)

            return error_response('VALIDATION_ERROR', 'Invalid input', serializer.errors, status=422)
        except Pet.DoesNotExist:
            return error_response('NOT_FOUND', 'Pet not found', status=404)

    def partial_update(self, request, pk=None):
        """PATCH /api/v1/pets/{id}"""
        try:
            pet = self.get_queryset().get(pk=pk)
            self.check_object_permissions(request, pet)
            serializer = PetSerializer(pet, data=request.data, partial=True)

            if serializer.is_valid():
                serializer.save()
                return success_response(serializer.data)

            return error_response('VALIDATION_ERROR', 'Invalid input', serializer.errors, status=422)
        except Pet.DoesNotExist:
            return error_response('NOT_FOUND', 'Pet not found', status=404)

    def destroy(self, request, pk=None):
        """DELETE /api/v1/pets/{id}"""
        try:
            pet = self.get_queryset().get(pk=pk)
            self.check_object_permissions(request, pet)
            pet.delete()
            return success_response({'message': 'Pet deleted successfully'})
        except Pet.DoesNotExist:
            return error_response('NOT_FOUND', 'Pet not found', status=404)

    @action(detail=True, methods=['get'])
    def analyses(self, request, pk=None):
        """GET /api/v1/pets/{id}/analyses"""
        try:
            pet = self.get_queryset().get(pk=pk)
            self.check_object_permissions(request, pet)

            analyses = PetAnalysis.objects.filter(pet_id=pet.id)
            serializer = PetAnalysisSerializer(analyses, many=True)
            return success_response(serializer.data)
        except Pet.DoesNotExist:
            return error_response('NOT_FOUND', 'Pet not found', status=404)


class PetAnalysisViewSet(viewsets.ModelViewSet):
    """ViewSet for pet analysis history - read + create only"""
    serializer_class = PetAnalysisSerializer
    permission_classes = [IsOwnerOrAdmin]
    http_method_names = ['get', 'post']  # No update/delete

    def get_queryset(self):
        user_id = self.request.user_id
        user_role = self.request.user_role

        if user_role == 'admin':
            return PetAnalysis.objects.all()
        return PetAnalysis.objects.filter(user_id=user_id)

    def list(self, request):
        """GET /api/v1/analyses"""
        queryset = self.get_queryset()
        serializer = PetAnalysisSerializer(queryset, many=True)
        return success_response(serializer.data)

    def create(self, request):
        """POST /api/v1/analyses"""
        serializer = PetAnalysisCreateSerializer(data=request.data)

        if serializer.is_valid():
            analysis = serializer.save()
            response_serializer = PetAnalysisSerializer(analysis)
            return success_response(response_serializer.data, status=201)

        return error_response('VALIDATION_ERROR', 'Invalid input', serializer.errors, status=422)

    def retrieve(self, request, pk=None):
        """GET /api/v1/analyses/{id}"""
        try:
            analysis = self.get_queryset().get(pk=pk)
            self.check_object_permissions(request, analysis)
            serializer = PetAnalysisSerializer(analysis)
            return success_response(serializer.data)
        except PetAnalysis.DoesNotExist:
            return error_response('NOT_FOUND', 'Analysis not found', status=404)
