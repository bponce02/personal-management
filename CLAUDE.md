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

## Frontend (React client)

The UI lives in **`frontend/`** — a standalone npm/Vite project, *not* managed by `uv` or `just`. Run all frontend commands from inside `frontend/`.

### Stack

- React 19 + TypeScript, bundled with **Vite 8**
- **TanStack Router** + **TanStack Start** for file-based routing (the project uses the `tanstackStart` Vite plugin, so an SSR shell exists)
- **TanStack Query** (`@tanstack/react-query`) for all server state
- **TanStack Form** + **Zod** (v4) for form state and validation
- **@internationalized/date** — date types for HeroUI date components (`DatePicker`)
- **HeroUI v3 (beta)** component library on **Tailwind CSS v4**
- **lucide-react** for icons

### Commands (run from `frontend/`)

- `npm run dev` — Vite dev server on **`:3000`** (the `--port 3000` in the `dev` script overrides `vite.config.ts`'s `8080`)
- `npm run build` / `npm run preview`
- `npm run test` — vitest
- `npm run lint` (eslint), `npm run format` (prettier + `eslint --fix`), `npm run check` (prettier check)

Path aliases `#/*` and `@/*` both map to `./src/*`. `src/routeTree.gen.ts` is **generated** by the router plugin — never hand-edit it.

### Connecting to the API (this is how CORS is avoided)

Django has **no CORS configured**, and a cross-origin `application/json` POST triggers a preflight Django answers with `405`. So instead of calling `:8000` directly, the Vite dev server **proxies `/api` → `http://localhost:8000`** (see `server.proxy` in `vite.config.ts`). The browser therefore talks *same-origin* and there's no preflight/CORS problem.

Because of the proxy, `API_BASE` in `src/lib/api.ts` defaults to `''` (relative). Set `VITE_API_URL` to point straight at a backend (e.g. a deployed API **with** CORS enabled). **The proxy is dev-only** — a production deploy must either serve the client from the same origin as the API or enable CORS on Django.

**Do not add a server.** Per project intent, there is already a Django API; don't add TanStack Start server functions or server-side loaders that call Django. All API access is **client-side** via TanStack Query + `apiFetch`.

### File layout (`frontend/src/`)

- `routes/__root.tsx` — HTML shell; mounts `QueryClientProvider` (one client per app instance via `useState`, so SSR and client don't share cache). Also runs a blocking inline script to restore `light`/`dark` class from `localStorage` before paint (prevents flash). There is **no `HeroUIProvider`** — HeroUI v3 doesn't have one.
- `routes/index.tsx` — welcome page (redirects to `/tasks` if already authed)
- `routes/login.tsx` — username/password sign-in; uses `variant="secondary"` on `<Input>` so fields are visible against the card background
- `routes/_authenticated.tsx` — layout-route guard + shell. Desktop: 3-column grid header (`logo | centered tabs | settings`). Mobile: floating bottom tab bar (`position: fixed`). Redirects to `/login` when not authenticated (runs client-only — early-returns on the server). Contains `PrimaryTabs` — active tab is derived from pathname; returns `undefined` (not a default tab) on non-tab routes like `/settings` so nothing is highlighted.
- `routes/_authenticated/tasks.tsx` — renders `<TasksView />` (all tasks across lists)
- `routes/_authenticated/lists.index.tsx` (`/lists`) — the lists management view (`<ListsView />`)
- `routes/_authenticated/lists.$listId.tsx` (`/lists/$listId`) — a single list's detail; renders `<TasksView listId={…} />` pre-filtered to that list. The **Lists** tab stays active because the pathname still starts with `/lists`. (There is no `lists.tsx` layout file — the flat `lists.index` + `lists.$listId` files are siblings.)
- `routes/_authenticated/calendar.tsx` — calendar view
- `routes/_authenticated/settings.tsx` — theme toggle (dark/light), CalDAV connection instructions, sign-out
- `lib/auth.ts` — token store (cookies), `lib/api.ts` — API client, `lib/auth-hooks.ts` — TanStack Query auth hooks
- `lib/queries.ts` — all TanStack Query hooks (`useTasks`, `useLists`, `useCreateTask`, `useBulkUpdateTasks`, `useBulkDeleteTasks`, `useBulkDuplicateTasks`, etc.)
- `lib/tasks-api.ts` — raw fetch functions for tasks and lists (`tasksApi`, `listsApi`)
- `lib/schemas.ts` — Zod form schemas (`taskFormSchema`, `listFormSchema`) + `firstError()` helper for TanStack Form errors
- `components/common/` — `Fab`, `ConfirmDialog` (AlertDialog-based), `DueDatePicker` (date-only)
- `components/tasks/` — `TasksView`, `TaskCard`, `TaskDetailDialog` (Modal), `TaskFormDrawer` (bottom Drawer, create/edit)
- `components/lists/` — `ListsView`, `ListCard`, `CreateListDialog` (Modal), `ListSettingsDialog` (rename + delete)

### Auth flow (client side)

- **Login**: `useLogin()` (a TanStack Query `useMutation` in `lib/auth-hooks.ts`) calls `POST /api/token/pair`, stores the returned `{access, refresh, username}`, and navigates to `/tasks`. `useLogout()` clears cookies + query cache and returns to `/`.
- **Token storage**: tokens live in **cookies** (`SameSite=Strict`, `Secure` on HTTPS) via `lib/auth.ts`. `isAuthenticated()` keys off the **refresh** token (the access token is short-lived). ⚠️ These are **JS-readable cookies, not `httpOnly`** — the API returns tokens in the response body, so the client must read them; true `httpOnly` would require a backend `Set-Cookie` change. No more XSS-safe than localStorage.
- **Authenticated requests**: use `apiFetch(path, init)` from `lib/api.ts`. It attaches `Authorization: Bearer <access>` and, on a `401`, transparently refreshes once via `POST /api/token/refresh` and retries — clearing the session if refresh fails. Build new data hooks (lists/tasks) on top of `apiFetch` + TanStack Query.

### Data layer, forms & domain rules

- **Three-file data layer**: `lib/tasks-api.ts` (typed `listsApi`/`tasksApi` over `apiFetch`; `jsonOrThrow`/`okOrThrow` raise `ApiError` carrying the server `detail`), `lib/queries.ts` (all Query hooks + the `queryKeys` map), `lib/schemas.ts` (Zod). Every mutation invalidates `queryKeys.tasks` (`['tasks']`) and/or `queryKeys.lists` on success; deleting a list invalidates both (cascade).
- **Forms use TanStack Form + Zod.** Pass the schema as `validators: { onChange: schema }` (Zod v4 is a Standard Schema, which TanStack Form v1 accepts directly). Wrap fields in HeroUI `<Form validationBehavior="aria">` so native validation doesn't block submit — TanStack/Zod owns validation. Show messages with `<FieldError>{firstError(field.state.meta.errors)}</FieldError>` (`firstError` handles both string and `{ message }` issue shapes). Mutations report via `toast` (`<Toast.Provider placement="top" />` is mounted in `__root.tsx`); query load failures render an inline `Alert` with a Retry button.
- **`due_date` is date-only.** The OpenAPI field is `format: date` (backend `DUE;VALUE=DATE`) — there is intentionally **no time picker**; an ISO datetime would fail validation. `DueDatePicker` maps a `YYYY-MM-DD` string ↔ `@internationalized/date`'s `CalendarDate` via `parseDate`.
- **A task must always belong to a list.** `useCreateTask` enforces this: if no `list_id` is passed (because no lists exist yet), it auto-creates a default `"My Tasks"` list and uses it. Don't add a separate guard that blocks creation when the list dropdown is empty.

### Component conventions (important)

- **HeroUI v3 components only**, **lucide-react for all icons**. No other component/icon libraries (MUI, Radix, react-icons, heroicons, inline SVG).
- **Verify component names/APIs through the `heroui-react` MCP** (`list_components`, `get_component_docs`) rather than guessing. This is HeroUI **v3 beta** — it differs a lot from the v2 docs that show up in web searches.
- v3 specifics that bite if you assume v2: **compound components** (`Card.Header`/`Card.Content`/`Card.Footer`, `Alert.Indicator`/`Alert.Content`, `Switch.Control`/`Switch.Thumb`/`Switch.Content`, `TextField` + `Label` + `Input`); **no `HeroUIProvider`**, **no `CardBody`**; `isPending` (not `isLoading`); icons passed **as children** (not `startContent`); Button uses `variant` (`primary`/`secondary`/`tertiary`/`outline`/`ghost`/`danger`), not `color`; Typography `type` values are `h1`–`h6`, `body`, `body-sm`, `body-xs`, `code` — not `small`.
- **Tailwind classes are for layout/structure only** (flex, grid, gap, sizing, spacing, alignment). Colors, font size/weight, and typography come from HeroUI components (`Typography`, `Separator`, semantic component variants) — not utility classes.
- **Max-width pattern**: authenticated pages use `max-w-5xl mx-auto` (applied in `_authenticated.tsx`'s `<main>` wrapper — individual page components don't need to repeat it). Public pages (`/`, `/login`) center their own content.

### HeroUI overlay & toolbar patterns

- **Controlled overlays** (`Modal`, `Drawer`, `AlertDialog`): drive them via `isOpen`/`onOpenChange` on the `*.Backdrop` and render *no* trigger child. Mount inner forms with `{isOpen && <…/>}` plus a `key` so state resets between create/edit. `<Button slot="close">` closes the overlay. Render a `ConfirmDialog` (AlertDialog) as a **sibling** of a Modal, never nested inside it.
- **Responsive toolbars** (`TasksView`, `ListsView`): full labeled controls at `md`+ (`hidden shrink-0 … md:flex`), icon-only controls below (`flex shrink-0 … md:hidden`). To stop the row from overflowing horizontally, the `SearchField` is `min-w-0 flex-1` (and its `Input` `min-w-0`) so it shrinks while the control group stays `shrink-0`.
- **Icon-only `Select` triggers**: `Select.Trigger` isn't built to be icon-only, so match the Button's icon-only spec exactly — `className="flex size-10 items-center justify-center rounded-3xl p-0"`, a `size-5` icon, and `variant="secondary"` on the `Select`. (From HeroUI's `button.css`: icon-only is `w-10 p-0`, icon `size-5` on mobile.) Otherwise the icon renders off-center and undersized.

### Key frontend components

- **`TasksView`** (`components/tasks/TasksView.tsx`) — the main task list. Handles filtering (search, status, list), select mode (bulk complete/duplicate/delete), and the detail/edit/create dialogs. Also owns the `canvas-confetti` celebration — fires from top-center of screen when a task is marked complete. Used by both the `/tasks` route (all tasks) and potentially embedded in a list detail view.
- **`TaskCard`** (`components/tasks/TaskCard.tsx`) — uniform-height card (one title line truncated, one description line truncated). In select mode the entire card is clickable (outer `role="button"` wrapper); the checkbox and complete button use `stopPropagation` to avoid double-firing. Complete button is wrapped in a `stopPropagation` div so clicking it doesn't open the detail dialog.
- **`useTheme`** (inline hook in `settings.tsx`) — reads/writes `localStorage` key `'theme'` and toggles the `light`/`dark` class on `document.documentElement`. Mirrors the inline script in `__root.tsx` that restores the class on first paint.

### Confetti (task completion celebration)

Uses **`canvas-confetti`** (not `react-rewards`, which remains in `package.json` but is no longer used). `canvas-confetti` renders on a `position: fixed` full-viewport canvas appended to `document.body`, so it overlays everything regardless of stacking contexts. Called directly (not as a React hook) from `handleToggleComplete` in `TasksView` when `!task.completed`. Origin is `{ x: 0.5, y: 0 }` (top-center, falls downward).

## Things to know before changing auth

- Routes are protected per-decorator via `auth=auth`. There is no global middleware enforcement, so a forgotten `auth=` argument silently makes a route public. New routes should always include it unless they're explicitly meant to be unauthenticated (and there should be a very good reason for that).
- There's no register endpoint. New users come from `just createsuperuser` or the Django admin. If/when you add a register endpoint, it's the one route that needs to stay unauthenticated.
- Token lifetimes are `ninja-jwt` defaults (5 min access, 1 day refresh). Override via a `SIMPLE_JWT` dict in settings if needed.
- CORS **is** configured on Django via `django-cors-headers`. `CORS_ALLOWED_ORIGINS` in `settings.py` currently allows `http://localhost:3000`. If you add another origin (e.g. a deployed frontend), add it to that list explicitly — do not use `CORS_ALLOW_ALL_ORIGINS`. The Vite dev proxy (`/api` → `:8000`) also remains in place, so in dev the browser can talk same-origin without relying on CORS headers.

## Gotchas worth knowing about

A few decisions in this repo that look weird without context:

- **Two parallel user databases.** Django auth users (used for JWT / admin) and Radicale htpasswd users are unrelated systems. There's no plan to unify them — Radicale needs its own auth and it would be more work than it's worth to bridge them for a local-only deployment.
- **`remote_*` fields are nullable on purpose.** `List.remote_url`, `Task.remote_uid`, `Task.remote_etag` are all nullable because rows must be creatable when sync is disabled (tests do this constantly). Don't make them required.
- **Signals fire on every `Task.save()` — including bulk ops are NOT covered.** `Task.objects.update(...)` and `bulk_create` skip signals; if you start using them, sync will silently miss those changes. Use `.save()` per instance, or call `radicale_sync.push_task` explicitly.
- **`INSTALLED_APPS` says `core.apps.CoreConfig`, not `core`.** That's deliberate — it's what makes `CoreConfig.ready()` run, which is what loads the signal handlers. Removing the explicit reference silently breaks all CalDAV sync.
- **No global auth middleware.** Routes are protected one decorator at a time via `auth=auth`. There is no safety net — a forgotten `auth=` keyword silently makes the route public.
- **`pytest` runs with `RADICALE_USERNAME` unset.** Sync is a no-op throughout the test suite. If you ever want to test the sync path itself, you'll need to either spin up Radicale as a fixture or mock `caldav.DAVClient` — neither is set up yet.
- **`radicale.htpasswd` and `radicale_data/` are gitignored.** Fresh clones have no users and no data. `just radicale-adduser` creates the first user; Radicale auto-creates the storage dirs on first request.
- **The frontend is a separate npm project under `frontend/`.** It is not part of `uv`/`just`; run `npm` commands from inside `frontend/`. The dev server is on `:3000` (npm script overrides `vite.config.ts`'s `8080`).
- **Frontend → API goes through a Vite dev proxy, not a direct cross-origin call.** `/api` is proxied to `:8000` so the browser stays same-origin. This is dev-only. CORS is also configured (`django-cors-headers`, `CORS_ALLOWED_ORIGINS = ["http://localhost:3000"]`) as a fallback, but the proxy is preferred in dev.
- **Frontend JWTs are stored in JS-readable cookies, not `httpOnly`.** The API returns tokens in the body, so httpOnly isn't possible without a backend change. Not more XSS-safe than localStorage.
- **HeroUI is v3 beta — verify components via the `heroui-react` MCP.** Web/v2 docs are misleading (compound components, no `HeroUIProvider`, `isPending` not `isLoading`). Components: HeroUI v3 only; icons: lucide-react only.
