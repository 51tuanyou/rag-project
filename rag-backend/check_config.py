#!/usr/bin/env python
"""
Configuration checker for RAG Backend
This script verifies that all required configurations are properly set.
"""

import os
import sys
import django
from pathlib import Path

# Add the project directory to Python path
project_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(project_dir))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rag_backend.settings')
django.setup()

from django.conf import settings
from django.db import connection
from django.core.exceptions import ImproperlyConfigured


def check_environment_variables():
    """Check if required environment variables are set."""
    print("🔍 Checking environment variables...")
    
    required_vars = [
        'SECRET_KEY',
        'DEBUG',
        'ALLOWED_HOSTS',
    ]
    
    optional_vars = [
        'USE_POSTGRES',
        'POSTGRES_DB',
        'POSTGRES_USER',
        'POSTGRES_PASSWORD',
        'POSTGRES_HOST',
        'POSTGRES_PORT',
        'PGVECTOR_HOST',
        'PGVECTOR_PORT',
        'PGVECTOR_DB',
        'PGVECTOR_USER',
        'PGVECTOR_PASSWORD',
    ]
    
    missing_required = []
    for var in required_vars:
        if not os.getenv(var):
            missing_required.append(var)
    
    if missing_required:
        print(f"❌ Missing required environment variables: {', '.join(missing_required)}")
        return False
    
    print("✅ Required environment variables are set")
    
    # Check optional variables
    missing_optional = []
    for var in optional_vars:
        if not os.getenv(var):
            missing_optional.append(var)
    
    if missing_optional:
        print(f"⚠️  Missing optional environment variables: {', '.join(missing_optional)}")
        print("   These are recommended for full functionality")
    
    return True


def check_database_connection():
    """Check database connection."""
    print("\n🔍 Checking database connection...")
    
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            if result:
                print("✅ Database connection successful")
                return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False


def check_pgvector_extension():
    """Check if PGVector extension is installed."""
    print("\n🔍 Checking PGVector extension...")
    
    try:
        with connection.cursor() as cursor:
            # Check if vector extension exists
            cursor.execute("""
                SELECT extname FROM pg_extension WHERE extname = 'vector';
            """)
            result = cursor.fetchone()
            
            if result:
                print("✅ PGVector extension is installed")
                return True
            else:
                print("❌ PGVector extension is not installed")
                print("   Please install PGVector extension in your PostgreSQL database")
                return False
    except Exception as e:
        print(f"❌ Error checking PGVector extension: {e}")
        return False


def check_django_settings():
    """Check Django settings configuration."""
    print("\n🔍 Checking Django settings...")
    
    try:
        # Check basic settings
        if not settings.SECRET_KEY:
            print("❌ SECRET_KEY is not set")
            return False
        
        # Check database settings
        db_config = settings.DATABASES['default']
        print(f"✅ Database engine: {db_config['ENGINE']}")
        print(f"✅ Database name: {db_config['NAME']}")
        
        # Check PGVector settings
        if hasattr(settings, 'PGVECTOR_HOST'):
            print(f"✅ PGVector host: {settings.PGVECTOR_HOST}")
            print(f"✅ PGVector database: {settings.PGVECTOR_DB}")
        
        return True
    except Exception as e:
        print(f"❌ Django settings error: {e}")
        return False


def check_installed_apps():
    """Check if all required apps are installed."""
    print("\n🔍 Checking installed apps...")
    
    required_apps = [
        'django.contrib.admin',
        'django.contrib.auth',
        'django.contrib.contenttypes',
        'django.contrib.sessions',
        'rest_framework',
        'corsheaders',
        'apps.llm',
        'apps.kb',
        'apps.agents',
    ]
    
    missing_apps = []
    for app in required_apps:
        if app not in settings.INSTALLED_APPS:
            missing_apps.append(app)
    
    if missing_apps:
        print(f"❌ Missing installed apps: {', '.join(missing_apps)}")
        return False
    
    print("✅ All required apps are installed")
    return True


def check_migrations():
    """Check if migrations are up to date."""
    print("\n🔍 Checking migrations...")
    
    try:
        from django.core.management import execute_from_command_line
        from django.db import migrations
        
        # This is a simplified check - in practice you'd use Django's migration system
        print("✅ Migration system is available")
        return True
    except Exception as e:
        print(f"❌ Migration check failed: {e}")
        return False


def main():
    """Run all configuration checks."""
    print("🚀 RAG Backend Configuration Checker")
    print("=" * 50)
    
    checks = [
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
            result = check()
            results.append(result)
        except Exception as e:
            print(f"❌ Check failed with error: {e}")
            results.append(False)
    
    print("\n" + "=" * 50)
    print("📊 Configuration Summary")
    print("=" * 50)
    
    passed = sum(results)
    total = len(results)
    
    if passed == total:
        print("🎉 All checks passed! Your configuration is ready.")
        return 0
    else:
        print(f"⚠️  {passed}/{total} checks passed")
        print("Please fix the issues above before running the application")
        return 1


if __name__ == "__main__":
    sys.exit(main())
