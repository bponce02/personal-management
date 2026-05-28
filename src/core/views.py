from django.shortcuts import redirect, render

from .forms import ListForm, TaskForm
from .models import List, Task


def home(request):
    return render(request, "core/home.html", {"lists": List.objects.all()})


def list_list(request):
    if request.method == "POST":
        form = ListForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect("core:list_list")
    else:
        form = ListForm()
    return render(
        request,
        "core/list_list.html",
        {"lists": List.objects.all(), "form": form},
    )


def task_list(request):
    task_list = Task.objects.all()
    return render(request, "core/task_list.html", {"task_list": task_list})


def task_create(request):
    if request.method == "POST":
        form = TaskForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect("core:task_list")
    else:
        form = TaskForm()
    return render(request, "core/task_create.html", {"form": form})
