# Podnebnik

This repository is the source code for the podnebnik.org website.

The project is structured as a multi page, statically generated web site that allows authors to create rich narratives by combining data, text and visualizations. By combining data, content and code in one repository it is possible to keep all three components in sync, have a single source of truth, and a complete history of changes.

The project resources are organized in following top level folders:
- `data` folder contains the data in the form of Frictionless Data packages
- `code` folder contains the code for the visualizations
- `pages` folder contains the text content of the website
- `styles` folder contains the CSS stylesheets
- `assets` folder contains the static assets, such as images and fonts
- `deployment` folder contains the deployment definitions such as Dockerfiles

The project is build on top of the following fantastic tools:
- [11ty](https://www.11ty.dev/) static site generator
- [Highcharts](https://www.highcharts.com/) charting library
- [Frictionless Data](https://frictionlessdata.io/) data packaging and validation
- [Datasette](https://datasette.io/) SQLite database viewer
- [Fable](https://fable.io/) F# to JavaScript compiler
- [Tailwind CSS](https://tailwindcss.com/) utility-first CSS framework
- [Solid JS](https://www.solidjs.com/) a reactive JavaScript library

## Development setup

Depending on whether you want to author data, text or visualizations, you will need to install different tools. However, the basic setup is the same for all three.

To start developing you need to have the following requirements on:

- `node` https://nodejs.org/en/
- `.NET 6.0` https://dotnet.microsoft.com/en-us/download
- `python 3.11` https://www.python.org/
- `pipenv` https://pipenv.pypa.io/

We suggest uou use [pyenv](https://github.com/pyenv/pyenv) to install and manage the python version(s) on your system. Once you have `pyenv` installed, the `pipenv` will automatically use it to install the correct python version.

To start developing, first create a python virtual environment, install the necessary dependencies and activate the created virtual environment:

    pipenv install --dev
    pipenv shell

Next, install the JavaScript dependencies:

    yarn install

You can now start the development server:

    yarn run start

and point your browser to:

    http://127.0.0.1:8080/

> NOTE: The projects requirements may change over time. To keep your development environment up to date, run `pipenv install --dev` and `yarn install` from time to time. If the python version is upgraded as well, please run `pipenv --rm` first to remove the old virtual environment. Also, in case of major changes to the JavaScript dependencies, you may need to run `yarn install --force` to force the installation of the new dependencies.

> NOTE: The development server is configured to watch for changes in the `code`, `pages` and `styles` folders. If you make changes to any of these folders, the server will automatically rebuild the site and reload the browser. However, there may be cases where the server does not detect the changes. In that case, you can force the server to rebuild the site by pressing `Ctrl + C` and then run `yarn start` again. In some cases it may help to run `yarn clean` before running `yarn start` again.

## Developing data

Please see https://github.com/podnebnik/data for more information. Please not that we are in the process of merging the two repositories so the current information in the `data` repository may be out of date.

## Developing content

The content is a collection of HTML and Markdown files in the `pages` folder. The URLs on the web page are derived from the file paths. For example, the file `pages/objave/energetika.md` will be available at `https://podnebnik.org/objave/energetika/`.

Probably the easiest way to start authoring content is to look at the existing pages in the `pages` folder to see how things are organized and copy an existing page as your starting point. This should in most cases be enough to get you started. However, for more details on how to organize and manipulate the content please look at the [11ty documentation](https://https://www.11ty.dev/docs/).

> NOTE: 11ty supports a number of templating languages. However, to keep markup consistent, the recommended templating language in this project is [Liquid JS](https://liquidjs.com/).

## Developing visualizations

Technically and for the purpose of this project, a visualization is a JavaScript function that renders the content of the visualization in the provided DOM element. You can in principle use any JavaScript library or language that compiles to JavaScript. However, we recommend using [Fable](https://fable.io/) and/or JavaScript together with [Solid JS](https://www.solidjs.com/) as we have found these to be the most productive and performant for most cases. See `code/examples` for examples of visualizations.

This is an example how to include the visualization in the page (the visualization uses Solid JS):

```HTML
<div class="chart" id="my-chart">
    <script type="module">
        import { render } from 'solid-js/web'
        import Chart from '/code/examples/javascript.highcharts/chart.jsx'
        render(() => Chart({kind: 'line'})), document.getElementById('my-chart')
    </script>
</div>
```

If you want to render your visualization lazily (recommended), you can use the provided `lazy` wrapper which will render the visualization only when the user scrolls the document to that visualization:

```HTML
<div class="chart" id="my-chart">
    <script type="module">
        import Lazy from '/code/lazy.jsx'
        import { render } from 'solid-js/web'
        import Chart from '/code/examples/javascript.highcharts/chart.jsx'
        render(() => Lazy(() => Chart({kind: 'line'})), document.getElementById('my-chart'))
    </script>
</div>
```

Visualizations will usually need to load some data. The two main cases will be:

1. Data is small enough to be loaded at once and embedded directly into the visualization.
2. Data is large and needs to be loaded asynchronously (based on some query) via an API.

For the first case we suggest to load the data directly from the `data` folder. This will also ensure that the data is always available and that the visualization will not break even if the API is down.

> TODO: provide the infrastructure and examples of how to load data from the `data` folder.

For the second case we provide a [Datasette](https://datasette.io/) API that serves all the data in this repository.

> TODO: provide the infrastructure and examples of how to load data from the Datasette API.
