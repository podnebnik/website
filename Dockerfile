FROM node:14-buster as frontend-builder

WORKDIR /build

RUN apt-get update && \
    apt-get install -y apt-transport-https

RUN wget https://packages.microsoft.com/config/debian/10/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
RUN dpkg -i packages-microsoft-prod.deb

RUN apt-get update && \
    apt-get install -y dotnet-sdk-5.0

COPY .config/dotnet-tools.json /build/.config/dotnet-tools.json

COPY package.json /build/package.json
COPY yarn.lock /build/yarn.lock
RUN yarn install

COPY webpack.config.js /build/webpack.config.js
COPY frontend /build/frontend
RUN yarn run build

# -----------------------------------------------------------------------------

ARG BASE_VERSION=v1
FROM ghcr.io/podnebnik/website:${BASE_VERSION}

ENV PYTHONUNBUFFERED 1

WORKDIR /app
ADD . /app/
RUN mkdir -p /app/logs

RUN /app/docker/setup.sh --install && /app/docker/setup.sh --cleanup

RUN /app/docker/setup.sh --install && pipenv lock -r > /tmp/requirements.txt && pipenv --rm && \
    pip3 --disable-pip-version-check --no-cache-dir install -r /tmp/requirements.txt && \
    rm /tmp/requirements.txt && \
    /app/docker/setup.sh --cleanup

RUN ln -s /app/podnebnik/settings/kubernetes.py /app/podnebnik/settings/__init__.py
RUN chown -R www-data:www-data .

RUN SECRET_KEY=nosecret python3 manage.py collectstatic --no-input

ENTRYPOINT ["circusd", "circus.ini"]
