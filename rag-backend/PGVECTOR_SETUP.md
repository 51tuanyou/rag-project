# PGVector Setup Guide

This guide explains how to set up PostgreSQL with PGVector extension for the RAG system.

## Prerequisites

- PostgreSQL 12+ installed
- Python 3.12+
- Access to PostgreSQL superuser account

## Installation

### 1. Install PostgreSQL

#### Windows
1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Install with default settings
3. Remember the password for the `postgres` user

#### macOS
```bash
# Using Homebrew
brew install postgresql
brew services start postgresql
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Install PGVector Extension

#### macOS
```bash
brew install pgvector
```

#### Ubuntu/Debian
```bash
# For PostgreSQL 14
sudo apt-get install postgresql-14-pgvector

# For PostgreSQL 15
sudo apt-get install postgresql-15-pgvector
```

#### From Source
```bash
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

### 3. Create Database and Enable Extension

```bash
# Connect to PostgreSQL as superuser
psql -U postgres

# Create database
CREATE DATABASE rag_vectors;

# Connect to the new database
\c rag_vectors

# Enable the vector extension
CREATE EXTENSION vector;

# Verify installation
\dx
```

## Configuration

### 1. Environment Variables

Create a `.env` file in the project root:

```env
# Database Configuration
USE_POSTGRES=True
POSTGRES_DB=rag_vectors
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# PGVector Configuration
PGVECTOR_HOST=localhost
PGVECTOR_PORT=5432
PGVECTOR_DB=rag_vectors
PGVECTOR_USER=postgres
PGVECTOR_PASSWORD=your_password
```

### 2. Django Settings

The settings are automatically configured in `settings.py`:

```python
# PGVector Configuration
PGVECTOR_HOST = os.getenv("PGVECTOR_HOST", "localhost")
PGVECTOR_PORT = os.getenv("PGVECTOR_PORT", "5432")
PGVECTOR_DB = os.getenv("PGVECTOR_DB", "rag_vectors")
PGVECTOR_USER = os.getenv("PGVECTOR_USER", "postgres")
PGVECTOR_PASSWORD = os.getenv("PGVECTOR_PASSWORD", "")
```

## Testing the Setup

### 1. Run Django Migrations
```bash
cd rag-backend
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # macOS/Linux
pdm run python manage.py migrate
```

### 2. Test PGVector Connection
```bash
pdm run python manage.py shell
```

```python
from django.db import connection
cursor = connection.cursor()
cursor.execute("SELECT version();")
print(cursor.fetchone())

# Test vector extension
cursor.execute("SELECT extname FROM pg_extension WHERE extname = 'vector';")
result = cursor.fetchone()
print(f"Vector extension installed: {result is not None}")
```

### 3. Test Vector Operations
```python
# Test vector creation and similarity search
cursor.execute("""
    CREATE TABLE IF NOT EXISTS test_vectors (
        id SERIAL PRIMARY KEY,
        embedding vector(1536)
    );
""")

# Insert test vector
cursor.execute("""
    INSERT INTO test_vectors (embedding) 
    VALUES ('[1,2,3]'::vector);
""")

# Test similarity search
cursor.execute("""
    SELECT id, embedding <-> '[1,2,3]'::vector as distance 
    FROM test_vectors 
    ORDER BY distance 
    LIMIT 5;
""")
results = cursor.fetchall()
print(f"Similarity search results: {results}")

# Clean up
cursor.execute("DROP TABLE test_vectors;")
```

## Troubleshooting

### Common Issues

1. **Extension not found**
   ```
   ERROR: extension "vector" is not available
   ```
   **Solution**: Ensure PGVector is properly installed and the extension is created in the database.

2. **Permission denied**
   ```
   ERROR: permission denied to create extension "vector"
   ```
   **Solution**: Connect as a superuser (postgres) to create the extension.

3. **Connection refused**
   ```
   ERROR: could not connect to server
   ```
   **Solution**: Ensure PostgreSQL is running and check connection parameters.

4. **Database does not exist**
   ```
   ERROR: database "rag_vectors" does not exist
   ```
   **Solution**: Create the database first:
   ```sql
   CREATE DATABASE rag_vectors;
   ```

### Verification Commands

```bash
# Check PostgreSQL version
psql --version

# Check if PGVector is installed
psql -U postgres -d rag_vectors -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"

# Check database connection
psql -U postgres -d rag_vectors -c "SELECT version();"

# List all extensions
psql -U postgres -d rag_vectors -c "\dx"
```

## Production Considerations

### 1. Security
- Use strong passwords
- Limit database user permissions
- Use SSL connections in production

### 2. Performance
- Configure appropriate memory settings
- Use connection pooling
- Monitor query performance

### 3. Backup
```bash
# Backup database
pg_dump -U postgres rag_vectors > rag_vectors_backup.sql

# Restore database
psql -U postgres rag_vectors < rag_vectors_backup.sql
```

## Vector Operations

### Supported Operations
- `<->` - Cosine distance
- `<#>` - Negative inner product
- `<=>` - L2 distance

### Example Queries
```sql
-- Find most similar vectors
SELECT id, embedding <-> '[1,2,3]'::vector as distance 
FROM vectors 
ORDER BY distance 
LIMIT 10;

-- Find vectors within distance threshold
SELECT id, embedding 
FROM vectors 
WHERE embedding <-> '[1,2,3]'::vector < 0.5;

-- Create index for faster searches
CREATE INDEX ON vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

## Next Steps

1. Configure your embedding models in the Django admin
2. Upload and process documents
3. Test retrieval functionality
4. Monitor performance and optimize as needed