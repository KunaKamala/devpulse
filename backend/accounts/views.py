from django.shortcuts import render

# Create your views here.
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken


def get_tokens_for_user(user):
    """Generate JWT access + refresh token for a user."""
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    username = request.data.get('username')
    email    = request.data.get('email')
    password = request.data.get('password')

    if not username or not password:
        return Response({'error': 'Username and password required.'}, status=400)

    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already taken.'}, status=400)

    user = User.objects.create_user(username=username, email=email, password=password)
    tokens = get_tokens_for_user(user)
    return Response({
        'message': 'Account created successfully.',
        'user': {'id': user.id, 'username': user.username, 'email': user.email},
        **tokens
    }, status=201)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    from django.contrib.auth import authenticate
    username = request.data.get('username')
    password = request.data.get('password')

    user = authenticate(username=username, password=password)
    if not user:
        return Response({'error': 'Invalid credentials.'}, status=401)

    tokens = get_tokens_for_user(user)
    return Response({
        'user': {'id': user.id, 'username': user.username, 'email': user.email},
        **tokens
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """Return current logged-in user's info. Tests that JWT is working."""
    user = request.user
    return Response({'id': user.id, 'username': user.username, 'email': user.email})