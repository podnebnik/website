# Podnebnik

## Development setup

This project uses the following requirements:

- `Python 3.9`
- `pipenv`
- `node`

To start developing, first create a python virtual environment, install dependencies and run the server:

    pipenv install --dev
    pipenv shell

Pick one of the project configurations: develop.py, devcontainer.py, ...

    ln -s develop.py ./podnebnik/settings/__init__.py

Create a super user for the website:

    ./manage.py createsuperuser

Run the django project:

    ./manage.py runserver

Open a new terminal window and run the webpack development server:

    yarn install
    yarn run start

Point your browser to:

    http://127.0.0.1:8080/


To use the CMS or Admin go to:

    http://127.0.0.1:8080/cms/
    http://127.0.0.1:8080/admin/

To log in, use the credentials created with the `./manage.py createsuperuser` command.

## Developing a new visualisation

Technically, a visualisation is a JavaScript function that renders the content in the DOM element. The first argument to the function must be a DOM element ID and the function must render its content in the DOM element identified by that ID. The function can take other arguments, but the first argument must always be a DOM element ID.

To use the visualisation and make it available to authors via the CMS, you must first register the visualisation:

1. import the visualisation function and add it to the `window.Visualisation` in `frontend/scripts/main.js`.
2. add the visualisation to the list of visualisations in `podnebnik/visualisations.py`.

Visualisations can be developed in any language that can be compiled to JavaScript, as long as the above requirements are met.

Visualisations can request data to be embedded directly into the page and then used without an asynchronous network call. This mechanism is provided for two reasons:

1. server-side loading of data without the need for a separate API.
2. simpler code/logic and potentially faster load times.

Whether this mechanism is a good case for a particular visualisation is up to the author. Certainly it is not suitable for large data sets, where some sort of API and asynchronous loading is a better approach.

TODO: Explain the data embedding logic in more detail and how it is done with DataPackages.
