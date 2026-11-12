#!/bin/sh
set -eu
: "${DSH_PUBLIC_URL:=http://localhost:3080/}"
: "${DSH_TRUSTED_HOST:=localhost}"
# DSH rejects wildcard binds. Bind the container's concrete address instead.
CONTAINER_IP="$(hostname -i | awk '{print $1}')"
if [ -z "$CONTAINER_IP" ]; then
  echo "Could not determine container IP for DSH listener" >&2
  exit 1
fi
exec dsh web --no-open --host "$CONTAINER_IP" --port 3080 \
  --public-url "$DSH_PUBLIC_URL" --trusted-host "$DSH_TRUSTED_HOST" \
  --patch /opt/dsh/model-gateway.patch.yml
