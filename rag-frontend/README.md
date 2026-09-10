# RAG Frontend

React-based frontend for the RAG (Retrieval-Augmented Generation) system with vector similarity search capabilities.

## Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- Backend server running (see rag-backend README)

## Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd rag-frontend
```

### 2. Install dependencies
```bash
# Using pnpm (recommended)
pnpm install

# Or using npm
npm install
```

## Development

### 1. Start the development server
```bash
# Using pnpm
pnpm dev

# Or using npm
npm run dev
```

The application will be available at `http://localhost:5173`

### 2. Environment Configuration

Create a `.env` file in the project root (optional):
```env
# Backend API URL
VITE_API_BASE=http://localhost:8000
```

## Project Structure

```
rag-frontend/
├── src/
│   ├── pages/
│   │   ├── kb/              # Knowledge base pages
│   │   │   ├── ManageKB.tsx
│   │   │   ├── RetrievalTest.tsx
│   │   │   └── llm/         # LLM management pages
│   ├── components/         # Reusable components
│   ├── assets/             # Static assets
│   ├── App.tsx            # Main app component
│   └── main.tsx           # Entry point
├── public/                # Public assets
├── dist/                 # Build output
├── package.json
└── vite.config.ts
```

## Key Features

- **Knowledge Base Management**: Create, edit, and manage knowledge bases
- **Document Upload**: Upload and process various document formats
- **Retrieval Testing**: Test vector similarity search effectiveness
- **Chunk Management**: View and manage document chunks
- **LLM Integration**: Configure and manage LLM models

## Pages

### Knowledge Base Management
- **Main Page** (`/`): Knowledge base selection and chat interface
- **Manage KB** (`/manage/kb`): Knowledge base management dashboard
- **Upload** (`/manage/kb/upload`): Document upload interface
- **Documents** (`/manage/kb/documents/{kbId}`): Document management
- **Retrieval Test** (`/manage/kb/retrieval-test/{kbId}`): Vector similarity testing

### LLM Management
- **Manage LLM** (`/manage/llm`): LLM model configuration

## Dependencies

### Core Dependencies
- React 18.2.0+
- TypeScript 5.0+
- Vite 5.0+
- Material-UI 5.15.0+

### UI Components
- @mui/material 5.15.0+
- @mui/icons-material 5.15.0+
- @emotion/react 11.11.0+
- @emotion/styled 11.11.0+

### Development Tools
- @types/react 18.2.0+
- @types/react-dom 18.2.0+
- @vitejs/plugin-react 4.2.0+
- TypeScript 5.0+
- ESLint 8.57.0+

## Scripts

### Development
```bash
# Start development server
pnpm dev

# Start with specific port
pnpm dev --port 3000
```

### Building
```bash
# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Code Quality
```bash
# Run ESLint
pnpm lint

# Fix ESLint issues
pnpm lint:fix

# Type checking
pnpm type-check
```

## API Integration

The frontend communicates with the backend through REST APIs:

### Knowledge Base APIs
- `GET /api/kb/get-knowledge-bases/` - List knowledge bases
- `POST /api/kb/create-knowledge-base/` - Create knowledge base
- `GET /api/kb/get-documents/?kb_id={id}` - Get documents

### Retrieval Testing APIs
- `POST /api/kb/perform-retrieval-test/` - Perform retrieval test
- `GET /api/kb/get-retrieval-test-records/{kbId}/` - Get test records
- `GET /api/kb/get-retrieval-test-results/{testRecordId}/` - Get test results

### Document Management APIs
- `POST /api/kb/upload-file/` - Upload document
- `POST /api/kb/process-document/` - Process document
- `GET /api/kb/get-chunks/` - Get document chunks

## Configuration

### Vite Configuration
The project uses Vite for fast development and building. Configuration is in `vite.config.ts`.

### TypeScript Configuration
- `tsconfig.json` - Main TypeScript configuration
- `tsconfig.app.json` - App-specific configuration
- `tsconfig.node.json` - Node.js configuration

### ESLint Configuration
ESLint configuration is in `eslint.config.js` with TypeScript and React rules.

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Kill process on port 5173
   npx kill-port 5173
   # Or use different port
   pnpm dev --port 3000
   ```

2. **API connection issues**
   - Ensure backend server is running on `http://localhost:8000`
   - Check `VITE_API_BASE` environment variable
   - Verify CORS settings in backend

3. **Build issues**
   ```bash
   # Clear cache and reinstall
   rm -rf node_modules
   rm pnpm-lock.yaml
   pnpm install
   ```

4. **TypeScript errors**
   ```bash
   # Run type checking
   pnpm type-check
   # Check for missing types
   pnpm add -D @types/package-name
   ```

### Development Tips

1. **Hot Reload**: Changes to React components will automatically reload
2. **Type Safety**: TypeScript provides compile-time error checking
3. **Material-UI**: Use MUI components for consistent design
4. **API Calls**: Use fetch API with proper error handling

## Deployment

### Production Build
```bash
# Build for production
pnpm build

# The built files will be in the `dist/` directory
```

### Environment Variables
Set production environment variables:
```env
VITE_API_BASE=https://your-api-domain.com
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting: `pnpm lint`
5. Run type checking: `pnpm type-check`
6. Submit a pull request

## License

MIT License
