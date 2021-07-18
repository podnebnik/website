from pathlib import Path
from .base import * # noqa
from .base import BASE_DIR


DEBUG = True

ALLOWED_HOSTS = ['*']

SECRET_KEY = '%#orw69hm#755h)i2gq=wyds02+82rh5j*mjh2r7p12lesac=_'

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': Path(BASE_DIR, 'db.sqlite3'),
    }
}
