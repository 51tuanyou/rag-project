# RAG System

A complete Retrieval-Augmented Generation (RAG) system with vector similarity search capabilities, built with Django backend and React frontend.

## Project Structure

```
rag-system/
├── rag-backend/          # Django backend
│   ├── apps/
│   │   ├── agents/       # AI agents and vectorization
│   │   ├── kb/          # Knowledge base management
│   │   └── llm/         # LLM model management
│   ├── manage.py
│   └── README.md
├── rag-frontend/        # React frontend
│   ├── src/
│   │   ├── pages/
│   │   └── components/
│   ├── package.json
│   └── README.md
└── README.md           # This file
```

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- PostgreSQL with PGVector extension
- uv (Python package manager)
- pnpm (Node.js package manager)

### 1. Backend Setup

```bash
cd rag-backend

# Create and activate virtual environment
uv venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # macOS/Linux

# Install dependencies
pip install pdm
pdm install

# Setup database (PostgreSQL with PGVector)
# See rag-backend/README.md for detailed instructions

# Run migrations
pdm run python manage.py migrate

# Start backend server
pdm run python manage.py runserver
```

Backend will be available at `http://localhost:8000`

### 2. Frontend Setup

```bash
cd rag-frontend

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Frontend will be available at `http://localhost:5173`

## Features

### Backend Features
- **Knowledge Base Management**: Create and manage knowledge bases
- **Document Processing**: Upload and process documents (PDF, DOCX, TXT, etc.)
- **Vector Search**: PGVector-based similarity search
- **Retrieval Testing**: Test retrieval effectiveness
- **LLM Integration**: Support for multiple LLM providers (OpenAI, Ollama, etc.)

### Frontend Features
- **Knowledge Base Dashboard**: Manage knowledge bases and documents
- **Document Upload**: Drag-and-drop document upload interface
- **Retrieval Testing**: Interactive vector similarity testing
- **Chunk Management**: View and manage document chunks
- **LLM Configuration**: Configure and manage LLM models

## Key Components

### Knowledge Base Management
- Create and configure knowledge bases
- Upload and process documents
- Configure chunking settings
- Manage document chunks

### Retrieval Testing
- Test vector similarity search
- View similarity scores
- Historical test records
- Real-time retrieval testing

### LLM Integration
- Multiple provider support (OpenAI, Ollama)
- Embedding model configuration
- API key management
- Model credential management

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

## Technology Stack

### Backend
- **Django 5.2.7+**: Web framework
- **Django REST Framework 3.15.2+**: API framework
- **PostgreSQL**: Database with PGVector extension
- **psycopg2-binary 2.9.9+**: PostgreSQL adapter
- **numpy 1.24.0+**: Numerical computing
- **pandas 2.0.0+**: Data manipulation

### Frontend
- **React 18.2.0+**: UI framework
- **TypeScript 5.0+**: Type safety
- **Vite 5.0+**: Build tool
- **Material-UI 5.15.0+**: UI components
- **pnpm**: Package manager

## Development

### Backend Development
```bash
cd rag-backend
.venv\Scripts\activate
pdm run python manage.py runserver
```

### Frontend Development
```bash
cd rag-frontend
pnpm dev
```

### Running Tests
```bash
# Backend tests
cd rag-backend
pdm run python manage.py test

# Frontend tests (if configured)
cd rag-frontend
pnpm test
```

## Deployment

### Backend Deployment
1. Set up PostgreSQL with PGVector
2. Configure environment variables
3. Run migrations: `pdm run python manage.py migrate`
4. Collect static files: `pdm run python manage.py collectstatic`
5. Deploy with your preferred WSGI server (Gunicorn, uWSGI, etc.)

### Frontend Deployment
1. Build for production: `pnpm build`
2. Deploy the `dist/` directory to your web server
3. Configure reverse proxy for API calls

## Environment Variables

### Backend (.env)
```env
PGVECTOR_HOST=localhost
PGVECTOR_PORT=5432
PGVECTOR_DB=rag_vectors
PGVECTOR_USER=postgres
PGVECTOR_PASSWORD=your_password
SECRET_KEY=your-secret-key-here
DEBUG=True
```

### Frontend (.env)
```env
VITE_API_BASE=http://localhost:8000
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Ensure PostgreSQL is running
   - Check PGVector extension is installed
   - Verify connection parameters

2. **API Connection Issues**
   - Ensure backend server is running
   - Check CORS settings
   - Verify API endpoints

3. **Build Issues**
   - Clear cache and reinstall dependencies
   - Check Node.js and Python versions
   - Verify all prerequisites are installed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License

## Support

For issues and questions:
1. Check the individual README files in `rag-backend/` and `rag-frontend/`
2. Review the troubleshooting sections
3. Check the API documentation
4. Create an issue in the repository
