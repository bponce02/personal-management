import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from core.models import List


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(username="alice", password="pw-12345")


@pytest.fixture
def access_token(client, user):
    resp = client.post(
        "/api/token/pair",
        data={"username": "alice", "password": "pw-12345"},
        content_type="application/json",
    )
    assert resp.status_code == 200, resp.content
    return resp.json()["access"]


@pytest.fixture
def auth_client(access_token):
    return Client(HTTP_AUTHORIZATION=f"Bearer {access_token}")


@pytest.fixture
def some_list(db):
    return List.objects.create(title="Inbox")
