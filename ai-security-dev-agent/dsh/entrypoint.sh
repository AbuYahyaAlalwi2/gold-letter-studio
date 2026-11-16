#!/bin/sh
set -eu
: "${DSH_PUBLIC_URL:=http://localhost:3000/}"
: "${DSH_TRUSTED_HOST:=localhost}"
# DSH rejects wildcard binds. Bind the container's concrete address instead.
CONTAINER_IP="$(node -e "for (const entries of Object.values(require('os').networkInterfaces())) { const address = entries.find((entry) => entry.family === 'IPv4' && !entry.internal); if (address) { process.stdout.write(address.address); break; } }")"
if [ -z "$CONTAINER_IP" ]; then
  echo "Could not determine container IP for DSH listener" >&2
  exit 1
fi
exec dsh web --no-open --host "$CONTAINER_IP" --port 3000 \
  --public-url "$DSH_PUBLIC_URL" --trusted-host "$DSH_TRUSTED_HOST" \
  --patch /opt/dsh/model-gateway.patch.yml
