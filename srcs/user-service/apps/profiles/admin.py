from django.contrib import admin
from apps.profiles.models import UserProfile, Pet, PetAnalysis


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_id', 'phone', 'created_at']
    search_fields = ['user_id', 'phone']
    readonly_fields = ['id', 'created_at', 'updated_at']
    list_filter = ['created_at']


@admin.register(Pet)
class PetAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'species', 'breed', 'user_id', 'created_at']
    search_fields = ['name', 'breed', 'user_id']
    list_filter = ['species', 'created_at']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(PetAnalysis)
class PetAnalysisAdmin(admin.ModelAdmin):
    list_display = ['id', 'pet_id', 'breed_detected', 'confidence', 'created_at']
    search_fields = ['pet_id', 'user_id', 'breed_detected']
    list_filter = ['created_at']
    readonly_fields = ['id', 'created_at']
