import os
from pathlib import Path

from .base import *

DEBUG = False

ALLOWED_HOSTS = list(map(str.strip, os.getenv('ALLOWED_HOSTS', '*').split(',')))
SECRET_KEY = os.getenv('SECRET_KEY')

STATIC_ROOT = Path(BASE_DIR, '../static').resolve()

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DATABASE_NAME'),
        'USER': os.getenv('DATABASE_USER'),
        'PASSWORD': os.getenv('DATABASE_PASS'),
        'HOST': os.getenv('DATABASE_HOST', 'localhost'),
        'PORT': int(os.getenv('DATABASE_PORT', '5432')),
    }
}

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'default',
        'TIMEOUT': 60,
    }
}
