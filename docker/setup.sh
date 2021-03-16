#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

APT_BUILD_DEPS="build-essential python3-dev libpq-dev"
APT_DEPS="nginx libpq5"
PIP_DEPS="circus==0.17.1 uwsgi==2.0.19.1 pipenv==2020.11.15"

apt_update() {
    apt-get update
}

apt_cleanup() {
    apt-get autoremove -y
    rm -rf /var/lib/apt/lists/*
}

pip_install() {
    pip3 --disable-pip-version-check --no-cache-dir install $@
}

apt_install() {
    apt-get install -y --no-install-recommends $@
}

apt_uninstall() {
    apt-get purge -y $@
}

setup_dev() {
    apt_install sudo zsh git pipx python3-venv
    useradd -ms /usr/bin/zsh $USERNAME
    echo "$USERNAME ALL=(ALL:ALL) NOPASSWD: ALL" > /etc/sudoers.d/$USERNAME
    sudo -u $USERNAME sh -c "$(curl -L https://github.com/deluan/zsh-in-docker/releases/download/v1.1.1/zsh-in-docker.sh)" -- -p git
    sudo -u $USERNAME pipx install flake8
    sudo -u $USERNAME pipx install autopep8
}

setup_runtime() {
    apt_update
    apt_install $APT_BUILD_DEPS $APT_DEPS
    pip_install $PIP_DEPS
}

case $1 in 
    --install)
        setup_runtime
        ;;
    --cleanup)
        apt_uninstall $APT_BUILD_DEPS
        apt_cleanup
        ;;
    --dev)
        setup_runtime
        setup_dev
        ;;
esac
