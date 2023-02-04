from invoke import task

import glob
from pathlib import Path
from frictionless import Package


BASE_DIR = Path(__file__).parent
DATASETS_DIR = BASE_DIR / 'datasets'
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


@task
def create_databases(c):
    validate(c)
    for package_path in get_datapackage_paths():
        package = Package(package_path)
        database = Path(f'{SQLITE_DIR / package.name}.db')
        print(f'\nImporting data package {package.name}:')
        SQLITE_DIR.mkdir(parents=True, exist_ok=True)
        database.unlink(missing_ok=True)
        for resource in package.resources:
            if resource.format == 'csv':
                print(f'    Importing resource {resource.name}, {resource.format} @ {resource.path}')
            else:
                print(f'    Skipping resource {resource.name}, {resource.format} @ {resource.path}')
            c.run(f'sqlite-utils insert {database} {resource.name} {DATASETS_DIR / package_path.parent /resource.path} --csv --detect-types --silent')


@task
def datasette(c):
    create_databases(c)
    print('\nStarting Datasette server...\n')
    c.run(f'datasette serve {SQLITE_DIR} --port 8001 --cors')
