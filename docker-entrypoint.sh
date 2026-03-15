#!/bin/sh
set -e

echo "Syncing static assets into public/ volume..."
cp -rf /app/public-static/. /app/public/

echo "Running database migrations..."
cd /app/server
PIPELINE_DATABASE_URL="$PIPELINE_DATABASE_URL" bunx drizzle-kit migrate

echo "Starting server..."
cd /app
exec bun run server/index.ts
