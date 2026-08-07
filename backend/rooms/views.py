from .models import Room, RoomMember, Snippet, Comment, AICodeReview
from .serializers import RoomSerializer, SnippetSerializer, CommentSerializer, AICodeReviewSerializer
from .ai_service import analyze_code_with_gemini
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404


# ── Room Views ────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def room_list_create(request):
    if request.method == 'GET':
        # Return rooms where user is owner or member
        rooms = Room.objects.filter(members=request.user).distinct()
        return Response(RoomSerializer(rooms, many=True).data)

    if request.method == 'POST':
        serializer = RoomSerializer(data=request.data)
        if serializer.is_valid():
            room = serializer.save(owner=request.user)
            # Auto-add creator as owner member
            RoomMember.objects.create(room=room, user=request.user, role='owner')
            return Response(RoomSerializer(room).data, status=201)
        return Response(serializer.errors, status=400)


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def room_detail(request, room_id):
    room = get_object_or_404(Room, id=room_id)

    # Only members can view
    if not room.members.filter(id=request.user.id).exists():
        return Response({'error': 'You are not a member of this room.'}, status=403)

    if request.method == 'GET':
        return Response(RoomSerializer(room).data)

    if request.method == 'DELETE':
        if room.owner != request.user:
            return Response({'error': 'Only the owner can delete this room.'}, status=403)
        room.delete()
        return Response(status=204)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_room(request):
    """Join a room using its invite code."""
    invite_code = request.data.get('invite_code')
    if not invite_code:
        return Response({'error': 'Invite code is required.'}, status=400)

    room = get_object_or_404(Room, invite_code=invite_code)

    if room.members.filter(id=request.user.id).exists():
        return Response({'error': 'You are already in this room.'}, status=400)

    RoomMember.objects.create(room=room, user=request.user, role='collaborator')
    return Response(RoomSerializer(room).data, status=200)


# ── Snippet Views ─────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def snippet_list_create(request, room_id):
    room = get_object_or_404(Room, id=room_id)

    if not room.members.filter(id=request.user.id).exists():
        return Response({'error': 'You are not a member of this room.'}, status=403)

    if request.method == 'GET':
        snippets = Snippet.objects.filter(room=room).order_by('-created_at')
        return Response(SnippetSerializer(snippets, many=True).data)

    if request.method == 'POST':
        serializer = SnippetSerializer(data={**request.data, 'room': str(room.id)})
        if serializer.is_valid():
            serializer.save(author=request.user, room=room)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def snippet_detail(request, room_id, snippet_id):
    room    = get_object_or_404(Room, id=room_id)
    snippet = get_object_or_404(Snippet, id=snippet_id, room=room)

    if not room.members.filter(id=request.user.id).exists():
        return Response({'error': 'You are not a member of this room.'}, status=403)

    if request.method == 'GET':
        return Response(SnippetSerializer(snippet).data)

    if request.method == 'PUT':
        serializer = SnippetSerializer(snippet, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    if request.method == 'DELETE':
        if snippet.author != request.user and room.owner != request.user:
            return Response({'error': 'Permission denied.'}, status=403)
        snippet.delete()
        return Response(status=204)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def snippet_comments(request, room_id, snippet_id):
    """Load all existing comments for a snippet."""
    room    = get_object_or_404(Room, id=room_id)
    snippet = get_object_or_404(Snippet, id=snippet_id, room=room)

    if not room.members.filter(id=request.user.id).exists():
        return Response({'error': 'Not a member.'}, status=403)

    comments = Comment.objects.filter(snippet=snippet).order_by('created_at')
    return Response(CommentSerializer(comments, many=True).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def snippet_ai_review(request, room_id, snippet_id):
    """
    GET: Get existing AI review history for snippet.
    POST: Generate new AI Code Review using Google Gemini API.
    """
    room    = get_object_or_404(Room, id=room_id)
    snippet = get_object_or_404(Snippet, id=snippet_id, room=room)

    if not room.members.filter(id=request.user.id).exists():
        return Response({'error': 'Not a member of this room.'}, status=403)

    if request.method == 'GET':
        reviews = AICodeReview.objects.filter(snippet=snippet).order_by('-created_at')
        return Response(AICodeReviewSerializer(reviews, many=True).data)

    if request.method == 'POST':
        # Analyze code via Gemini
        analysis = analyze_code_with_gemini(snippet.code, snippet.language, snippet.title)
        
        review = AICodeReview.objects.create(
            snippet      = snippet,
            requested_by = request.user,
            score        = analysis.get('score', 75),
            summary      = analysis.get('summary', ''),
            bugs         = analysis.get('bugs', []),
            suggestions  = analysis.get('suggestions', []),
            improvements = analysis.get('improvements', [])
        )
        return Response(AICodeReviewSerializer(review).data, status=201)

