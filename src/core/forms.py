from django import forms

from .models import List, Task


class ListForm(forms.ModelForm):
    class Meta:
        model = List
        fields = ["title", "view"]


class TaskForm(forms.ModelForm):
    class Meta:
        model = Task
        fields = ["title", "description", "due_date", "list"]
        widgets = {
            "title": forms.TextInput(
                attrs={"class": "input input-bordered w-full", "placeholder": "Task title"}
            ),
            "description": forms.Textarea(
                attrs={"class": "textarea textarea-bordered w-full", "rows": 3}
            ),
            "due_date": forms.DateInput(
                attrs={"type": "date", "class": "input input-bordered w-full"}
            ),
            "list": forms.Select(attrs={"class": "select select-bordered w-full"}),
        }
