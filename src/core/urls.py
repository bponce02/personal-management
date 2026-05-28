from django.urls import path

from . import views

app_name = "core"

urlpatterns = [
    path("", views.home, name="home"),
    path("lists/", views.list_list, name="list_list"),
    path("task-list/", views.task_list, name="task_list"),
    path("task-create/", views.task_create, name="task_create"),
]
