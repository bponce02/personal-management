from django.contrib import admin
from django.urls import path, re_path
from django.views.generic import TemplateView

from core.api import api

# /admin/ and /api/ are matched first; everything else falls through to the SPA
# shell so TanStack Router can take over client-side. Static files are served by
# django.contrib.staticfiles in DEBUG before the URL resolver runs.
urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
    re_path(r"^.*$", TemplateView.as_view(template_name="index.html"), name="spa"),
]
