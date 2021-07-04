from dataclasses import dataclass

from frictionless import Package, Resource

from podnebnik.utils import read_frictionless_resource_data


VISUALISATIONS = [
    ("emissions", "Emissions"),
]


@dataclass
class VisualisationData:
    id: str
    data: any


def get_visualisations_data(visualisations):
    for visualisation in visualisations:
        if visualisation == 'emissions':
            package: Package = Package('https://github.com/podnebnik/data/raw/master/emissions.zip', innerpath='datapackage.yaml')
            resource: Resource = package.get_resource('historical_emissions')
            yield VisualisationData(id='emissions-data', data=read_frictionless_resource_data(resource))
