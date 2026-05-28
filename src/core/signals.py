from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from . import radicale_sync
from .models import List, Task


@receiver(post_save, sender=List)
def _list_saved(sender, instance: List, created: bool, **kwargs):
    if created:
        radicale_sync.ensure_calendar(instance)


@receiver(post_save, sender=Task)
def _task_saved(sender, instance: Task, **kwargs):
    radicale_sync.push_task(instance)


@receiver(post_delete, sender=Task)
def _task_deleted(sender, instance: Task, **kwargs):
    radicale_sync.delete_task(instance)
