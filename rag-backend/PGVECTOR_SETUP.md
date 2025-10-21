# PGVector Setup Guide

## 1. Install PostgreSQL with PGVector Extension

### Using Docker (Recommended)
```bash
docker run --name pgvector-db \
  -e POSTGRES_PASSWORD=your_password_here \
  -e POSTGRES_DB=rag_vectors \
  -p 5432:5432 \
  -d pgvector/pgvector:pg16
```

### Manual Installation
1. Install PostgreSQL 16+
2. Install PGVector extension:
```bash
# On Ubuntu/Debian
sudo apt install postgresql-16-pgvector

# On macOS with Homebrew
brew install pgvector
```

## 2. Create Database and Enable Extension

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE rag_vectors;

-- Connect to the database
\c rag_vectors

-- Enable vector extension
CREATE EXTENSION vector;
```

## 3. Environment Variables

Create a `.env` file in the backend directory with:

```env
# PGVector Database Configuration
PGVECTOR_HOST=localhost
PGVECTOR_PORT=5432
PGVECTOR_DB=rag_vectors
PGVECTOR_USER=postgres
PGVECTOR_PASSWORD=your_password_here
```

## 4. Test Connection

The vectorization service will automatically create the required table when first used:

```sql
-- Table will be created automatically:
CREATE TABLE chunk_embeddings (
    id SERIAL PRIMARY KEY,
    chunk_id VARCHAR(100) NOT NULL,
    knowledge_base_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    characters INTEGER NOT NULL,
    chunk_number INTEGER NOT NULL,
    embedding vector(1536),  -- Adjust dimension based on embedding model
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 5. Usage

When you click "Save & Process" in the chunk settings page, the system will:

1. Save chunks to the database
2. Create embeddings using the selected embedding model
3. Store vectors in PGVector for similarity search

The vectorization process is handled asynchronously and won't block the UI.
