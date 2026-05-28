import pytest

pytestmark = pytest.mark.django_db


def test_unauthenticated_request_is_rejected(client):
    assert client.get("/api/tasks").status_code == 401


def test_token_pair_returns_access_and_refresh(client, user):
    resp = client.post(
        "/api/token/pair",
        data={"username": "alice", "password": "pw-12345"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access" in body
    assert "refresh" in body


def test_bad_credentials_are_rejected(client, user):
    resp = client.post(
        "/api/token/pair",
        data={"username": "alice", "password": "wrong"},
        content_type="application/json",
    )
    assert resp.status_code == 401


def test_bogus_token_is_rejected(client):
    resp = client.get("/api/tasks", HTTP_AUTHORIZATION="Bearer not-real")
    assert resp.status_code == 401


def test_refresh_returns_new_access_token(client, user):
    pair = client.post(
        "/api/token/pair",
        data={"username": "alice", "password": "pw-12345"},
        content_type="application/json",
    ).json()
    resp = client.post(
        "/api/token/refresh",
        data={"refresh": pair["refresh"]},
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert "access" in resp.json()


def test_authenticated_request_succeeds(auth_client):
    assert auth_client.get("/api/tasks").status_code == 200
