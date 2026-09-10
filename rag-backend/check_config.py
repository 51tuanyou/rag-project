#!/usr/bin/env python
"""
Configuration checker for RAG Backend.

Verifies environment, Django settings, database, and PGVector setup.
"""

import os
import sys
from pathlib import Path

import django

project_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(project_dir))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "rag_backend.settings")
django.setup()

from django.conf import settings
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


def check_env_file():
    print("Checking .env file...")
    env_path = project_dir / ".env"
    if env_path.exists():
        print("  .env file found")
        return True
    print("  .env file is missing (copy env.example to .env)")
    return False


def check_environment_variables():
    print("\nChecking environment variables...")

    recommended_vars = [
        "SECRET_KEY",
        "DEBUG",
        "ALLOWED_HOSTS",
        "CORS_ALLOWED_ORIGINS",
    ]
    postgres_vars = [
        "USE_POSTGRES",
        "POSTGRES_DB",
        "POSTGRES_USER",
        "POSTGRES_PASSWORD",
        "POSTGRES_HOST",
        "POSTGRES_PORT",
        "PGVECTOR_HOST",
        "PGVECTOR_PORT",
        "PGVECTOR_DB",
        "PGVECTOR_USER",
        "PGVECTOR_PASSWORD",
    ]

    missing = [var for var in recommended_vars if not os.getenv(var)]
    if missing:
        print(f"  Missing recommended variables: {', '.join(missing)}")
        print("  Django will fall back to defaults in settings.py")
    else:
        print("  Core environment variables are set")

    if settings.USE_POSTGRES:
        missing_pg = [var for var in postgres_vars if not os.getenv(var)]
        if missing_pg:
            print(f"  Missing PostgreSQL/PGVector variables: {', '.join(missing_pg)}")
            return False
        print("  PostgreSQL/PGVector environment variables are set")
    else:
        print("  USE_POSTGRES is not enabled; SQLite will be used")

    return True


def check_django_settings():
    print("\nChecking Django settings...")
    try:
        if not settings.SECRET_KEY:
            print("  SECRET_KEY is not set")
            return False
        if settings.SECRET_KEY.startswith("django-insecure-"):
            print("  Using the default insecure SECRET_KEY (set SECRET_KEY in .env for production)")

        db_config = settings.DATABASES["default"]
        print(f"  Database engine: {db_config['ENGINE']}")
        print(f"  Database name: {db_config['NAME']}")
        print(f"  PGVector host: {settings.PGVECTOR_HOST}")
        print(f"  PGVector database: {settings.PGVECTOR_DB}")
        return True
    except Exception as e:
        print(f"  Django settings error: {e}")
        return False


def check_installed_apps():
    print("\nChecking installed apps...")
    required_apps = [
        "django.contrib.admin",
        "django.contrib.auth",
        "django.contrib.contenttypes",
        "django.contrib.sessions",
        "rest_framework",
        "corsheaders",
        "apps.llm",
        "apps.kb",
        "apps.agents",
    ]
    missing_apps = [app for app in required_apps if app not in settings.INSTALLED_APPS]
    if missing_apps:
        print(f"  Missing installed apps: {', '.join(missing_apps)}")
        return False
    print("  All required apps are installed")
    return True


def check_database_connection():
    print("\nChecking database connection...")
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            if cursor.fetchone():
                print("  Database connection successful")
                return True
        print("  Database connection returned no result")
        return False
    except Exception as e:
        print(f"  Database connection failed: {e}")
        return False


def check_pgvector_extension():
    print("\nChecking PGVector extension...")
    engine = settings.DATABASES["default"]["ENGINE"]
    if "postgresql" not in engine:
        print("  Skipped (not using PostgreSQL)")
        return True

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT extname FROM pg_extension WHERE extname = 'vector';")
            if cursor.fetchone():
                print("  PGVector extension is installed")
                return True
            print("  PGVector extension is not installed")
            print("  Enable it with: CREATE EXTENSION vector;")
            return False
    except Exception as e:
        print(f"  Error checking PGVector extension: {e}")
        return False


def check_migrations():
    print("\nChecking migrations...")
    try:
        executor = MigrationExecutor(connection)
        unapplied = executor.migration_plan(executor.loader.graph.leaf_nodes())
        if unapplied:
            names = [f"{app}.{name}" for app, name in unapplied]
            print(f"  Unapplied migrations: {', '.join(names)}")
            print("  Run: pdm run python manage.py migrate")
            return False
        print("  Migrations are up to date")
        return True
    except Exception as e:
        print(f"  Migration check failed: {e}")
        return False


def main():
    print("RAG Backend Configuration Checker")
    print("=" * 50)

    checks = [
        check_env_file,
        check_environment_variables,
        check_django_settings,
        check_installed_apps,
        check_database_connection,
        check_pgvector_extension,
        check_migrations,
    ]

    results = []
    for check in checks:
        try:
            results.append(check())
        except Exception as e:
            print(f"  Check failed with error: {e}")
            results.append(False)

    print("\n" + "=" * 50)
    print("Configuration Summary")
    print("=" * 50)

    passed = sum(1 for result in results if result)
    total = len(results)
    if passed == total:
        print("All checks passed. Configuration looks ready.")
        return 0

    print(f"{passed}/{total} checks passed")
    print("Fix the issues above before running the application.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
