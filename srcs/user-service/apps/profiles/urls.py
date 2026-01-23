from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.profiles import views

# Disable trailing slash for RESTful API conventions
router = DefaultRouter(trailing_slash=False)
router.register(r'users', views.UserProfileViewSet, basename='user-profile')
router.register(r'pets', views.PetViewSet, basename='pet')
router.register(r'analyses', views.PetAnalysisViewSet, basename='pet-analysis')

urlpatterns = [
    path('', include(router.urls)),
]
