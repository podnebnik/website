from invoke import task

import glob
import io
import json
import shutil
import sys
from pathlib import Path
from frictionless import Package


BASE_DIR = Path(__file__).parent
DATASETS_DIR = BASE_DIR / 'data'
SQLITE_DIR = BASE_DIR / 'var/sqlite'


class Color:
    from colorama import Fore, Style

    @staticmethod
    def success(text):
        return f'{Color.Fore.GREEN}{text}{Color.Style.RESET_ALL}'

    @staticmethod
    def failure(text):
        return f'{Color.Fore.RED}{text}{Color.Style.RESET_ALL}'


def log(msg):
    print(msg, file=sys.stderr)


def get_datapackage_paths():
    excluded = {'emissions', 'temperature-extra'}
    return [Path(p) for p in glob.glob(f'{DATASETS_DIR}/*/datapackage.yaml') if Path(p).parent.name not in excluded]


def get_datapackages():
    return [Package(path) for path in get_datapackage_paths()]


@task
def validate(c):
    '''Validate available data packages.'''
    log('Validating data packages:\n')
    invalid_package_paths = []
    for path in get_datapackage_paths():
        package = Package(path)
        log(f'  Name: {package.name}')
        log(f'  Path: {path}')
        log(f' Title: {package.title}')
        report = package.validate()
        if report.valid:
            log(f'Status: {Color.success("valid")}')
        if not report.valid:
            log(f'Status: {Color.failure("invalid")}')
            invalid_package_paths.append(path)
        log('\n')

    if not invalid_package_paths:
        log('All data packages are valid.')
    else:
        log('Please validate the followind data packages to get more information:')
        for path in invalid_package_paths:
            log(f'  frictionless validate {path}')
        exit(1)


def none_if_empty(value):
    if value:
        return value
    else:
        return None


@task(iterable=['no_validate_arch'])
def create_databases(c, no_validate=False, no_validate_arch=None):
    '''Create sqlite database, import resources data and generate datasette metadata.'''

    do_validation = True
    if no_validate:
        log("Passed in --no-validate, not doing validation")
        do_validation = False

    if do_validation and no_validate_arch:
        # this is a pragmatic option to avoid doing slow data validation in github action
        import platform
        machine = platform.machine()
        if machine in no_validate_arch:
            log(f"Passed in --no-slow-validate, not doing validation on {machine}.")
            do_validation = False

    if do_validation:
        validate(c)

    # Reset the sqlite databases directory
    shutil.rmtree(SQLITE_DIR, ignore_errors=True)
    SQLITE_DIR.mkdir(parents=True, exist_ok=True)

    # Datasette metadata
    metadata = {
        'title': 'Podnebnik',
        'description': 'Podatki o podnebnih spremembah.',
        # 'license': None,
        # 'license_url': None,
        # 'source': None,
        # 'source_url': None,
        'databases': {}
    }

    databases = []

    # Create a new database for each data package
    for package_path in get_datapackage_paths():
        package = Package(package_path)
        database = Path(f'{SQLITE_DIR / package.name}.db')
        databases.append(database)

        log(f'\nImporting data package {package.name}:')

        # Package metadata
        metadata['databases'][package.name] = {
            'title': package.title,
            'description': package.description,
            'license': none_if_empty(', '.join([license.title for license in package.licenses if hasattr(license, 'title')])),
            'license_url': none_if_empty(', '.join([license.path for license in package.licenses if hasattr(license, 'path')])),
            # 'source': None,
            # 'source_url': None,
            'tables': {},
        }

        # T-5.49: disable arbitrary SQL (the `?sql=` / `?_where=` surface) per-database.
        # A crawler enumerated stage-data on 2026-08-03 with `?sql=` queries, saturating
        # the datasette pod (~2200m CPU) until it was OOMKilled. `?sql=` and `?_where=`
        # are gated by the single `execute-sql` permission in datasette 0.65.2
        # (default_permissions.py `execute-sql`; filters.py rejects `?_where=` when it is
        # denied), so this `allow_sql: false` block refuses both with 403 for the database
        # it is set on. It is scoped OFF `temperature` on purpose: the legacy
        # /ali-je-vroce/ page (code/ali-je-vroce/helpers.ts) still issues a `?_where=`
        # against temperature, and 0.65.2 has no way to allow `_where` while blocking
        # `?sql=` on the same database. Whether that page is migrated or retired — which
        # would let temperature be closed too — is an operator decision, out of scope here.
        if package.name in ('climate-si', 'emissions'):
            metadata['databases'][package.name]['allow_sql'] = False

        # Import resources
        for resource in package.resources:
            if resource.format == 'csv':
                # Import the resource if it is a CSV file
                log(f'    Importing resource {resource.name}, {resource.format} @ {resource.path}')
                metadata['databases'][package.name]['tables'][resource.name] = {
                    'title': resource.title,
                    'description': resource.description,
                    'license': none_if_empty(', '.join([license.title for license in resource.licenses if 'title' in license])),
                    'license_url': none_if_empty(', '.join([license.path for license in resource.licenses if 'path' in license])),
                    # 'source': None,
                    # 'source_url': None,
                }
                if resource.schema.fields:
                    metadata['databases'][package.name]['tables'][resource.name]['columns'] = dict([(field.name, field.title) for field in resource.schema.fields if hasattr(field, 'title')])
                    metadata['databases'][package.name]['tables'][resource.name]['units'] = dict([(field.name, field.unit) for field in resource.schema.fields if hasattr(field, 'unit')])
            else:
                log(f'    Skipping resource {resource.name}, {resource.format} @ {resource.path}')

            # this only creates tables
            c.run(f'sqlite-utils insert {database} {resource.name} {DATASETS_DIR / package_path.parent / resource.path} --csv --detect-types --silent --stop-after 10')

            # this loads the data
            fake_stdin = io.StringIO()
            fake_stdin.write(f"""delete from "{resource.name}";\n.import --csv --skip 1 {DATASETS_DIR / package_path.parent / resource.path} {resource.name}""")
            fake_stdin.seek(0)
            c.run(f'sqlite3 {database}', in_stream=fake_stdin)


    # Create the datasette inspect file

    log('Creating datasette inspect json.')
    c.run(f'datasette inspect {" ".join([str(db) for db in databases])} --inspect-file {SQLITE_DIR / "inspect-data.json"}')

    # Create the datasette metadata file
    with open(SQLITE_DIR / 'metadata.json', 'w') as fo:
        json.dump(metadata, fo, indent=4)

    log('Done importing data packages.')


@task
def datasette(c):
    '''Start datasette server.'''
    log('\nStarting Datasette server...\n')
    # T-5.49: query-surface hardening (see the allow_sql block in create_databases).
    #   allow_facet false      — refuse ?_facet= (each a COUNT(*) GROUP BY over a table);
    #                            nothing in the repo requests facets.
    #   suggest_facets false   — stop datasette computing suggested facets on every table
    #                            load; nothing reads `suggested_facets` from the response.
    #   allow_csv_stream false — refuse .csv?_stream=1, which otherwise bypasses
    #                            max_returned_rows entirely; nothing in the repo uses it.
    # max_returned_rows stays 150000: the largest legitimate single request is ~70,080 rows
    # (temperature climate_models map via _size=max); lowering it silently truncates those
    # map pages, which have no truncation guard.
    # TODO: remove custom setting when no longer needed
    c.run(f'datasette serve {SQLITE_DIR} --inspect-file {SQLITE_DIR}/inspect-data.json --metadata {SQLITE_DIR}/metadata.json --port 8010 --cors --setting max_returned_rows 150000 --setting allow_facet false --setting suggest_facets false --setting allow_csv_stream false')
