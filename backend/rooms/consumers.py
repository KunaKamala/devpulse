import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from .models import Room, Snippet, Comment


class RoomConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.room_id    = self.scope['url_route']['kwargs']['room_id']
        self.room_group = f'room_{self.room_id}'

        user = self.scope.get('user')

        if not user or not user.is_authenticated:
            await self.close()
            return

        is_member = await self.check_membership(user, self.room_id)

        if not is_member:
            await self.close()
            return

        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.accept()

        await self.send(text_data=json.dumps({
            'type':    'connection_established',
            'message': f'Connected to room {self.room_id}',
            'user':    user.username,
        }))


    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group, self.channel_name)

    async def receive(self, text_data):
        """Handle messages sent from the browser."""
        data = json.loads(text_data)
        msg_type = data.get('type')
        user     = self.scope['user']

        if msg_type == 'new_comment':
            comment = await self.save_comment(
                user       = user,
                snippet_id = data['snippet_id'],
                content    = data['content'],
                line_number = data.get('line_number', 0),
            )
            if comment:
                # Broadcast to everyone in the room
                await self.channel_layer.group_send(
                    self.room_group,
                    {
                        'type':        'broadcast_comment',
                        'id':          str(comment['id']),
                        'snippet_id':  data['snippet_id'],
                        'content':     comment['content'],
                        'line_number': comment['line_number'],
                        'author':      user.username,
                        'created_at':  comment['created_at'],
                    }
                )

        elif msg_type == 'user_typing':
            # Broadcast typing indicator to others
            await self.channel_layer.group_send(
                self.room_group,
                {
                    'type':       'broadcast_typing',
                    'user':       user.username,
                    'snippet_id': data.get('snippet_id'),
                }
            )

    async def broadcast_comment(self, event):
        """Send comment to WebSocket client."""
        await self.send(text_data=json.dumps({
            'type':        'new_comment',
            'id':          event['id'],
            'snippet_id':  event['snippet_id'],
            'content':     event['content'],
            'line_number': event['line_number'],
            'author':      event['author'],
            'created_at':  event['created_at'],
        }))

    async def broadcast_typing(self, event):
        """Send typing indicator to everyone EXCEPT the typer."""
        # Don't send typing event back to the person who is typing
        if self.scope['user'].username == event['user']:
            return
        await self.send(text_data=json.dumps({
            'type':       'user_typing',
            'user':       event['user'],
            'snippet_id': event['snippet_id'],
        }))

    # ── Database helpers (sync → async) ──────────────────────

    @database_sync_to_async
    def check_membership(self, user, room_id):
        try:
            room = Room.objects.get(id=room_id)
            return room.members.filter(id=user.id).exists()
        except Room.DoesNotExist:
            return False

    @database_sync_to_async
    def save_comment(self, user, snippet_id, content, line_number):
        try:
            snippet = Snippet.objects.get(id=snippet_id)
            comment = Comment.objects.create(
                snippet     = snippet,
                author      = user,
                content     = content,
                line_number = line_number,
            )
            return {
                'id':          str(comment.id),
                'content':     comment.content,
                'line_number': comment.line_number,
                'created_at':  str(comment.created_at),
            }
        except Snippet.DoesNotExist:
            return None