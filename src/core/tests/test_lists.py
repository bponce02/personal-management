import pytest

from core.models import List

pytestmark = pytest.mark.django_db


def test_create_list(auth_client):
    resp = auth_client.post(
        "/api/lists",
        data={"title": "Groceries"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Groceries"
    assert body["view"] == "list"
    assert List.objects.filter(id=body["id"]).exists()


def test_list_lists(auth_client, some_list):
    resp = auth_client.get("/api/lists")
    assert resp.status_code == 200
    titles = [item["title"] for item in resp.json()]
    assert "Inbox" in titles


def test_get_list_detail(auth_client, some_list):
    resp = auth_client.get(f"/api/lists/{some_list.id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Inbox"


def test_get_missing_list_404(auth_client):
    assert auth_client.get("/api/lists/999").status_code == 404


def test_patch_list(auth_client, some_list):
    resp = auth_client.patch(
        f"/api/lists/{some_list.id}",
        data={"title": "Renamed"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    some_list.refresh_from_db()
    assert some_list.title == "Renamed"


def test_delete_list(auth_client, some_list):
    resp = auth_client.delete(f"/api/lists/{some_list.id}")
    assert resp.status_code == 200
    assert not List.objects.filter(id=some_list.id).exists()
