#!/usr/bin/env sh
set -e

# setting env vars
set -a
source .env
set +a

exec $@
