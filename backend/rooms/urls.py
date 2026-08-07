from django.urls import path
from . import views

urlpatterns = [
    path('',                                        views.room_list_create,    name='room-list-create'),
    path('join/',                                   views.join_room,           name='join-room'),
    path('<uuid:room_id>/',                         views.room_detail,         name='room-detail'),
    path('<uuid:room_id>/snippets/',                views.snippet_list_create, name='snippet-list-create'),
    path('<uuid:room_id>/snippets/<uuid:snippet_id>/', views.snippet_detail,  name='snippet-detail'),
    path('<uuid:room_id>/snippets/<uuid:snippet_id>/comments/', views.snippet_comments, name='snippet-comments'),
    path('<uuid:room_id>/snippets/<uuid:snippet_id>/ai-review/', views.snippet_ai_review, name='snippet-ai-review'),
]