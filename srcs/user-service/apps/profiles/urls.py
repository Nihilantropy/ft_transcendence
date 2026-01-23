from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.profiles import views

router = DefaultRouter()
router.register(r'users', views.UserProfileViewSet, basename='user-profile')
router.register(r'pets', views.PetViewSet, basename='pet')
router.register(r'analyses', views.PetAnalysisViewSet, basename='pet-analysis')

urlpatterns = [
    path('', include(router.urls)),
]
