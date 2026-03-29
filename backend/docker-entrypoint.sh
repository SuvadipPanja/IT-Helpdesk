#!/bin/sh
set -eu

node /app/scripts/wait-for-db.js
exec node /app/server.js
