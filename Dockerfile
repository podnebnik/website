FROM node:19 as frontend-builder

WORKDIR /build

RUN apt-get update && \
    apt-get install -y apt-transport-https

RUN wget https://packages.microsoft.com/config/debian/11/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
RUN dpkg -i packages-microsoft-prod.deb

RUN apt-get update && \
    apt-get install -y dotnet-sdk-6.0

COPY .config/dotnet-tools.json /build/.config/dotnet-tools.json

COPY package.json /build/package.json
COPY yarn.lock /build/yarn.lock
RUN yarn install

COPY webpack.config.js /build/webpack.config.js
COPY frontend /build/frontend
RUN yarn run build

# -----------------------------------------------------------------------------

FROM ghcr.io/podnebnik/website-base:v1

ENV PYTHONUNBUFFERED 1

WORKDIR /app
ADD . /app/
RUN mkdir -p /app/logs

RUN DEBIAN_FRONTEND=noninteractive pipenv install --system --deploy --ignore-pipfile && pip3 uninstall -y pipenv

RUN ln -s /app/podnebnik/settings/kubernetes.py /app/podnebnik/settings/__init__.py && \
    SECRET_KEY=nosecret python3 manage.py collectstatic --no-input && \
    chown -R www-data:www-data .

COPY --from=frontend-builder --chown=www-data:www-data /build/podnebnik/static/frontend /app/static/frontend

ENTRYPOINT ["circusd", "circus.ini"]
