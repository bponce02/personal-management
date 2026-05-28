"""Bridge between Django Tasks/Lists and the local Radicale CalDAV server.

Radicale is a separate process. Django talks to it over HTTP using the
`caldav` client library. If RADICALE_USERNAME / RADICALE_PASSWORD are not
set, every function here returns silently -- sync is fully optional.

Direction summary:
- List save  -> ensure a Radicale calendar exists for it (stores remote_url)
- Task save  -> upsert a VTODO on Radicale (stores remote_uid + remote_etag)
- Task del   -> delete the VTODO on Radicale
- pull()     -> read each known calendar's VTODOs into Django (last-write-wins)
"""

from __future__ import annotations

import logging
import uuid
from datetime import date

import caldav
from caldav.lib.error import NotFoundError
from django.conf import settings

from .models import List, Task

log = logging.getLogger(__name__)


def is_enabled() -> bool:
    return bool(settings.RADICALE_USERNAME and settings.RADICALE_PASSWORD)


def _principal() -> caldav.Principal:
    client = caldav.DAVClient(
        url=settings.RADICALE_URL,
        username=settings.RADICALE_USERNAME,
        password=settings.RADICALE_PASSWORD,
    )
    return client.principal()


def _calendar_for(list_obj: List) -> caldav.Calendar | None:
    if not list_obj.remote_url:
        return None
    client = caldav.DAVClient(
        url=settings.RADICALE_URL,
        username=settings.RADICALE_USERNAME,
        password=settings.RADICALE_PASSWORD,
    )
    return caldav.Calendar(client=client, url=list_obj.remote_url)


def ensure_calendar(list_obj: List) -> None:
    """Create a Radicale calendar for this List if it doesn't have one yet."""
    if not is_enabled() or list_obj.remote_url:
        return
    try:
        principal = _principal()
        cal = principal.make_calendar(
            name=list_obj.title,
            cal_id=f"list-{list_obj.id}",
            supported_calendar_component_set=["VTODO"],
        )
        List.objects.filter(pk=list_obj.pk).update(remote_url=str(cal.url))
    except Exception as exc:
        log.warning("radicale ensure_calendar(%s) failed: %s", list_obj.pk, exc)


def push_task(task: Task) -> None:
    """Create or update the VTODO on Radicale for this Task."""
    if not is_enabled():
        return
    try:
        # The list needs a calendar before its tasks can be pushed.
        if not task.list.remote_url:
            ensure_calendar(task.list)
            task.list.refresh_from_db()
        cal = _calendar_for(task.list)
        if cal is None:
            return

        uid = task.remote_uid or str(uuid.uuid4())
        ical = _build_vtodo(task, uid)
        todo = cal.save_todo(ical=ical, no_overwrite=False)

        Task.objects.filter(pk=task.pk).update(
            remote_uid=uid,
            remote_etag=getattr(todo, "etag", None),
        )
    except Exception as exc:
        log.warning("radicale push_task(%s) failed: %s", task.pk, exc)


def delete_task(task: Task) -> None:
    if not is_enabled() or not task.remote_uid or not task.list.remote_url:
        return
    try:
        cal = _calendar_for(task.list)
        if cal is None:
            return
        try:
            todo = cal.todo_by_uid(task.remote_uid)
            todo.delete()
        except NotFoundError:
            pass  # already gone on the remote
    except Exception as exc:
        log.warning("radicale delete_task(%s) failed: %s", task.pk, exc)


def pull() -> dict[str, int]:
    """Pull all VTODOs from known calendars back into Django.

    Returns counts of {created, updated, deleted}. Calendars that aren't yet
    linked to a List are ignored (we don't auto-create Lists from Radicale --
    that would require deciding which Lists to make and we don't have a
    naming convention for that yet).
    """
    counts = {"created": 0, "updated": 0, "deleted": 0}
    if not is_enabled():
        return counts

    for list_obj in List.objects.exclude(remote_url__isnull=True).exclude(remote_url=""):
        cal = _calendar_for(list_obj)
        if cal is None:
            continue
        try:
            remote_todos = cal.todos(include_completed=True)
        except Exception as exc:
            log.warning("radicale pull list=%s failed: %s", list_obj.pk, exc)
            continue

        seen_uids: set[str] = set()
        for todo in remote_todos:
            comp = todo.icalendar_component
            uid = str(comp.get("UID"))
            seen_uids.add(uid)
            fields = _parse_vtodo(comp)
            task = Task.objects.filter(remote_uid=uid).first()
            if task is None:
                Task.objects.create(
                    list=list_obj,
                    remote_uid=uid,
                    remote_etag=getattr(todo, "etag", None),
                    **fields,
                )
                counts["created"] += 1
            else:
                changed = False
                for k, v in fields.items():
                    if getattr(task, k) != v:
                        setattr(task, k, v)
                        changed = True
                etag = getattr(todo, "etag", None)
                if etag and task.remote_etag != etag:
                    task.remote_etag = etag
                    changed = True
                if changed:
                    task.save()
                    counts["updated"] += 1

        # Anything Django had as belonging to this list with a remote_uid that
        # the phone deleted -> drop it on our side too.
        stale = Task.objects.filter(list=list_obj).exclude(remote_uid__isnull=True).exclude(remote_uid="").exclude(remote_uid__in=seen_uids)
        counts["deleted"] += stale.count()
        stale.delete()

    return counts


def _build_vtodo(task: Task, uid: str) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//personal-management//EN",
        "BEGIN:VTODO",
        f"UID:{uid}",
        f"SUMMARY:{_escape(task.title)}",
        f"STATUS:{'COMPLETED' if task.completed else 'NEEDS-ACTION'}",
    ]
    if task.description:
        lines.append(f"DESCRIPTION:{_escape(task.description)}")
    if task.due_date:
        lines.append(f"DUE;VALUE=DATE:{task.due_date.strftime('%Y%m%d')}")
    lines.append("END:VTODO")
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("\n", "\\n").replace(",", "\\,").replace(";", "\\;")


def _parse_vtodo(comp) -> dict:
    due = comp.get("DUE")
    due_date: date | None = None
    if due is not None:
        dt = due.dt
        due_date = dt if isinstance(dt, date) else dt.date()
    return {
        "title": str(comp.get("SUMMARY", "")),
        "description": str(comp["DESCRIPTION"]) if "DESCRIPTION" in comp else None,
        "completed": str(comp.get("STATUS", "")).upper() == "COMPLETED",
        "due_date": due_date,
    }
