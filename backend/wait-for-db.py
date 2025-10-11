#!/usr/bin/env python3
"""
Wait for database to be ready before starting the application
"""
import time
import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://countin:countin@db:5432/countin")
MAX_RETRIES = 30
RETRY_INTERVAL = 2

def wait_for_db():
    """Wait for database to be ready"""
    print(f"Waiting for database at {DATABASE_URL.split('@')[-1]}...")

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            engine = create_engine(DATABASE_URL)
            connection = engine.connect()
            connection.close()
            print(f"✓ Database is ready! (attempt {attempt}/{MAX_RETRIES})")
            return True
        except OperationalError as e:
            print(f"✗ Database not ready (attempt {attempt}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_INTERVAL)
            else:
                print("✗ Database connection failed after maximum retries")
                return False

    return False

if __name__ == "__main__":
    if wait_for_db():
        print("Starting application...")
        sys.exit(0)
    else:
        print("Failed to connect to database")
        sys.exit(1)
