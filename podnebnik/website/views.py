from frictionless import Package, Resource

from django.shortcuts import render

from podnebnik.utils import read_frictionless_resource_data


def home(request):
    package: Package = Package('https://github.com/podnebnik/data/raw/master/emissions.zip', innerpath='datapackage.yaml')
    resource: Resource = package.get_resource('historical_emissions')

    data = read_frictionless_resource_data(resource)

    return render(request, 'website/home.html', {
        'emissions_data': data
    })
