import pytest

from core.models import Task

pytestmark = pytest.mark.django_db


def test_create_task(auth_client, some_list):
    resp = auth_client.post(
        "/api/tasks",
        data={"title": "Buy milk", "list_id": some_list.id},
        content_type="application/json",
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Buy milk"
    assert body["completed"] is False
    assert Task.objects.filter(id=body["id"]).exists()


def test_list_tasks(auth_client, some_list):
    Task.objects.create(title="a", list=some_list)
    Task.objects.create(title="b", list=some_list)
    resp = auth_client.get("/api/tasks")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_filter_tasks_by_list_id(auth_client, some_list):
    other = some_list.__class__.objects.create(title="Other")
    Task.objects.create(title="in-inbox", list=some_list)
    Task.objects.create(title="in-other", list=other)
    resp = auth_client.get(f"/api/tasks?list_id={some_list.id}")
    titles = [t["title"] for t in resp.json()]
    assert titles == ["in-inbox"]


def test_filter_tasks_by_completed(auth_client, some_list):
    Task.objects.create(title="done", list=some_list, completed=True)
    Task.objects.create(title="todo", list=some_list, completed=False)
    resp = auth_client.get("/api/tasks?completed=true")
    titles = [t["title"] for t in resp.json()]
    assert titles == ["done"]


def test_patch_task_completed(auth_client, some_list):
    task = Task.objects.create(title="x", list=some_list)
    resp = auth_client.patch(
        f"/api/tasks/{task.id}",
        data={"completed": True},
        content_type="application/json",
    )
    assert resp.status_code == 200
    task.refresh_from_db()
    assert task.completed is True


def test_delete_task(auth_client, some_list):
    task = Task.objects.create(title="x", list=some_list)
    resp = auth_client.delete(f"/api/tasks/{task.id}")
    assert resp.status_code == 200
    assert not Task.objects.filter(id=task.id).exists()


def test_get_missing_task_404(auth_client):
    assert auth_client.get("/api/tasks/999").status_code == 404
