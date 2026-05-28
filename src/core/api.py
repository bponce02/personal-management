from datetime import date

from django.shortcuts import get_object_or_404
from ninja import NinjaAPI, Schema

from .models import List, Task, View

api = NinjaAPI()


class ListIn(Schema):
    title: str
    view: View = View.LIST


class ListPatch(Schema):
    title: str | None = None
    view: View | None = None


class ListOut(Schema):
    id: int
    title: str
    view: View


class TaskIn(Schema):
    title: str
    list_id: int
    description: str | None = None
    completed: bool = False
    due_date: date | None = None


class TaskPatch(Schema):
    title: str | None = None
    list_id: int | None = None
    description: str | None = None
    completed: bool | None = None
    due_date: date | None = None


class TaskOut(Schema):
    id: int
    title: str
    description: str | None
    completed: bool
    due_date: date | None
    list_id: int


@api.get("/lists", response=list[ListOut])
def lists_index(request):
    return List.objects.all()


@api.post("/lists", response=ListOut)
def lists_create(request, payload: ListIn):
    return List.objects.create(**payload.dict())


@api.get("/lists/{list_id}", response=ListOut)
def lists_detail(request, list_id: int):
    return get_object_or_404(List, id=list_id)


@api.patch("/lists/{list_id}", response=ListOut)
def lists_update(request, list_id: int, payload: ListPatch):
    obj = get_object_or_404(List, id=list_id)
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(obj, field, value)
    obj.save()
    return obj


@api.delete("/lists/{list_id}")
def lists_delete(request, list_id: int):
    get_object_or_404(List, id=list_id).delete()
    return {"success": True}


@api.get("/tasks", response=list[TaskOut])
def tasks_index(request, list_id: int | None = None, completed: bool | None = None):
    qs = Task.objects.all()
    if list_id is not None:
        qs = qs.filter(list_id=list_id)
    if completed is not None:
        qs = qs.filter(completed=completed)
    return qs


@api.post("/tasks", response=TaskOut)
def tasks_create(request, payload: TaskIn):
    return Task.objects.create(**payload.dict())


@api.get("/tasks/{task_id}", response=TaskOut)
def tasks_detail(request, task_id: int):
    return get_object_or_404(Task, id=task_id)


@api.patch("/tasks/{task_id}", response=TaskOut)
def tasks_update(request, task_id: int, payload: TaskPatch):
    obj = get_object_or_404(Task, id=task_id)
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(obj, field, value)
    obj.save()
    return obj


@api.delete("/tasks/{task_id}")
def tasks_delete(request, task_id: int):
    get_object_or_404(Task, id=task_id).delete()
    return {"success": True}
