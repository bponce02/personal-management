from django.http import HttpResponse
from django.shortcuts import redirect, render

from .forms import TaskForm
from .models import Task


def home(request):
    return HttpResponse("Hello from personal-management.")


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
