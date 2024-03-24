from invoke import task

import glob
import json
import shutil
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


def get_datapackage_paths():
    return [Path(p) for p in glob.glob(f'{DATASETS_DIR}/*/datapackage.yaml')]


def get_datapackages():
    return [Package(path) for path in get_datapackage_paths()]


@task
def validate(c):
    '''Validate available data packages.'''
    print('Validating data packages:\n')
    invalid_package_paths = []
    for path in get_datapackage_paths():
        package = Package(path)
        print(f'  Name: {package.name}')
        print(f'  Path: {path}')
        print(f' Title: {package.title}')
        report = package.validate()
        if report.valid:
            print(f'Status: {Color.success("valid")}')
        if not report.valid:
            print(f'Status: {Color.failure("invalid")}')
            invalid_package_paths.append(path)
        print()

    if not invalid_package_paths:
        print('All data packages are valid.')
    else:
        print('Please validate the followind data packages to get more information:')
        for path in invalid_package_paths:
            print(f'  frictionless validate {path}')
        exit(1)


def none_if_empty(value):
    if value:
        return value
    else:
        return None


@task
def create_databases(c):
    '''Create sqlite database, import resources data and generate datasette metadata.'''
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

        print(f'\nImporting data package {package.name}:')

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

        # Import resources
        for resource in package.resources:
            if resource.format == 'csv':
                # Import the resource if it is a CSV file
                print(f'    Importing resource {resource.name}, {resource.format} @ {resource.path}')
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
                print(f'    Skipping resource {resource.name}, {resource.format} @ {resource.path}')
            c.run(f'sqlite-utils insert {database} {resource.name} {DATASETS_DIR / package_path.parent / resource.path} --csv --detect-types --silent')

    # Create the datasette inspect file
    c.run(f'datasette inspect {" ".join([str(db) for db in databases])} --inspect-file {SQLITE_DIR / "inspect-data.json"}')

    # Create the datasette metadata file
    with open(SQLITE_DIR / 'metadata.json', 'w') as fo:
        json.dump(metadata, fo, indent=4)


@task
def datasette(c):
    '''Start datasette server.'''
    create_databases(c)
    print('\nStarting Datasette server...\n')
    # TODO: remove custom setting when no longer needed
    c.run(f'datasette serve {SQLITE_DIR} --inspect-file {SQLITE_DIR}/inspect-data.json --metadata {SQLITE_DIR}/metadata.json --port 8010 --cors --setting max_returned_rows 150000')
