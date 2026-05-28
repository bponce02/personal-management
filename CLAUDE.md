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

## First-time setup

From a fresh clone:

```sh
uv sync                         # install everything
just migrate                    # apply Django migrations
just createsuperuser            # JWT user (for /api/token/pair)
just radicale-adduser           # Radicale user (entry in radicale.htpasswd) — separate auth DB
export RADICALE_USERNAME=<u>    # must match what radicale-adduser created
export RADICALE_PASSWORD=<p>
just dev                        # Django + Radicale together
```

Without the `RADICALE_*` env vars, Django runs fine but the CalDAV bridge is dormant. That's by design — it's also why CI/tests can run without Radicale present.

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

## CalDAV / Radicale (phone sync)

A separate **Radicale** CalDAV server runs alongside Django and the phone talks to it. Django bridges its `Task` / `List` data into Radicale over HTTP using the `caldav` client library — the two processes share nothing else.

### Running it

- **Config**: `radicale.conf` at repo root. Listens on `0.0.0.0:5232`, htpasswd auth, filesystem storage.
- **Credentials**: `radicale.htpasswd` (bcrypt hashes). **Gitignored.** Create users with `just radicale-adduser` (prompts, or honors `RADICALE_USER` / `RADICALE_PASSWORD` env vars for scripting).
- **Storage**: `radicale_data/` (gitignored). Each Radicale user gets `collection-root/<user>/`; each calendar is a subdirectory of `.ics` files.
- **Run it**: `just radicale` (alone) or `just dev` (Django + Radicale in parallel).

iOS setup: Settings → Calendar → Accounts → Add Account → Other → Add CalDAV Account. Use `<lan-ip>:5232` (host's LAN IP) with the radicale username/password. iOS warns about no HTTPS; accept for LAN dev. Reminders picks up VTODO calendars automatically.

### How the Django ↔ Radicale bridge works

Configured via env vars read in `settings.py`:
- `RADICALE_URL` (default `http://localhost:5232`)
- `RADICALE_USERNAME` / `RADICALE_PASSWORD` — **must match an entry in `radicale.htpasswd`.** This is a separate auth path from Django's JWT users; the two user databases are unrelated.

**If `RADICALE_USERNAME`/`PASSWORD` are unset, the entire bridge no-ops silently.** This is why `pytest` keeps passing without Radicale running and why production-style envs can disable sync just by not setting the vars.

All sync logic lives in `core/radicale_sync.py`. The four entry points:

| Trigger | Direction | What happens |
|---|---|---|
| `post_save` on `List` (created) | Django → Radicale | `MKCALENDAR` with `VTODO` support; stores the calendar URL on `list.remote_url` |
| `post_save` on `Task` | Django → Radicale | Upserts a VTODO; stores `remote_uid` + `remote_etag` on the row |
| `post_delete` on `Task` | Django → Radicale | Deletes the matching VTODO |
| `POST /api/caldav/pull` | Radicale → Django | Walks every linked calendar, creates/updates/deletes Tasks from VTODOs. Last-write-wins. |

There is **no automatic poll** from Radicale → Django — the phone's edits only land when something calls `/api/caldav/pull`. Either trigger it from the React client periodically, or wire a Radicale storage hook later.

Signals are loaded via `core/apps.py:CoreConfig.ready()` (which is why `INSTALLED_APPS` references `core.apps.CoreConfig` explicitly, not just `core`). All sync calls are wrapped in `try/except` with `log.warning` — Radicale being down never breaks a Django write.

Field mapping (Task ↔ VTODO):
- `title` ↔ `SUMMARY`
- `description` ↔ `DESCRIPTION`
- `completed` ↔ `STATUS` (`COMPLETED` vs `NEEDS-ACTION`)
- `due_date` ↔ `DUE;VALUE=DATE`
- `remote_uid` is the VTODO `UID` — never change it after first sync, that's the join key

`pull()` does *not* create new `List`s from Radicale calendars it doesn't recognize — only Tasks within already-linked calendars are synced down. If you want a calendar created on the phone to materialize as a Django `List`, that's a follow-up.

### Adding a new field that should sync

If you add a field to `Task` that should round-trip through CalDAV (say `priority`), you need to touch *both* directions:

1. `_build_vtodo` in `radicale_sync.py` — write the right iCalendar property (`PRIORITY:5`)
2. `_parse_vtodo` in `radicale_sync.py` — read it back
3. Add the field to the relevant `TaskIn` / `TaskPatch` / `TaskOut` schemas in `api.py`
4. Migration as usual

Forgetting (2) silently makes pull-from-phone clobber the field to its default on every pull. There's no test that would catch this — the sync layer is intentionally untested (no fixtures spin up Radicale), so be careful here.

## Things to know before changing auth

- Routes are protected per-decorator via `auth=auth`. There is no global middleware enforcement, so a forgotten `auth=` argument silently makes a route public. New routes should always include it unless they're explicitly meant to be unauthenticated (and there should be a very good reason for that).
- There's no register endpoint. New users come from `just createsuperuser` or the Django admin. If/when you add a register endpoint, it's the one route that needs to stay unauthenticated.
- Token lifetimes are `ninja-jwt` defaults (5 min access, 1 day refresh). Override via a `SIMPLE_JWT` dict in settings if needed.
- CORS is not configured yet. The moment a React client runs on a different origin (e.g. Vite on `:5173`), you'll need `django-cors-headers` with an explicit `CORS_ALLOWED_ORIGINS` — don't use the wildcard.

## Gotchas worth knowing about

A few decisions in this repo that look weird without context:

- **Two parallel user databases.** Django auth users (used for JWT / admin) and Radicale htpasswd users are unrelated systems. There's no plan to unify them — Radicale needs its own auth and it would be more work than it's worth to bridge them for a local-only deployment.
- **`remote_*` fields are nullable on purpose.** `List.remote_url`, `Task.remote_uid`, `Task.remote_etag` are all nullable because rows must be creatable when sync is disabled (tests do this constantly). Don't make them required.
- **Signals fire on every `Task.save()` — including bulk ops are NOT covered.** `Task.objects.update(...)` and `bulk_create` skip signals; if you start using them, sync will silently miss those changes. Use `.save()` per instance, or call `radicale_sync.push_task` explicitly.
- **`INSTALLED_APPS` says `core.apps.CoreConfig`, not `core`.** That's deliberate — it's what makes `CoreConfig.ready()` run, which is what loads the signal handlers. Removing the explicit reference silently breaks all CalDAV sync.
- **No global auth middleware.** Routes are protected one decorator at a time via `auth=auth`. There is no safety net — a forgotten `auth=` keyword silently makes the route public.
- **`pytest` runs with `RADICALE_USERNAME` unset.** Sync is a no-op throughout the test suite. If you ever want to test the sync path itself, you'll need to either spin up Radicale as a fixture or mock `caldav.DAVClient` — neither is set up yet.
- **`radicale.htpasswd` and `radicale_data/` are gitignored.** Fresh clones have no users and no data. `just radicale-adduser` creates the first user; Radicale auto-creates the storage dirs on first request.
