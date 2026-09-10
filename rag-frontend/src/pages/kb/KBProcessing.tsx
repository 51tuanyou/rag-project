import { useMemo, useState, useEffect, useRef } from 'react'
import { API_BASE } from '../../apiBase'
import {
  Box,
  Button,
  Container,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
  IconButton,
} from '@mui/material'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import ErrorIcon from '@mui/icons-material/Error'
import Tooltip from '@mui/material/Tooltip'
import { useLocation, useNavigate } from 'react-router-dom'

// Add CSS animation for spinning icon
const spinKeyframes = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`

// Inject the CSS
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = spinKeyframes
  document.head.appendChild(style)
}

export default function KBProcessing() {
  const navigate = useNavigate()
  const { state } = useLocation() as { state?: any }
  const files: string[] = useMemo(() => state?.files ?? [], [state])
  
  // Generate knowledge name: filename - embedding model name - file extension
  const generateKnowledgeName = async (filePath: string, embeddingModel: string) => {
    // Extract only the filename from the path (handle both / and \ separators)
    const fileName = filePath.includes('/') ? filePath.split('/').pop() : 
                    filePath.includes('\\') ? filePath.split('\\').pop() : filePath
    const nameWithoutExt = fileName.split('.')[0]
    const extension = fileName.includes('.') ? fileName.split('.').pop() : ''
    
    // Generate base name
    const baseName = `${nameWithoutExt}-${embeddingModel}${extension ? '.' + extension : ''}`
    
    // Check for duplicates and add auto-increment ID if needed
    let finalName = baseName
    let counter = 1
    
    // Check if this name already exists in database
    const checkNameExists = async (name: string) => {
      try {
        const response = await fetch(`${API_BASE}/api/kb/check-knowledge-base-name/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name })
        })
        
        if (!response.ok) {
          throw new Error('Failed to check name')
        }
        
        const data = await response.json()
        return data.exists
      } catch (error) {
        console.error('Error checking name:', error)
        return false // If check fails, assume name is available
      }
    }
    
    while (await checkNameExists(finalName)) {
      finalName = `${nameWithoutExt}-${embeddingModel}（${counter}）${extension ? '.' + extension : ''}`
      counter++
    }
    
    return finalName
  }
  
  const [name, setName] = useState(() => {
    if (state?.knowledgeName) {
      return state.knowledgeName
    }
    if (files[0] && state?.embeddingModel) {
      return generateKnowledgeName(files[0], state.embeddingModel)
    }
    // Since embedding model is now required, this fallback should not be reached
    if (files[0]) {
      const fileName = files[0].includes('/') ? files[0].split('/').pop() : 
                      files[0].includes('\\') ? files[0].split('\\').pop() : files[0]
      return fileName.split('.')[0]
    }
    return 'knowledge'
  })
  const [completed, setCompleted] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isVectorizing, setIsVectorizing] = useState(false)
  const [creationError, setCreationError] = useState<string>('')
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<number | null>(null)
  const hasInitiatedCreation = useRef(false)
  const [chunkSettings, setChunkSettings] = useState<any>(null)
  const [vectorizationFailed, setVectorizationFailed] = useState(false)
  const [failedDocuments, setFailedDocuments] = useState<Set<number>>(new Set())
  const [documentErrors, setDocumentErrors] = useState<Map<number, string>>(new Map())
  

  // Fetch chunk settings from knowledge base
  const fetchChunkSettings = async (kbId: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/kb/get-chunk-settings/${kbId}/`)
      if (response.ok) {
        const data = await response.json()
        setChunkSettings(data)
      }
    } catch (error) {
      console.error('Error fetching chunk settings:', error)
    }
  }

  // Start vectorization process
  const startVectorization = async (kbId: number) => {
    setIsVectorizing(true)
    setVectorizationFailed(false)
    setFailedDocuments(new Set())
    setDocumentErrors(new Map())
    
    try {
      // Get documents for this knowledge base
      const response = await fetch(`${API_BASE}/api/kb/get-documents/?kb_id=${kbId}`)
      if (!response.ok) {
        throw new Error('Failed to get documents')
      }
      
      const data = await response.json()
      const documents = data.documents || []
      let hasFailures = false
      
      // Process each document for vectorization
      for (const doc of documents) {
        try {
          // Get chunks for this document
          const chunksResponse = await fetch(`${API_BASE}/api/kb/get-chunks/?document_id=${doc.id}`)
          if (!chunksResponse.ok) {
            setFailedDocuments(prev => new Set([...prev, doc.id]))
            setDocumentErrors(prev => new Map([...prev, [doc.id, 'Failed to get chunks']]))
            hasFailures = true
            continue
          }
          
          const chunksData = await chunksResponse.json()
          const chunks = chunksData.chunks || []
          
          if (chunks.length > 0) {
            // Prepare chunks data for vectorization
            const chunksForVectorization = chunks.map((chunk: any) => ({
              chunk_id: chunk.id,  // 使用 'id' 字段而不是 'chunk_id'
              content: chunk.content,
              characters: chunk.characters,
              chunk_number: chunk.chunk_number
            }))
            
            // Call vectorization API
            const vectorizeResponse = await fetch(`${API_BASE}/api/agents/vectorize-chunks/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chunks: chunksForVectorization,
                embedding_model_id: state?.embeddingModelId,
                knowledge_base_id: kbId,
                document_id: doc.id
              })
            })
            
            if (!vectorizeResponse.ok) {
              const errorText = await vectorizeResponse.text()
              console.warn(`Vectorization failed for document ${doc.id}: ${errorText}`)
              setFailedDocuments(prev => new Set([...prev, doc.id]))
              setDocumentErrors(prev => new Map([...prev, [doc.id, `Vectorization failed: ${errorText}`]]))
              hasFailures = true
            } else {
              console.log(`Vectorization completed for document ${doc.id}`)
            }
          }
        } catch (error) {
          console.error(`Error vectorizing document ${doc.id}:`, error)
          setFailedDocuments(prev => new Set([...prev, doc.id]))
          setDocumentErrors(prev => new Map([...prev, [doc.id, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`]]))
          hasFailures = true
        }
      }
      
      // Set completion status based on whether there were failures
      if (hasFailures) {
        setVectorizationFailed(true)
        setCreationError('Some documents failed to vectorize. Please check the document status.')
      } else {
        setCompleted(true)
      }
      
    } catch (error) {
      console.error('Error in vectorization process:', error)
      setVectorizationFailed(true)
      setCreationError('Vectorization failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsVectorizing(false)
    }
  }

  // Create knowledge base in database
  const createKnowledgeBase = async () => {
    if (isCreating) return
    
    setIsCreating(true)
    setCreationError('')
    
    try {
      const requestData = {
        name: name,
        files: files,
        settings: {
          delimiter: state?.delimiter ?? '\\n\\n',
          max_length: parseInt(state?.maxLen ?? '1024'),
          overlap: parseInt(state?.overlap ?? '50'),
          replace_spaces: state?.replaceSpaces ?? true,
          delete_urls: state?.deleteUrls ?? false,
          qa_format: state?.qaFormat ?? false,
          qa_language: state?.qaLanguage ?? 'English',
          question_flag: state?.questionFlag ?? 'Q: ',
          answer_flag: state?.answerFlag ?? 'A: ',
          qa_max_length: parseInt(state?.qaMaxLength ?? '1024'),
          index_method: state?.indexMethod ?? 'hq',
          retrieval_mode: state?.retrievalMode ?? 'vector'
        },
        embedding_model_id: state?.embeddingModelId || null,
        // Pass preview chunks if they exist
        preview_chunks: state?.previewChunks || null
      }
      
      const response = await fetch(`${API_BASE}/api/kb/create-knowledge-base/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create knowledge base')
      }
      
      const result = await response.json()
      setKnowledgeBaseId(result.knowledge_base_id)
      
      // Fetch chunk settings from the created knowledge base
      await fetchChunkSettings(result.knowledge_base_id)
      
      // Start vectorization process
      await startVectorization(result.knowledge_base_id)
      
    } catch (error) {
      console.error('Error creating knowledge base:', error)
      setCreationError(error instanceof Error ? error.message : 'Failed to create knowledge base')
    } finally {
      setIsCreating(false)
    }
  }

  // Auto-create knowledge base when component mounts
  useEffect(() => {
    if (files.length > 0 && !isCreating && !completed && !knowledgeBaseId && !hasInitiatedCreation.current) {
      console.log('Creating knowledge base...')
      hasInitiatedCreation.current = true
      createKnowledgeBase()
    }
  }, [files, isCreating, completed, knowledgeBaseId])

  const settings = {
    chunkingSetting: chunkSettings?.chunk_type === 'qa' ? 'Using Q&A' : (chunkSettings?.delimiter ? 'Custom' : 'General'),
    maxLen: chunkSettings?.max_length?.toString() ?? state?.maxLen ?? '1024',
    preprocess: chunkSettings?.replace_spaces ? 'Replace consecutive spaces, newlines and tabs' : '—',
    indexMethod: chunkSettings?.index_method === 'hq' ? 'High Quality' : 'Economical',
    retrieval: (chunkSettings?.retrieval_mode || state?.retrievalMode || 'vector').replace(/\b\w/g, (s: string) => s.toUpperCase()) + ' Search',
  }

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', py: 1, display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ maxWidth: 'lg', width: '100%', px: 2 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3, textAlign: 'center', fontWeight: 600, color: 'primary.main' }}>
          RAG Tool
        </Typography>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>🎉 Knowledge created</Typography>
        <Button variant="outlined" onClick={() => navigate('/manage/kb')} startIcon={<ArrowBackIcon />}>
          返回管理知识库
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Knowledge name</Typography>
        <TextField fullWidth value={name} onChange={e => setName(e.target.value)} placeholder="knowledge name" />
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {isCreating ? 'CREATING KNOWLEDGE BASE...' : 
           isVectorizing ? '向量化处理正在进行中...' : 
           vectorizationFailed ? 'EMBEDDING FAILED' :
           completed ? 'EMBEDDING COMPLETED' : 'EMBEDDING PROCESSING...'}
        </Typography>
        {files.map((f, i) => {
          // Extract only the filename from the path (handle both / and \ separators)
          const fileName = f.includes('/') ? f.split('/').pop() : 
                          f.includes('\\') ? f.split('\\').pop() : f
          
          // Determine document status
          const isFailed = vectorizationFailed && failedDocuments.has(i + 1) // Assuming document ID is index + 1
          const errorMessage = documentErrors.get(i + 1) || 'Unknown error'
          
          return (
            <Stack key={f + i} direction="row" spacing={1} alignItems="center" sx={{ mb: 1, p: 1, borderRadius: 1, border: '1px solid', borderColor: isFailed ? 'error.main' : 'divider' }}>
              <InsertDriveFileIcon fontSize="small" />
              <Typography sx={{ flex: 1 }}>{fileName}</Typography>
              <Typography variant="caption" sx={{ mr: 1 }}>
                {isFailed ? 'Disabled' : completed ? 'Available' : isVectorizing ? 'Processing' : 'Pending'}
              </Typography>
              {isFailed ? (
                <Tooltip title={`Failed: ${errorMessage}`} arrow>
                  <ErrorIcon sx={{ color: 'error.main' }} />
                </Tooltip>
              ) : completed ? (
                <CheckCircleIcon sx={{ color: 'success.main' }} />
              ) : isVectorizing ? (
                <AutorenewIcon sx={{ color: 'primary.main', animation: 'spin 2s linear infinite' }} />
              ) : (
                <Typography variant="caption">0%</Typography>
              )}
            </Stack>
          )
        })}
        {(isCreating || isVectorizing || (!completed && !vectorizationFailed)) && <LinearProgress variant="indeterminate" />}
        
        {/* Error display */}
        {creationError && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1, border: '1px solid', borderColor: 'error.main' }}>
            <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>
              Error: {creationError}
            </Typography>
            {vectorizationFailed && (
              <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
                Some documents failed to process. Please check the document status above for details.
              </Typography>
            )}
          </Box>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack spacing={1}>
          <Row label="Chunking Setting" value={settings.chunkingSetting} />
          <Row label="Maximum Chunk Length" value={String(settings.maxLen)} />
          <Row label="Text Preprocessing Rules" value={settings.preprocess} />
          <Row label="Index Method" value={settings.indexMethod} iconColor="orange" />
          <Row label="Retrieval Setting" value={settings.retrieval} iconColor="purple" />
        </Stack>
      </Paper>

      <Stack direction="row" spacing={1}>
        <Box sx={{ flex: 1 }} />
        <Button 
          variant="contained" 
          onClick={() => navigate(`/manage/kb/documents/${knowledgeBaseId}`, { state: { files } })}
        >
          Go to document
        </Button>
      </Stack>
      </Box>
    </Box>
  )
}

function Row({ label, value, iconColor }: { label: string; value: string; iconColor?: string }) {
  return (
    <Stack direction="row" spacing={2} alignItems="center">
      <Typography sx={{ width: 200 }} color="text.secondary">{label}</Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <FiberManualRecordIcon sx={{ color: iconColor || 'text.secondary', fontSize: 12 }} />
        <Typography>{value}</Typography>
      </Stack>
    </Stack>
  )
}


