# RAG Backend

Django-based backend for the RAG (Retrieval-Augmented Generation) system with vector similarity search capabilities.

## Prerequisites

- Python 3.12+
- PostgreSQL with PGVector extension
- uv (Python package manager)

## Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd rag-backend
```

### 2. Create and activate virtual environment
```bash
# Create virtual environment
uv venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate
```

### 3. Install dependencies
```bash
# Install PDM
pip install pdm

# Install project dependencies
pdm install
```

### 4. Database Setup

#### PostgreSQL with PGVector
```bash
# Install PostgreSQL (if not already installed)
# On Windows: Download from https://www.postgresql.org/download/windows/
# On macOS: brew install postgresql
# On Ubuntu: sudo apt-get install postgresql postgresql-contrib

# Install PGVector extension
# On macOS: brew install pgvector
# On Ubuntu: sudo apt-get install postgresql-14-pgvector

# Create database and enable extension
psql -U postgres
CREATE DATABASE rag_vectors;
\c rag_vectors
CREATE EXTENSION vector;
```

#### Environment Variables
Copy the example environment file and configure it:
```bash
# Copy example environment file
cp env.example .env

# Edit the .env file with your settings
```

Example `.env` file:
```env
# Django Settings
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

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

# CORS Settings
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174

# Vector Search Settings
DEFAULT_TOP_K=3
DEFAULT_SIMILARITY_THRESHOLD=0.7
```

### 5. Verify Configuration
```bash
# Check if all configurations are correct
pdm run python check_config.py
```

### 6. Run migrations
```bash
pdm run python manage.py migrate
```

### 7. Create superuser (optional)
```bash
pdm run python manage.py createsuperuser
```

## Running the Server

### Development Server
```bash
pdm run python manage.py runserver
```

The server will be available at `http://localhost:8000`

### API Documentation
- API endpoints: `http://localhost:8000/api/`
- Admin interface: `http://localhost:8000/admin/`

## Project Structure

```
rag-backend/
├── apps/
│   ├── agents/          # AI agents and vectorization services
│   ├── kb/             # Knowledge base management
│   └── llm/            # LLM model management
├── rag_backend/        # Django project settings
├── manage.py
├── pyproject.toml      # PDM configuration
└── README.md
```

## Key Features

- **Knowledge Base Management**: Create and manage knowledge bases
- **Document Processing**: Upload and process documents (PDF, DOCX, TXT, etc.)
- **Vector Search**: PGVector-based similarity search
- **Retrieval Testing**: Test retrieval effectiveness
- **LLM Integration**: Support for multiple LLM providers (OpenAI, Ollama, etc.)

## API Endpoints

### Knowledge Base
- `POST /api/kb/create-knowledge-base/` - Create knowledge base
- `GET /api/kb/get-knowledge-bases/` - List knowledge bases
- `GET /api/kb/get-documents/` - Get documents for a knowledge base

### Retrieval Testing
- `POST /api/kb/perform-retrieval-test/` - Perform retrieval test
- `GET /api/kb/get-retrieval-test-records/{kb_id}/` - Get test records
- `GET /api/kb/get-retrieval-test-results/{test_record_id}/` - Get test results

### Document Management
- `POST /api/kb/upload-file/` - Upload document
- `POST /api/kb/process-document/` - Process document
- `GET /api/kb/get-chunks/` - Get document chunks

## Dependencies

### Core Dependencies
- Django 5.2.7+
- Django REST Framework 3.15.2+
- psycopg2-binary 2.9.9+ (PostgreSQL adapter)
- numpy 1.24.0+
- pandas 2.0.0+

### Document Processing
- python-docx 1.1.0+ (Word documents)
- PyPDF2 3.0.1+ (PDF processing)

### Vector Search
- PGVector extension for PostgreSQL
- Custom vectorization service

## Development

### Running Tests
```bash
# Run Django tests
pdm run python manage.py test

# Test embedding API calls
pdm run python test_embeddings.py
```

### Code Formatting
```bash
# Using Black
pdm run black .

# Using Ruff
pdm run ruff check .
pdm run ruff check --fix .
```

### Database Migrations
```bash
# Create migration
pdm run python manage.py makemigrations

# Apply migration
pdm run python manage.py migrate
```

## Configuration

### Environment Variables

The application uses environment variables for configuration. Copy `env.example` to `.env` and modify as needed:

```bash
cp env.example .env
```

Key configuration variables:

- **Database**: `POSTGRES_*` and `PGVECTOR_*` variables
- **Security**: `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`
- **CORS**: `CORS_ALLOWED_ORIGINS` for frontend integration
- **Vector Search**: `DEFAULT_TOP_K`, `DEFAULT_SIMILARITY_THRESHOLD`
- **File Upload**: `MAX_UPLOAD_SIZE`, `ALLOWED_FILE_TYPES`

### Configuration Validation

Use the built-in configuration checker:

```bash
pdm run python check_config.py
```

This will verify:
- Environment variables are set correctly
- Database connection is working
- PGVector extension is installed
- Django settings are valid
- All required apps are installed

### PGVector Setup

For detailed PGVector installation and configuration, see [PGVECTOR_SETUP.md](PGVECTOR_SETUP.md).

## Troubleshooting

### Common Issues

1. **PGVector not found**
   - Ensure PostgreSQL is installed with PGVector extension
   - Check database connection settings
   - Run `pdm run python check_config.py` for detailed diagnostics

2. **Import errors**
   - Ensure virtual environment is activated
   - Run `pdm install` to install dependencies
   - Check if `python-dotenv` is installed

3. **Database connection issues**
   - Verify PostgreSQL is running
   - Check environment variables in `.env` file
   - Ensure database exists and PGVector extension is enabled
   - Test connection: `psql -U postgres -d rag_vectors`

4. **Configuration issues**
   - Run `pdm run python check_config.py` to identify problems
   - Check `.env` file exists and is properly formatted
   - Verify all required environment variables are set

### Logs
Check Django logs for detailed error information:
```bash
pdm run python manage.py runserver --verbosity=2
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `pdm run python manage.py test`
5. Submit a pull request

## License

MIT License
