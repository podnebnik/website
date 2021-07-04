from dataclasses import dataclass

from frictionless import Package, Resource

from podnebnik.utils import read_frictionless_resource_data


@dataclass
class VisualisationData:
    id: str
    data: any


def get_emissions_data() -> VisualisationData:
    package: Package = Package('https://github.com/podnebnik/data/raw/master/emissions.zip', innerpath='datapackage.yaml')
    resource: Resource = package.get_resource('historical_emissions')
    return VisualisationData(id='emissions-data', data=read_frictionless_resource_data(resource))


VISUALISATIONS = [
    ("emissions-area", "Area emissions", [get_emissions_data]),
    ("emissions-columns", "Columns emissions", [get_emissions_data]),
]
