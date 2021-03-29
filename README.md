# Podnebnik

## Development

This project uses the following requirements:

- `Python 3.9`
- `pipenv`
- `node`

To start developing, first create a python virtual environment, install dependencies and run the server:

    pipenv install --dev
    pipenv shell

    # Pick one of the configurations: devcontainer.py, develop.py, kubernetes.py
    ln -s develop.py ./podnebnik/settings/__init__.py

    ./manage.py runserver

Run the webpack development server:

    yarn install
    yarn run start

Point your browser to:

    http://localhost:8080/
