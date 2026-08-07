from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Room, RoomMember, Snippet, Comment, AICodeReview


class UserBriefSerializer(serializers.ModelSerializer):
    """Small user info — used inside other serializers."""
    class Meta:
        model  = User
        fields = ['id', 'username', 'email']


class RoomMemberSerializer(serializers.ModelSerializer):
    user = UserBriefSerializer(read_only=True)

    class Meta:
        model  = RoomMember
        fields = ['user', 'role', 'joined']


class RoomSerializer(serializers.ModelSerializer):
    owner   = UserBriefSerializer(read_only=True)
    members = RoomMemberSerializer(source='roommember_set', many=True, read_only=True)
    snippet_count = serializers.IntegerField(source='snippets.count', read_only=True)

    class Meta:
        model  = Room
        fields = ['id', 'name', 'description', 'owner', 'members',
                  'invite_code', 'snippet_count', 'created_at']
        read_only_fields = ['id', 'owner', 'invite_code', 'created_at']


class SnippetSerializer(serializers.ModelSerializer):
    author = UserBriefSerializer(read_only=True)

    class Meta:
        model  = Snippet
        fields = ['id', 'room', 'author', 'title', 'code',
                  'language', 'created_at', 'updated_at']
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']

class CommentSerializer(serializers.ModelSerializer):
    author = UserBriefSerializer(read_only=True)

    class Meta:
        model  = Comment
        fields = ['id', 'snippet', 'author', 'content', 'line_number', 'created_at']
        read_only_fields = ['id', 'author', 'created_at']


class AICodeReviewSerializer(serializers.ModelSerializer):
    requested_by = UserBriefSerializer(read_only=True)

    class Meta:
        model  = AICodeReview
        fields = ['id', 'snippet', 'requested_by', 'score', 'summary',
                  'bugs', 'suggestions', 'improvements', 'created_at']
        read_only_fields = ['id', 'snippet', 'requested_by', 'created_at']