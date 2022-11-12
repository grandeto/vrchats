#!/usr/bin/env bash
set -e

# setting env vars
set -a

source $APP_DIR/.env

export APP_MODE=standalone

if [ $CLUSTER_MODE == "1" ]; then
    APP_MODE=cluster
fi

set +a

exec "$@"
