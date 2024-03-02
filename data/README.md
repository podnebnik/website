# Podnebnik Data Sources

# Note: this readme is copied from the existing /Podnebnik/data repo and will be appropriately adapted. Original repo will be archieved

This is a collection of open data sources related to the climate change. We use the [Frictionless Data Framework](https://framework.frictionlessdata.io/) to organize and describe the data.

Currently we provide the following data packages:

- [Emissions](./datasets/emissions/)
- [Electricity](./datasets/electricity/)

For details about the provided data, please consult the `datapackage.yaml` files in the individual data package folders.


# How to create your new data package

A datapackage is a combination of data resources (`.csv` data files) and a datapackage descriptor file (`.yaml`) containing the metadata.

Create a fork of the `https://github.com/podnebnik/data` repository and follow the instructions below to create your datapackage. You can also look at the existing datapackages for reference.


## Preparing the data resources

Use the following template for your datapackage folder structure that you should place in the root of the `https://github.com/podnebnik/data` repository:

```
datasets/
    - emissions/
        - datasets/
            - sources/
                emissions.xlsx
                pipeline.py
            emissions.csv
            emissions.energy.csv
            emissions.aviation.csv
            emissions.agriculture.csv
        datapackage.yaml
```

1. give your datapackage a unique and descriptive name (e.g. "emissions") and name the folder in root.
2. within the folder create a `datasets/sources/` subfolder for the original data files (if they exist) and any for code used to transform the data into `.csv` files.
3. place the `.csv` files into the `datasets/` subfolder (see below for more details on these files)
4. prepare the metadata `.yaml` file for your datapackage (see below for detailed instructions on how to do that).


## Preparing the data files (`.csv` format)

Data files should be in `.csv` format:

* single row header
* comma separated fields
* one row per record of equal length

The file names should be:

* descriptive and understandable, avoid unfamiliar abbreviations
* if you have several files in your datapackage, they should all have a common and unique prefix - usually the same one as the name of your datapackage (see the example above).

The variable names should be:

* descriptive and understandable, avoid unfamiliar abbreviations
* avoid redundancy: if a descriptor is in the filename, there is no need to repeat it in the variable names
* do not use spaces or any special characters except underscores "`_`"
* use a double underscore "`__`" to delineate hierarchical levels e.g. `fuel_combustion__transport`

*e.g. if the file name is `emissions.agriculture.csv` the following applies for variable names:*

* `emissions.agriculture.manure.management` - not OK
* `emissions_agriculture__manure_management` - not OK
* `manure.management` - not OK
* `manure_management` - OK


## Preparing the metadata

Once the data files are all ready, you will

1. use the `python` package `frictionless` to infer the basic metadata directly from the files into a `.yaml` file
2. manually add the information that cannot be inferred into the `.yaml` file just created.

The final `.yaml` file containing the metadata should be stored at the same level as the `datasets/` subfolder in your datapackage.


### Automatic description of the datapackage

Make sure you have python installed on your system, then install the `frictionless` package:

    pip install frictionless

Alternatively, we also provide a `Pipfile` to install the `frictionless` package, which will install the required modules in a new virtual environment (see https://pipenv.pypa.io/ for details):

    pipenv install    # create the python virtual environment and install the necessary modules
    pipenv shell      # activate the newly created python virtual environment

The `frictionless` command `describe` will automatically create the basic metadata file.

From your datapackage folder you can describe a set of `.csv` files with the help of the `*` wildcard operator like in the following example.

    frictionless describe datasets/emissions*.csv --yaml > datapackage.yaml

This creates a `datapackage.yaml` file inferring the metadata for all files that follow the `emissions*.csv` pattern in the `data\` folder.


### Manually amend the datapackage metadata

Open the `datapackage.yaml` file and amend it to add

* *package-level metadata* i.e. information that applies to all the `.csv` files in your datapackage
* *resounce-level metadata* i.e. information that applies to individual `.csv` files (which are called *resources*).

Pay attention to indentation! A newly created `datapackage.yaml` file will only have two fields at the top level: `profile` and `resources`. You should attempt the following fields (*but if any of this metadata does not apply equally to all of the files in your datapackage, you should instead add them to the individual resources instead!*):

* `name`: for your short datapackage name, this should be the same as the folder name (e.g. emissions)
* `title`: should be a longer name of your datapackage (e.g. Historical and projected CO2 equiv. emissions)
* `description`: enter a longer description of your datapackage
* `keywords`: enter relevant keywords in english as an array enclosed in square brackets (e.g. [emissions, agriculure])
* `contributors`: enter a list of authors (please check the [specification](https://specs.frictionlessdata.io/data-package/#contributors) for the list of available fields)
* `geography`: enter the geographic area the data refer to (e.g. Europe)
* `schedule`: enter the time resolution for the data e.g. annual, monthly..
* `sources`: should follow this template:
```
sources:
  - title:            # name of data source - mandatory field!
    path:             # path to file in repo if exists
    url:              # url to original data source if possible
    author:           # organisation or person who is the owner of the data
    code:             # path to code in repo used to transform data into csv files if exists
    date_accessed:    # date when data was extracted in ISO format (e.g. 2021-07-12)
```
* `licenses:` unless required otherwise by your data source, use the following:
```
licenses:
  - name: ODbL-1.0
    title: Open Data Commons Open Database License 1.0
    path: http://www.opendefinition.org/licenses/odc-odbl
```

For each individual file (i.e. resource) check the existing metadata and add or change the following (if appropriate):

* `name`: you should normally  leave the name as it was inferred (the name of the file). Otherwise be careful because no spaces are allowed in the name! (e.g. `historical.emissions.agriculture`)
* `title`: should be a longer name describing your data file (e.g. `Historical emissions from agriculture`)

If there is not a common data source for the whole package and individual files have their separate `sources` you must add them here instead:

```
sources:
  - title:            # name of data source - mandatory field!
    path:             # path to file in repo if exists
    url:              # url to original data source if possible
    title:            # name of data source
    author:           # organisation or person who is the owner of the data
    code:             # path to code in repo used to transform data into csv files if exists
    date_accessed:    # date when data was extracted in ISO format (e.g. 2021-07-12)
```

Finally, the fields in each resource: they already have the `resource.schema.fields.name` and `resource.schema.fields.type` values inferred.

* `name`: do not change this value, it should be identical to the one in the `.csv` file.
* `type`: you should check the types are correct and change them if required. Usually this will only mean changing the values to `date` or `year` if appropriate.
* `title`: add a descriptive title e.g. `luluc` -> `Land use and land use change`
* `unit`: if appropriate, add the unit of the variable
* you can also add a `format` field. See [here](https://specs.frictionlessdata.io/table-schema/#types-and-formats) for valid types and formats.
* You can also add constraints for the fields, as well as missing value definitions and primary and foreign keys if necessary. See [this](https://specs.frictionlessdata.io/table-schema/#constraints) for more options.


### Translate the metadata

Once you're finished editing the `datapackage.yaml` file, make a copy of the file and name it `datapakcage.si.yaml` Keeping the keys in the original English, translate the values into Slovenian for the following fields: `name`, `title`, `description`, `keywords`, `resources.name`, `resources.title`, `resources.sources.title`, `resources.sources.title`, `resources.schema.fields.title` and `resource.schema.fields.unit` as appropriate.

*Do not translate any of the values for the `name` keys!*


## Finished?

Once you're happy with the files, the folder structure and the `datapackage.yaml` metadata file, create a (draft) pull request tagging @joahim and @majazaloznik as reviewers.


# Data package command line tool

Frictionless Data Framework provides a command line tool to help you describe, extract and validate your data. The easiest way to install the framework is to use the [pipenv](https://pipenv.pypa.io/en/latest/) and run:

```bash
pipenv install
```

You can then run the tool with:

```bash
pipenv run frictionless
```

For example, to validate the data package, run:

```bash
pipenv run frictionless validate emissions/datapackage.yaml
```

Run datasette
```
docker run --rm -p 8001:8001 ghcr.io/podnebnik/data:latest

or locally

invoke datasette
```
