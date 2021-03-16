FROM python:3.9-slim

ENV PYTHONUNBUFFERED 1

RUN mkdir /app
WORKDIR /app

ADD . /app/

# To keep the docker image small, install the runtime dependencies and then clean the build dependencies.
RUN /app/docker/setup.sh --install && /app/docker/setup.sh --cleanup
