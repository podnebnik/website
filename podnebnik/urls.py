from django.contrib import admin
from django.conf import settings
from django.urls import path, include
from django.conf.urls.static import static
from django.conf.urls.i18n import i18n_patterns

from wagtail.admin import urls as wagtailadmin_urls
from wagtail.core import urls as wagtail_urls
from wagtail.documents import urls as wagtaildocs_urls

admin.site.enable_nav_sidebar = False

urlpatterns = [
    path('cms/', include(wagtailadmin_urls)),
    path('admin/', admin.site.urls),
    path('documents/', include(wagtaildocs_urls)),
]

urlpatterns = urlpatterns + i18n_patterns(
    path("", include(wagtail_urls)),
)

urlpatterns = urlpatterns + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
