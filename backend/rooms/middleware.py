from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from urllib.parse import parse_qs


@database_sync_to_async
def get_user_from_token(token_key):
    try:
        from rest_framework_simplejwt.tokens import AccessToken
        from django.contrib.auth.models import User
        token = AccessToken(token_key)
        return User.objects.get(id=token['user_id'])
    except Exception:
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        # parse_qs properly handles URL query strings
        query_string = scope.get('query_string', b'')
        params = parse_qs(query_string.decode())
        token_list = params.get('token', [''])
        token = token_list[0] if token_list else ''

        scope['user'] = await get_user_from_token(token)

        return await super().__call__(scope, receive, send)