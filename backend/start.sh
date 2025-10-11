#!/bin/sh
set -e

echo "=== CountIn Backend Startup ==="

# Wait for database
python wait-for-db.py

# Run database migrations
echo "Running database migrations..."
python -c "from app.core.database import init_db; init_db()" || echo "Migration check complete"

# Start the application
echo "Starting uvicorn server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --timeout-keep-alive 120 --workers 1 --log-level info
