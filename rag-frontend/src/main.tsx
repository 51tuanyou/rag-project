import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import ManageKB from './pages/ManageKB.tsx'
import KBUpload from './pages/KBUpload.tsx'
import KBChunkSettings from './pages/KBChunkSettings.tsx'
import KBProcessing from './pages/KBProcessing.tsx'
import KBDocuments from './pages/KBDocuments.tsx'
import KBDocumentDetail from './pages/KBDocumentDetail.tsx'
import ManageLLM from './pages/ManageLLM.tsx'

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/manage/kb', element: <ManageKB /> },
  { path: '/manage/kb/upload', element: <KBUpload /> },
  { path: '/manage/kb/chunk', element: <KBChunkSettings /> },
  { path: '/manage/kb/processing', element: <KBProcessing /> },
  { path: '/manage/kb/documents', element: <KBDocuments /> },
  { path: '/manage/kb/documents/:id', element: <KBDocumentDetail /> },
  { path: '/manage/llm', element: <ManageLLM /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
