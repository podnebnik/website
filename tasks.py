from invoke import task

import glob
from pathlib import Path
from frictionless import Package


BASE_DIR = Path(__file__).parent
DATASETS_DIR = BASE_DIR / 'datasets'


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
def datasette(c):
    dbname = 'datasette.db'
    for package in get_datapackages():
        package.to_sql(f'sqlite:///{dbname}.db')
