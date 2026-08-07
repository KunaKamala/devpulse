import uuid
from django.db import models
from django.contrib.auth.models import User


class Room(models.Model):
    ROLE_CHOICES = [
        ('owner',        'Owner'),
        ('collaborator', 'Collaborator'),
        ('viewer',       'Viewer'),
    ]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name        = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    owner       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_rooms')
    members     = models.ManyToManyField(User, through='RoomMember', related_name='joined_rooms')
    invite_code = models.UUIDField(default=uuid.uuid4, unique=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class RoomMember(models.Model):
    room    = models.ForeignKey(Room, on_delete=models.CASCADE)
    user    = models.ForeignKey(User, on_delete=models.CASCADE)
    role    = models.CharField(max_length=20, choices=Room.ROLE_CHOICES, default='collaborator')
    joined  = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('room', 'user')

    def __str__(self):
        return f'{self.user.username} in {self.room.name} as {self.role}'


class Snippet(models.Model):
    LANGUAGE_CHOICES = [
        ('python',     'Python'),
        ('javascript', 'JavaScript'),
        ('typescript', 'TypeScript'),
        ('java',       'Java'),
        ('cpp',        'C++'),
        ('html',       'HTML'),
        ('css',        'CSS'),
        ('sql',        'SQL'),
        ('other',      'Other'),
    ]

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room       = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='snippets')
    author     = models.ForeignKey(User, on_delete=models.CASCADE)
    title      = models.CharField(max_length=200)
    code       = models.TextField()
    language   = models.CharField(max_length=20, choices=LANGUAGE_CHOICES, default='python')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.title} ({self.language})'


class Comment(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    snippet     = models.ForeignKey(Snippet, on_delete=models.CASCADE, related_name='comments')
    author      = models.ForeignKey(User, on_delete=models.CASCADE)
    content     = models.TextField()
    line_number = models.IntegerField(default=0)
    created_at  = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Comment by {self.author.username} on line {self.line_number}'


class AICodeReview(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    snippet      = models.ForeignKey(Snippet, on_delete=models.CASCADE, related_name='ai_reviews')
    requested_by = models.ForeignKey(User, on_delete=models.CASCADE)
    score        = models.IntegerField(default=75)
    summary      = models.TextField()
    bugs         = models.JSONField(default=list)
    suggestions  = models.JSONField(default=list)
    improvements = models.JSONField(default=list)
    created_at   = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'AI Review ({self.score}/100) for {self.snippet.title}'

