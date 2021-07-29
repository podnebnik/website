from dataclasses import dataclass

from frictionless import Package, Resource

from podnebnik.utils import read_frictionless_resource_data


# -----------------------------------------------------------------------------
# Visualisations data

@dataclass
class VisualisationData:
    id: str
    data: any

def get_electricity_data() -> VisualisationData:
    package: Package = Package('https://github.com/podnebnik/data/raw/master/packages/electricity.zip', innerpath='datapackage.yaml')
    resource: Resource = package.get_resource('electricity.emissions')
    return VisualisationData(id='electricity-data', data=read_frictionless_resource_data(resource))

def get_emissions_data() -> VisualisationData:
    package: Package = Package('https://github.com/podnebnik/data/raw/master/packages/emissions.zip', innerpath='datapackage.yaml')
    resource: Resource = package.get_resource('historical_emissions')
    return VisualisationData(id='emissions-data', data=read_frictionless_resource_data(resource))


# -----------------------------------------------------------------------------
# Visualisations

@dataclass
class Visualisation:
    # Unique ID across all the visualisations
    id: str
    # User friendly visualisation name
    name: str
    # JavaScript function available on the window (e.g. emissionsChart for window.Visualistaions.emissionsChart)
    function: str
    # A list of arguments for the JavaScript function
    args: list[str]
    # A list of functions returning the VisualisationData objects to be embeded on the page
    data: list[VisualisationData]


VISUALISATIONS = [
    Visualisation(
        id="electricity-emissions",
        name="Electricity emissions",
        function="electricityChart",
        args=["columns", "500", "electricity-data"],
        data=[get_electricity_data]),
    Visualisation(
        id="emissions-area",
        name="Area emissions",
        function="emissionsChart",
        args=["area", "500", "emissions-data"],
        data=[get_emissions_data]),
    Visualisation(
        id="emissions-columns",
        name="Columns emissions",
        function="emissionsChart",
        args=["columns", "400", "emissions-data"],
        data=[get_emissions_data]),
]
