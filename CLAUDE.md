# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A personal task/list management backend, exposed as a **JSON API only**. There are intentionally no Django views, templates, or forms — anything UI-shaped goes in a separate React client that talks to this API. If you find yourself reaching for `render()`, `TemplateView`, `ModelForm`, or `django-htmx`, you're on the wrong track.

## Stack

- Django 6 with `django-ninja` for the HTTP layer
- `django-ninja-jwt` (built on `ninja-extra`) for JWT auth
- `pytest` + `pytest-django` for tests
- SQLite (default `db.sqlite3` in `src/`)
- Python 3.14, `uv` for dependency + env management, `just` for command shortcuts

## Common commands

All commands go through `just` (see `justfile`):

- `just` — list available recipes
- `just runserver` — start Django dev server
- `just test` — run the full pytest suite
- `just test -k auth` — pass args through to pytest (filter by keyword, single test, etc.)
- `just migrate` / `just makemigrations`
- `just createsuperuser` — used to make real users; there's no register endpoint yet

Project layout uses a `src/` directory, so `manage.py` lives at `src/manage.py`. `pytest` is configured (in `pyproject.toml`) with `pythonpath = ["src"]` so imports like `from core.models import Task` work from anywhere.

## API surface

Everything is mounted at `/api/`:

- **Auth** (from `NinjaJWTDefaultController`): `POST /api/token/pair`, `POST /api/token/refresh`, `POST /api/token/verify`
- **Lists**: `GET/POST /api/lists`, `GET/PATCH/DELETE /api/lists/{id}`
- **Tasks**: `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/{id}`. `GET /api/tasks` accepts `?list_id=` and `?completed=` query filters.
- Interactive docs at `/api/docs`, OpenAPI JSON at `/api/openapi.json`

Every business route requires `Authorization: Bearer <access_token>`. The single shared `auth = JWTAuth()` instance in `core/api.py` is passed as `auth=auth` to each route — keep that pattern when adding new endpoints, don't accidentally leave a route public.

## Code architecture

There's one Django app (`core`) and the project package (`personal_management`). The whole API lives in **`src/core/api.py`** as a flat module of function-based Ninja routes — schemas (`*In` / `*Patch` / `*Out`) sit alongside the routes that use them. The API instance is a `NinjaExtraAPI` (not plain `NinjaAPI`) because JWT registration needs `ninja-extra`'s controller mechanism:

```python
api = NinjaExtraAPI()
api.register_controllers(NinjaJWTDefaultController)
```

`personal_management/urls.py` just mounts `api.urls` under `/api/` and exposes Django admin. There is no `core/urls.py` and there should not be one.

Models (`core/models.py`):
- `List` has `title` and `view` (a `TextChoices`: `LIST` or `CALENDAR` — the `CALENDAR` value is just metadata for the client, the API doesn't switch behavior on it).
- `Task` has a `ForeignKey` to `List` with `related_name="tasks"` and `on_delete=CASCADE`. Deleting a list deletes its tasks.

## Testing conventions

Tests live in `src/core/tests/` as a package. `conftest.py` provides the fixtures you almost always want:

- `user` — a created Django user (`alice` / `pw-12345`)
- `access_token` — fresh JWT for that user, obtained by actually hitting `/api/token/pair` (not by minting a token directly — this is intentional, so the auth flow is exercised in every test)
- `auth_client` — a `django.test.Client` with `HTTP_AUTHORIZATION="Bearer …"` already set; use this for any test that needs to hit a protected route
- `some_list` — a pre-created `List` for relationship tests

Use `auth_client` for protected routes, the bare `client` fixture only when you specifically want to test the unauthenticated case. Tests are marked `pytestmark = pytest.mark.django_db` at the module level.

## Things to know before changing auth

- Routes are protected per-decorator via `auth=auth`. There is no global middleware enforcement, so a forgotten `auth=` argument silently makes a route public. New routes should always include it unless they're explicitly meant to be unauthenticated (and there should be a very good reason for that).
- There's no register endpoint. New users come from `just createsuperuser` or the Django admin. If/when you add a register endpoint, it's the one route that needs to stay unauthenticated.
- Token lifetimes are `ninja-jwt` defaults (5 min access, 1 day refresh). Override via a `SIMPLE_JWT` dict in settings if needed.
- CORS is not configured yet. The moment a React client runs on a different origin (e.g. Vite on `:5173`), you'll need `django-cors-headers` with an explicit `CORS_ALLOWED_ORIGINS` — don't use the wildcard.
