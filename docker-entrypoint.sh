#!/usr/bin/env bash
set -e

# setting env vars
set -a
source $APP_DIR/.env
set +a

exec "$@"
