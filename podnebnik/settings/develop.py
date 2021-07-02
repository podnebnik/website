from .base import *


DEBUG = True

SECRET_KEY = '%#orw69hm#755h)i2gq=wyds02+82rh5j*mjh2r7p12lesac=_'

# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.postgresql',
#         'NAME': 'podnebnik',
#     }
# }

# Database
# https://docs.djangoproject.com/en/3.1/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}
