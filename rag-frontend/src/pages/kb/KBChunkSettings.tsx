import { useEffect, useMemo, useState } from 'react'
import { API_BASE } from '../../apiBase'
import {
  Box,
  Button,
  Container,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
  Paper,
  Select,
  MenuItem,
  Chip,
  Slider,
  IconButton,
  Snackbar,
  Alert,
} from '@mui/material'
import Autocomplete from '@mui/material/Autocomplete'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppTitle, modeLabel, useI18n } from '../../i18n'

export default function KBChunkSettings() {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const { kbId } = useParams<{ kbId: string }>()
  const files: string[] = useMemo(() => (location.state?.files ?? []) as string[], [location.state])

  const [delimiter, setDelimiter] = useState(() => {
    const saved = localStorage.getItem('kb.delimiter')
    if (saved === null) return '\\n\\n'
    return saved
  })
  const [maxLen, setMaxLen] = useState(() => localStorage.getItem('kb.maxLen') || '1024')
  const [overlap, setOverlap] = useState(() => localStorage.getItem('kb.overlap') || '50')
  const [replaceSpaces, setReplaceSpaces] = useState(() => {
    const saved = localStorage.getItem('kb.replaceSpaces')
    return saved === null ? true : saved === 'true'
  })
  const [deleteUrls, setDeleteUrls] = useState(() => localStorage.getItem('kb.deleteUrls') === 'true')
  const [qaFormat, setQaFormat] = useState(() => localStorage.getItem('kb.qaFormat') === 'true')
  const [qaLanguage, setQaLanguage] = useState(() => localStorage.getItem('kb.qaLanguage') || 'English')
  const [indexMethod, setIndexMethod] = useState<'hq' | 'eco'>(() => (localStorage.getItem('kb.indexMethod') as 'hq' | 'eco') || 'hq')
  
  // Chunk preview state
  const [chunks, setChunks] = useState<Array<{id: string; content: string; characters: number; chunk_number?: number}>>([])
  const [showPreview, setShowPreview] = useState(false)
  const [editingChunk, setEditingChunk] = useState<string | null>(null)
  const [editingChunkContent, setEditingChunkContent] = useState('')
  
  // Document-related state
  const [documents, setDocuments] = useState<Array<{id: number; file_name: string; file_path: string; status: string}>>([])
  const [selectedDocument, setSelectedDocument] = useState<number | null>(null)
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [documentStatus, setDocumentStatus] = useState<string>('')
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
  
  // Chunks from database state
  const [dbChunks, setDbChunks] = useState<Array<{id: string; content: string; characters: number; chunk_number?: number}>>([])
  const [loadingChunks, setLoadingChunks] = useState(false)
  
  // Chunk settings from database
  const [dbChunkSettings, setDbChunkSettings] = useState<any>(null)
  const [loadingChunkSettings, setLoadingChunkSettings] = useState(false)
  
  // Check if coming from Documents page
  const isFromDocuments = !!kbId
  const [newChunkContent, setNewChunkContent] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(5)
  const [generalExpanded, setGeneralExpanded] = useState(true)
  const [qaExpanded, setQaExpanded] = useState(false)
  const [tocExpanded, setTocExpanded] = useState(false)
  const [tocLevel, setTocLevel] = useState(() => {
    const saved = Number(localStorage.getItem('kb.tocLevel'))
    return saved >= 1 && saved <= 6 ? saved : 3
  })

  // Fetch documents for the knowledge base
  const fetchDocuments = async () => {
    if (!kbId) return
    
    setLoadingDocuments(true)
    try {
      const response = await fetch(`${API_BASE}/api/kb/get-documents/?kb_id=${kbId}`)
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
        // Auto-select first document if available
        if (data.documents && data.documents.length > 0) {
          setSelectedDocument(data.documents[0].id)
          setDocumentStatus(data.documents[0].status || '')
        }
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
    } finally {
      setLoadingDocuments(false)
    }
  }

  // Fetch chunks from database for selected document
  const fetchChunksFromDB = async (documentId: number) => {
    setLoadingChunks(true)
    try {
      const response = await fetch(`${API_BASE}/api/kb/get-chunks/?document_id=${documentId}`)
      if (response.ok) {
        const data = await response.json()
        setDbChunks(data.chunks || [])
        setShowPreview(true) // Show preview when chunks are loaded
      }
    } catch (error) {
      console.error('Error fetching chunks:', error)
    } finally {
      setLoadingChunks(false)
    }
  }

  // Fetch chunk settings from database
  const fetchChunkSettings = async () => {
    if (!kbId) return
    
    setLoadingChunkSettings(true)
    try {
      const response = await fetch(`${API_BASE}/api/kb/get-chunk-settings/${kbId}/`)
      if (response.ok) {
        const data = await response.json()
        setDbChunkSettings(data)
        
        // Update UI state based on database settings
        if (data.chunk_type === 'general') {
          setGeneralExpanded(true)
          setQaExpanded(false)
          setTocExpanded(false)
          setQaFormat(false)
          setDelimiter(data.delimiter || '\\n\\n')
          setMaxLen(data.max_length?.toString() || '1024')
          setOverlap(data.overlap?.toString() || '50')
          setReplaceSpaces(data.replace_spaces || false)
          setDeleteUrls(data.delete_urls || false)
        } else if (data.chunk_type === 'qa') {
          setGeneralExpanded(false)
          setQaExpanded(true)
          setTocExpanded(false)
          setQaFormat(true)
          setQuestionFlag(data.question_flag || 'Q: ')
          setAnswerFlag(data.answer_flag || 'A: ')
          setQaLanguage(data.qa_language || 'English')
          setQaMaxLength(data.qa_max_length?.toString() || '1024')
          setReplaceSpaces(data.replace_spaces || false)
          setDeleteUrls(data.delete_urls || false)
        } else if (data.chunk_type === 'toc') {
          setGeneralExpanded(false)
          setQaExpanded(false)
          setTocExpanded(true)
          setQaFormat(false)
          setReplaceSpaces(data.replace_spaces ?? true)
          setDeleteUrls(data.delete_urls || false)
          const level = Number(data.toc_level)
          setTocLevel(level >= 1 && level <= 6 ? level : 3)
        }
      }
    } catch (error) {
      console.error('Error fetching chunk settings:', error)
    } finally {
      setLoadingChunkSettings(false)
    }
  }

  // Fetch documents when component mounts and kbId is available
  useEffect(() => {
    if (kbId) {
      fetchDocuments()
      fetchChunkSettings()
    }
  }, [kbId])

  // Fetch chunks when document is selected
  useEffect(() => {
    if (selectedDocument) {
      fetchChunksFromDB(selectedDocument)
    }
  }, [selectedDocument])
  
  // Q&A specific settings
  const [questionFlag, setQuestionFlag] = useState(() => localStorage.getItem('kb.questionFlag') || 'Q: ')
  const [answerFlag, setAnswerFlag] = useState(() => localStorage.getItem('kb.answerFlag') || 'A: ')
  const [qaMaxLength, setQaMaxLength] = useState(() => localStorage.getItem('kb.qaMaxLength') || '1024')
  type EmbeddingModel = { id: string; provider: string; label: string; tags?: string[]; isManagement?: boolean }
  const [embeddingOptions, setEmbeddingOptions] = useState<EmbeddingModel[]>([])
  const [embedding, setEmbedding] = useState<EmbeddingModel | null>(null)
  
  // Show error message for archived documents
  const showArchivedError = () => {
    setSnackbarMessage(t('documentUnavailable'))
    setSnackbarOpen(true)
  }

  const handleSnackbarClose = () => {
    setSnackbarOpen(false)
  }
  
  const [highlighted, setHighlighted] = useState<EmbeddingModel | null>(null)
  const [rerankEnabled, setRerankEnabled] = useState(() => localStorage.getItem('kb.rerankEnabled') === 'true')
  type RerankModel = { id: string; provider: string; label: string; tags?: string[]; isManagement?: boolean }
  const [rerankOptions, setRerankOptions] = useState<RerankModel[]>([])
  const [selectedRerank, setSelectedRerank] = useState<RerankModel | null>(null)
  const [highlightedRerank, setHighlightedRerank] = useState<RerankModel | null>(null)
  const [retrievalMode, setRetrievalMode] = useState<'vector' | 'fulltext' | 'hybrid'>(() => (localStorage.getItem('kb.retrievalMode') as 'vector' | 'fulltext' | 'hybrid') || 'vector')
  const [topK, setTopK] = useState(() => parseInt(localStorage.getItem('kb.topK') || '3'))
  const [scoreEnabled, setScoreEnabled] = useState(() => localStorage.getItem('kb.scoreEnabled') === 'true')
  const [score, setScore] = useState(() => parseFloat(localStorage.getItem('kb.score') || '0.5'))
  const [hybridStrategy, setHybridStrategy] = useState<'weighted' | 'rerank'>(() => (localStorage.getItem('kb.hybridStrategy') as 'weighted' | 'rerank') || 'rerank')
  
  // Validation state
  const [validationError, setValidationError] = useState<string>('')

  // Validation function
  const validateBeforeNavigation = () => {
    setValidationError('')
    
    // Check if files are available
    if (!files || files.length === 0) {
      setValidationError(t('uploadFirst'))
      return false
    }
    
    // Check if embedding model is selected
    if (!embedding) {
      setValidationError(t('selectEmbeddingFirst'))
      return false
    }
    
    return true
  }

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

  // Handle navigation with validation
  const handleSaveAndProcess = async () => {
    if (isFromDocuments) {
      // From Documents page - process selected document
      if (!embedding) {
        setValidationError(t('selectEmbeddingFirst'))
        return
      }
      
      if (!selectedDocument) {
        setValidationError(t('selectDocumentFirst'))
        return
      }
      
      // Check if document is archived
      if (documentStatus === 'archived') {
        showArchivedError()
        return
      }
      
      try {
        // Get all current chunks (including any edits made by user)
        const chunksToSave = isFromDocuments ? dbChunks : chunks
        
        // Prepare the chunks data for the API
        const chunksData = chunksToSave.map((chunk, index) => ({
          chunk_id: chunk.id,
          content: chunk.content,
          embedding_text: chunk.embedding_text || chunk.title || undefined,
          characters: chunk.characters,
          chunk_number: index + 1
        }))
        
        // Call the save chunks API that will handle clearing and saving
        const saveResponse = await fetch(`${API_BASE}/api/kb/save-document-chunks/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_id: selectedDocument,
            chunks: chunksData
          })
        })
        
        if (!saveResponse.ok) {
          throw new Error('Failed to save chunks')
        }
        
        // Vectorize chunks and store in PGVector
        try {
          const vectorizeResponse = await fetch(`${API_BASE}/api/agents/vectorize-chunks/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chunks: chunksData,
              embedding_model_id: embedding?.value,
              knowledge_base_id: kbId,
              document_id: selectedDocument
            })
          })
          
          if (!vectorizeResponse.ok) {
            console.warn('Vectorization failed, but chunks were saved successfully')
          } else {
            console.log('Chunks vectorized and stored in PGVector successfully')
          }
        } catch (vectorizeError) {
          console.warn('Vectorization error:', vectorizeError)
          // Don't fail the entire process if vectorization fails
        }
        
        // Clear editing state if any
        if (editingChunk) {
          setEditingChunk(null)
          setEditingChunkContent('')
        }
        
        // Refresh chunks display
        await fetchChunksFromDB(selectedDocument)
        
        setValidationError('')
        
        // Show success message
        alert(t('chunksSaved'))
        
      } catch (error) {
        console.error('Error saving chunks:', error)
        setValidationError(t('saveChunksFailed', { message: error.message }))
      }
    } else {
      // From normal flow - navigate to processing page
      if (!validateBeforeNavigation()) {
        return
      }
      
      let knowledgeName = 'knowledge'
      
      if (files[0] && embedding?.label) {
        try {
          knowledgeName = await generateKnowledgeName(files[0], embedding.label)
        } catch (error) {
          console.error('Error generating knowledge name:', error)
          // Fallback to simple name generation
          const fileName = files[0].includes('/') ? files[0].split('/').pop() : files[0].split('\\').pop()
          knowledgeName = fileName?.split('.')[0] || 'knowledge'
        }
      } else if (files[0]) {
        const fileName = files[0].includes('/') ? files[0].split('/').pop() : files[0].split('\\').pop()
        knowledgeName = fileName?.split('.')[0] || 'knowledge'
      }
      
      const chunkType = tocExpanded ? 'toc' : qaExpanded ? 'qa' : 'general'
      const effectiveDelimiter = qaExpanded ? questionFlag : delimiter
      const effectiveMaxLen = qaExpanded ? qaMaxLength : maxLen
      
      navigate('/manage/kb/processing', { state: {
        files,
        knowledgeName,
        delimiter: effectiveDelimiter,
        maxLen: effectiveMaxLen,
        replaceSpaces,
        indexMethod,
        retrievalMode,
        embeddingModel: embedding?.label || 'default',
        embeddingModelId: embedding?.id || null,
        overlap: tocExpanded || qaExpanded ? 0 : overlap,
        deleteUrls,
        qaFormat: qaExpanded,
        tocFormat: tocExpanded,
        tocLevel,
        chunkType,
        qaLanguage,
        questionFlag,
        answerFlag,
        qaMaxLength,
        // Pass preview chunks if they exist
        previewChunks: showPreview && chunks.length > 0 ? chunks : null,
      } })
    }
  }

  // Load embedding models from backend
  useEffect(() => {
    const loadEmbeddingModels = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/llm/models/?enabled=true&model_type=${encodeURIComponent('Text Embedding')}`)
        const data = await res.json()
        const models = data.results || data
        const groupedModels = models.map((model: any) => ({
          id: model.id.toString(),
          provider: model.provider,
          label: model.model_name,
          tags: ['Text Embedding']
        }))
        
        // Add management option
        const hasModels = groupedModels.length > 0
        const managementOption = {
          id: 'manage-llm',
          // Only show the group header "No Embedding Models Configured" when there are no models
          provider: hasModels ? '' : t('noEmbedding'),
          label: t('manageLlm'),
          tags: ['MANAGEMENT'],
          isManagement: true
        }

        // When there are models, append Manage LLM at the end without the warning group header
        setEmbeddingOptions(hasModels ? [...groupedModels, managementOption] : [managementOption])
        if (hasModels) {
          // Try to restore from localStorage first
          const savedEmbeddingId = localStorage.getItem('kb.embeddingId')
          const savedEmbedding = savedEmbeddingId ? groupedModels.find(m => m.id === savedEmbeddingId) : null
          setEmbedding(savedEmbedding || groupedModels[0])
        } else {
          setEmbedding(null)
        }
      } catch (error) {
        console.error('Failed to load embedding models:', error)
      }
    }
    loadEmbeddingModels()
  }, [lang])

  // Load rerank models from backend (grouped by provider, same UX as Embedding Model)
  useEffect(() => {
    const loadRerankModels = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/llm/models/?enabled=true&model_type=${encodeURIComponent('Rerank')}`)
        const data = await res.json()
        const models = data.results || data
        const groupedModels: RerankModel[] = models.map((model: any) => ({
          id: model.id.toString(),
          provider: model.provider,
          label: model.model_name,
          tags: ['Rerank'],
        }))

        const hasModels = groupedModels.length > 0
        const managementOption: RerankModel = {
          id: 'manage-llm-rerank',
          provider: hasModels ? '' : t('noRerank'),
          label: t('manageLlm'),
          tags: ['MANAGEMENT'],
          isManagement: true,
        }

        setRerankOptions(hasModels ? [...groupedModels, managementOption] : [managementOption])
        if (hasModels) {
          const savedId = localStorage.getItem('kb.rerankId')
          const savedName = localStorage.getItem('kb.rerankModel')
          const saved =
            (savedId && groupedModels.find(m => m.id === savedId)) ||
            (savedName && groupedModels.find(m => m.label === savedName)) ||
            null
          setSelectedRerank(saved || groupedModels[0])
        } else {
          setSelectedRerank(null)
        }
      } catch (error) {
        console.error('Failed to load rerank models:', error)
      }
    }
    loadRerankModels()
  }, [lang])

  // Persist settings to localStorage
  useEffect(() => { 
    localStorage.setItem('kb.delimiter', delimiter)
  }, [delimiter])
  useEffect(() => { localStorage.setItem('kb.maxLen', maxLen) }, [maxLen])
  useEffect(() => { localStorage.setItem('kb.overlap', overlap) }, [overlap])
  useEffect(() => { localStorage.setItem('kb.replaceSpaces', replaceSpaces.toString()) }, [replaceSpaces])
  useEffect(() => { localStorage.setItem('kb.deleteUrls', deleteUrls.toString()) }, [deleteUrls])
  useEffect(() => { localStorage.setItem('kb.qaFormat', qaFormat.toString()) }, [qaFormat])
  useEffect(() => { localStorage.setItem('kb.qaLanguage', qaLanguage) }, [qaLanguage])
  useEffect(() => { localStorage.setItem('kb.indexMethod', indexMethod) }, [indexMethod])
  useEffect(() => { localStorage.setItem('kb.rerankEnabled', rerankEnabled.toString()) }, [rerankEnabled])
  useEffect(() => {
    if (selectedRerank && !selectedRerank.isManagement) {
      localStorage.setItem('kb.rerankModel', selectedRerank.label)
      localStorage.setItem('kb.rerankId', selectedRerank.id)
    }
  }, [selectedRerank])
  useEffect(() => { localStorage.setItem('kb.retrievalMode', retrievalMode) }, [retrievalMode])
  useEffect(() => { localStorage.setItem('kb.topK', topK.toString()) }, [topK])
  useEffect(() => { localStorage.setItem('kb.scoreEnabled', scoreEnabled.toString()) }, [scoreEnabled])
  useEffect(() => { localStorage.setItem('kb.score', score.toString()) }, [score])
  useEffect(() => { localStorage.setItem('kb.hybridStrategy', hybridStrategy) }, [hybridStrategy])
  useEffect(() => { 
    if (embedding) {
      localStorage.setItem('kb.embeddingId', embedding.id)
    }
  }, [embedding])

  // Persist Q&A settings to localStorage
  useEffect(() => { localStorage.setItem('kb.questionFlag', questionFlag) }, [questionFlag])
  useEffect(() => { localStorage.setItem('kb.answerFlag', answerFlag) }, [answerFlag])
  useEffect(() => { localStorage.setItem('kb.qaMaxLength', qaMaxLength) }, [qaMaxLength])
  useEffect(() => { localStorage.setItem('kb.tocLevel', String(tocLevel)) }, [tocLevel])

  // Chunk management functions
  const handlePreviewChunk = async () => {
    try {
      let settings
      
      if (tocExpanded) {
        settings = {
          chunk_type: 'toc',
          toc_format: true,
          qa_format: false,
          max_length: maxLen,
          overlap: 0,
          replace_spaces: replaceSpaces,
          delete_urls: deleteUrls,
          toc_level: tocLevel,
        }
      } else if (qaExpanded) {
        // Using Q&A mode settings
        settings = {
          chunk_type: 'qa',
          delimiter: questionFlag,
          max_length: qaMaxLength,
          overlap: 0, // Q&A mode doesn't use overlap
          replace_spaces: replaceSpaces,
          delete_urls: deleteUrls,
          qa_format: true,
          toc_format: false,
          qa_language: qaLanguage,
          question_flag: questionFlag,
          answer_flag: answerFlag
        }
      } else {
        // General mode settings
        settings = {
          chunk_type: 'general',
          delimiter,
          max_length: maxLen,
          overlap,
          replace_spaces: replaceSpaces,
          delete_urls: deleteUrls,
          qa_format: false,
          toc_format: false,
          qa_language: qaLanguage
        }
      }
      
      let filePath
      
      if (isFromDocuments) {
        // Use the selected document from the database
        if (!selectedDocument) {
          console.error('No document selected for processing')
          return
        }
        
        // Find the selected document
        const selectedDoc = documents.find(doc => doc.id === selectedDocument)
        if (!selectedDoc) {
          console.error('Selected document not found')
          return
        }
        
        filePath = selectedDoc.file_path
      } else {
        // Use the first uploaded file from the previous step
        if (files.length === 0) {
          console.error('No files available for processing')
          return
        }
        filePath = files[0]
      }
      
      const response = await fetch(`${API_BASE}/api/kb/preview-chunks/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath, settings })
      })
      
      const data = await response.json()
      setChunks(data.chunks || [])
      setShowPreview(true)
      // Reset pagination to first page when previewing chunks
      setCurrentPage(1)
    } catch (error) {
      console.error('Failed to preview chunks:', error)
    }
  }

  const handleDeleteChunk = async (chunkId: string) => {
    // Check if document is archived
    if (isFromDocuments && documentStatus === 'archived') {
      showArchivedError()
      return
    }
    
    try {
      await fetch(`${API_BASE}/api/kb/delete-chunk/${chunkId}/`, {
        method: 'DELETE'
      })
      
      if (isFromDocuments) {
        // Update dbChunks for documents page
        const updatedDbChunks = dbChunks.filter(c => c.id !== chunkId)
        setDbChunks(updatedDbChunks)
      } else {
        // Update chunks for normal flow
        const updatedChunks = chunks.filter(c => c.id !== chunkId)
        setChunks(updatedChunks)
        // Save to localStorage
        localStorage.setItem('kb.chunks', JSON.stringify(updatedChunks))
      }
    } catch (error) {
      console.error('Failed to delete chunk:', error)
    }
  }

  const handleEditChunk = (chunkId: string) => {
    // Check if document is archived
    if (isFromDocuments && documentStatus === 'archived') {
      showArchivedError()
      return
    }
    
    // Use the correct chunks array based on the source
    const chunksToSearch = isFromDocuments ? dbChunks : chunks
    const chunk = chunksToSearch.find(c => c.id === chunkId)
    if (chunk) {
      setEditingChunk(chunkId)
      setEditingChunkContent(chunk.content) // Set the content for editing
    }
  }

  const handleSaveChunk = async () => {
    if (!editingChunk) return
    
    // Check if document is archived
    if (isFromDocuments && documentStatus === 'archived') {
      showArchivedError()
      return
    }
    
    try {
      const response = await fetch(`${API_BASE}/api/kb/update-chunk/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunk_id: editingChunk, content: editingChunkContent })
      })
      
      const data = await response.json()
      
      if (isFromDocuments) {
        // Update dbChunks for documents page
        const updatedDbChunks = dbChunks.map(c => 
          c.id === editingChunk 
            ? { ...c, content: data.content, characters: data.characters }
            : c
        )
        setDbChunks(updatedDbChunks)
      } else {
        // Update chunks for normal flow
        const updatedChunks = chunks.map(c => 
          c.id === editingChunk 
            ? { ...c, content: data.content, characters: data.characters }
            : c
        )
        setChunks(updatedChunks)
        // Save to localStorage
        localStorage.setItem('kb.chunks', JSON.stringify(updatedChunks))
      }
      
      setEditingChunk(null)
      setEditingChunkContent('')
    } catch (error) {
      console.error('Failed to update chunk:', error)
    }
  }

  const handleAddChunk = async () => {
    if (!newChunkContent.trim()) return
    
    // Check if document is archived
    if (isFromDocuments && documentStatus === 'archived') {
      showArchivedError()
      return
    }
    
    try {
      const response = await fetch(`${API_BASE}/api/kb/add-chunk/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: newChunkContent, 
          chunk_number: (isFromDocuments ? dbChunks : chunks).length + 1 
        })
      })
      
      const data = await response.json()
      
      if (isFromDocuments) {
        // Update dbChunks for documents page
        const updatedDbChunks = [...dbChunks, data]
        setDbChunks(updatedDbChunks)
      } else {
        // Update chunks for normal flow
        const updatedChunks = [...chunks, data]
        setChunks(updatedChunks)
        // Save to localStorage
        localStorage.setItem('kb.chunks', JSON.stringify(updatedChunks))
      }
      
      setNewChunkContent('')
    } catch (error) {
      console.error('Failed to add chunk:', error)
    }
  }

  // Reset functions
  const handleGeneralReset = () => {
    setDelimiter('\\n\\n')
    setMaxLen('1024')
    setOverlap('50')
    setReplaceSpaces(true)
    setDeleteUrls(false)
    setQaFormat(false)
    setQaLanguage('English')
  }

  const handleQaReset = () => {
    setQuestionFlag('Q: ')
    setAnswerFlag('A: ')
    setQaMaxLength('1024')
  }

  // Toggle functions with mutual exclusivity (General / Q&A / TOC)
  const selectChunkMode = (mode: 'general' | 'qa' | 'toc') => {
    setGeneralExpanded(mode === 'general')
    setQaExpanded(mode === 'qa')
    setTocExpanded(mode === 'toc')
    setQaFormat(mode === 'qa')
    setCurrentPage(1)
  }

  const toggleGeneral = () => {
    if (generalExpanded) selectChunkMode('qa')
    else selectChunkMode('general')
  }

  const toggleQa = () => {
    if (qaExpanded) selectChunkMode('general')
    else selectChunkMode('qa')
  }

  const toggleToc = () => {
    if (tocExpanded) selectChunkMode('general')
    else selectChunkMode('toc')
  }

  // Load chunks from localStorage on component mount
  useEffect(() => {
    const savedChunks = localStorage.getItem('kb.chunks')
    if (savedChunks) {
      try {
        const parsedChunks = JSON.parse(savedChunks)
        setChunks(parsedChunks)
        setShowPreview(parsedChunks.length > 0)
      } catch (error) {
        console.error('Failed to parse saved chunks:', error)
      }
    }
  }, [])

  // Clear localStorage and reset to defaults when coming from file upload
  useEffect(() => {
    // Check if we came from file upload (files array has content)
    if (files.length > 0) {
      // Clear all localStorage settings first
      localStorage.removeItem('kb.delimiter')
      localStorage.removeItem('kb.maxLen')
      localStorage.removeItem('kb.overlap')
      localStorage.removeItem('kb.replaceSpaces')
      localStorage.removeItem('kb.deleteUrls')
      localStorage.removeItem('kb.qaFormat')
      localStorage.removeItem('kb.qaLanguage')
      localStorage.removeItem('kb.indexMethod')
      localStorage.removeItem('kb.rerankEnabled')
      localStorage.removeItem('kb.rerankModel')
      localStorage.removeItem('kb.rerankId')
      localStorage.removeItem('kb.retrievalMode')
      localStorage.removeItem('kb.topK')
      localStorage.removeItem('kb.scoreEnabled')
      localStorage.removeItem('kb.score')
      localStorage.removeItem('kb.hybridStrategy')
      localStorage.removeItem('kb.embeddingId')
      localStorage.removeItem('kb.questionFlag')
      localStorage.removeItem('kb.answerFlag')
      localStorage.removeItem('kb.qaMaxLength')
      localStorage.removeItem('kb.chunks')
      
      // Force reset all states to defaults
      setDelimiter('\\n\\n')
      setMaxLen('1024')
      setOverlap('50')
      setReplaceSpaces(true)
      setDeleteUrls(false)
      setQaFormat(false)
      setQaLanguage('English')
      setIndexMethod('hq')
      setRerankEnabled(false)
      setSelectedRerank(null)
      setRetrievalMode('vector')
      setTopK(3)
      setScoreEnabled(false)
      setScore(0.5)
      setHybridStrategy('rerank')
      setQuestionFlag('Q: ')
      setAnswerFlag('A: ')
      setQaMaxLength('1024')
      setChunks([])
      setShowPreview(false)
      setGeneralExpanded(true)
      setQaExpanded(false)
      setTocExpanded(false)
    }
  }, [files])

  // Function to render chunk content with overlap highlighting
  const renderChunkWithOverlap = (chunk: any, index: number) => {
    const overlapValue = parseInt(overlap)
    // Q&A mode doesn't show overlap highlighting
    if (qaFormat || tocExpanded || overlapValue <= 0 || index === 0) {
      return <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{chunk.content}</Typography>
    }

    // Find the previous chunk to calculate overlap
    const prevChunk = chunks[index - 1]
    if (!prevChunk) {
      return <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{chunk.content}</Typography>
    }

    // Calculate overlap text from the end of previous chunk
    const prevContent = prevChunk.content
    const overlapText = prevContent.slice(-overlapValue)
    
    // Find where the overlap starts in current chunk
    const overlapStart = chunk.content.indexOf(overlapText)
    
    if (overlapStart === -1) {
      // No overlap found, render normally
      return <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{chunk.content}</Typography>
    }

    // Split content into non-overlap and overlap parts
    const beforeOverlap = chunk.content.slice(0, overlapStart)
    const overlapPart = chunk.content.slice(overlapStart, overlapStart + overlapText.length)
    const afterOverlap = chunk.content.slice(overlapStart + overlapText.length)

    return (
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {beforeOverlap}
        <span style={{ backgroundColor: '#ffeb3b', padding: '1px 2px', borderRadius: '2px' }}>
          {overlapPart}
        </span>
        {afterOverlap}
      </Typography>
    )
  }

  // Pagination calculations
  const chunksToUse = isFromDocuments ? dbChunks : chunks
  const totalPages = Math.ceil(chunksToUse.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentChunks = chunksToUse.slice(startIndex, endIndex)

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', py: 1, display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ maxWidth: 'lg', width: '100%', px: 2 }}>
        <AppTitle />
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6">{t('chunkSettings')}</Typography>
        <Button 
          variant="outlined" 
          onClick={() => navigate(kbId ? `/manage/kb/documents/${kbId}` : '/manage/kb')} 
          startIcon={<ArrowBackIcon />}
        >
          {kbId ? t('backToDocuments') : t('backToKb')}
        </Button>
      </Stack>
      <Stack direction="row" spacing={2}>
        <Box sx={{ flex: 1 }}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            
            {/* General Setting */}
            <Paper 
              variant="outlined" 
              onClick={!generalExpanded && (!isFromDocuments || !dbChunkSettings?.chunk_type || dbChunkSettings?.chunk_type === 'general') ? toggleGeneral : undefined}
              sx={{ 
                p: 2, 
                mb: 2, 
                borderColor: 'primary.main', 
                bgcolor: generalExpanded ? 'primary.50' : 'grey.50',
                cursor: !generalExpanded && (!isFromDocuments || !dbChunkSettings?.chunk_type || dbChunkSettings?.chunk_type === 'general') ? 'pointer' : 'default',
                transition: 'all 0.2s',
                ...(isFromDocuments && dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'general' && { 
                  bgcolor: 'grey.100', 
                  opacity: 0.7,
                  cursor: 'not-allowed'
                })
              }}
            >
              <Box 
                onClick={generalExpanded && (!isFromDocuments || !dbChunkSettings?.chunk_type || dbChunkSettings?.chunk_type === 'general') ? toggleGeneral : undefined}
                sx={{ 
                  cursor: generalExpanded && (!isFromDocuments || !dbChunkSettings?.chunk_type || dbChunkSettings?.chunk_type === 'general') ? 'pointer' : 'default',
                  p: generalExpanded ? 1 : 0,
                  m: generalExpanded ? -1 : 0,
                  '&:hover': generalExpanded && (!isFromDocuments || !dbChunkSettings?.chunk_type || dbChunkSettings?.chunk_type === 'general') ? {
                    bgcolor: 'rgba(0, 0, 0, 0.04)',
                    borderRadius: 1
                  } : {}
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'primary.light', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'primary.contrastText' }}>⚙</Typography>
                  </Box>
                  <Typography variant="subtitle2" fontWeight={600}>{t('general')}</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {t('generalDesc')}
                </Typography>
                {isFromDocuments && dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'general' && (
                  <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
                    {t('chunkTypeLocked', { type: modeLabel(dbChunkSettings.chunk_type, t) })}
                  </Typography>
                )}
              </Box>

              {generalExpanded && (
                <Stack spacing={2} sx={{ mt: 2 }}>
                  <Stack direction="row" spacing={2}>
                    <TextField 
                      label={t('delimiter')} 
                      value={delimiter} 
                      onChange={e => setDelimiter(e.target.value)} 
                      size="small" 
                      sx={{ width: 240 }} 
                      placeholder={t('delimiterPlaceholder')}
                      disabled={isFromDocuments && !!dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'general'}
                      InputProps={{
                        endAdornment: <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>{t('characters')}</Typography>
                      }}
                    />
                    <TextField 
                      label={t('maxChunkLength')} 
                      value={maxLen} 
                      onChange={e => setMaxLen(e.target.value)} 
                      size="small" 
                      sx={{ width: 240 }} 
                      disabled={isFromDocuments && !!dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'general'}
                      InputProps={{ 
                        endAdornment: <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>{t('characters')}</span>
                      }} 
                    />
                    <TextField 
                      label={t('chunkOverlap')} 
                      value={overlap} 
                      onChange={e => setOverlap(e.target.value)} 
                      size="small" 
                      sx={{ width: 240 }} 
                      disabled={isFromDocuments && !!dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'general'}
                      InputProps={{ 
                        endAdornment: <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>{t('numberUnit')}</span>
                      }} 
                    />
                  </Stack>
                  
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>{t('textPreprocess')}</Typography>
                    <Stack spacing={1}>
                      <FormControlLabel 
                        control={<Switch checked={replaceSpaces} onChange={(_, v) => setReplaceSpaces(v)} disabled={isFromDocuments && !!dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'general'} />} 
                        label={t('replaceSpaces')} 
                      />
                      <FormControlLabel 
                        control={<Switch checked={deleteUrls} onChange={(_, v) => setDeleteUrls(v)} disabled={isFromDocuments && !!dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'general'} />} 
                        label={t('deleteUrls')} 
                      />
                    </Stack>
                  </Box>
                  
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" startIcon={<Typography>🔍</Typography>} onClick={handlePreviewChunk}>{t('previewChunk')}</Button>
                    <Button onClick={handleGeneralReset}>{t('reset')}</Button>
                  </Stack>
                </Stack>
              )}
            </Paper>

            {/* Using Q&A Setting */}
            <Paper 
              variant="outlined" 
              onClick={!qaExpanded && (!isFromDocuments || !dbChunkSettings?.chunk_type || dbChunkSettings?.chunk_type === 'qa') ? toggleQa : undefined}
              sx={{ 
                p: 2, 
                mb: 2, 
                borderColor: 'warning.main', 
                bgcolor: qaExpanded ? 'warning.50' : 'grey.50',
                cursor: !qaExpanded && (!isFromDocuments || !dbChunkSettings?.chunk_type || dbChunkSettings?.chunk_type === 'qa') ? 'pointer' : 'default',
                transition: 'all 0.2s',
                ...(isFromDocuments && dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'qa' && { 
                  bgcolor: 'grey.100', 
                  opacity: 0.7,
                  cursor: 'not-allowed'
                })
              }}
            >
              <Box 
                onClick={qaExpanded && (!isFromDocuments || !dbChunkSettings?.chunk_type || dbChunkSettings?.chunk_type === 'qa') ? toggleQa : undefined}
                sx={{ 
                  cursor: qaExpanded && (!isFromDocuments || !dbChunkSettings?.chunk_type || dbChunkSettings?.chunk_type === 'qa') ? 'pointer' : 'default',
                  p: qaExpanded ? 1 : 0,
                  m: qaExpanded ? -1 : 0,
                  '&:hover': qaExpanded && (!isFromDocuments || !dbChunkSettings?.chunk_type || dbChunkSettings?.chunk_type === 'qa') ? {
                    bgcolor: 'rgba(0, 0, 0, 0.04)',
                    borderRadius: 1
                  } : {}
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'warning.light', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'warning.contrastText' }}>👥</Typography>
                  </Box>
                  <Typography variant="subtitle2" fontWeight={600}>{t('usingQa')}</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {t('usingQaDesc')}
                </Typography>
                {isFromDocuments && dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'qa' && (
                  <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
                    {t('chunkTypeLocked', { type: modeLabel(dbChunkSettings.chunk_type, t) })}
                  </Typography>
                )}
              </Box>

              {qaExpanded && (
                <Stack spacing={2} sx={{ mt: 2 }}>
                  <Stack direction="row" spacing={2}>
                    <TextField 
                      label={t('questionFlag')} 
                      value={questionFlag} 
                      onChange={e => setQuestionFlag(e.target.value)} 
                      size="small" 
                      sx={{ width: 240 }} 
                      disabled={isFromDocuments && !!dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'qa'}
                      InputProps={{
                        endAdornment: <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>{t('characters')}</Typography>
                      }}
                    />
                    <TextField 
                      label={t('answerFlag')} 
                      value={answerFlag} 
                      onChange={e => setAnswerFlag(e.target.value)} 
                      size="small" 
                      sx={{ width: 240 }} 
                      disabled={isFromDocuments && !!dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'qa'}
                      InputProps={{ 
                        endAdornment: <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>{t('characters')}</span>
                      }} 
                    />
                    <TextField 
                      label={t('maxChunkLength')} 
                      value={qaMaxLength} 
                      onChange={e => setQaMaxLength(e.target.value)} 
                      size="small" 
                      sx={{ width: 240 }} 
                      disabled={isFromDocuments && !!dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'qa'}
                      InputProps={{ 
                        endAdornment: <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>{t('numberUnit')}</span>
                      }} 
                    />
                  </Stack>
                  
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>{t('textPreprocess')}</Typography>
                    <Stack spacing={1}>
                      <FormControlLabel 
                        control={<Switch checked={replaceSpaces} onChange={(_, v) => setReplaceSpaces(v)} disabled={isFromDocuments && !!dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'qa'} />} 
                        label={t('replaceSpaces')} 
                      />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <FormControlLabel 
                          control={<Switch checked={qaFormat} onChange={(_, v) => setQaFormat(v)} disabled={isFromDocuments && !!dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'qa'} />} 
                          label={t('qaFormatIn')} 
                        />
                        <Select 
                          size="small" 
                          value={qaLanguage} 
                          onChange={e => setQaLanguage(e.target.value)}
                          disabled={!qaFormat || (isFromDocuments && dbChunkSettings?.chunk_type === 'general')}
                          sx={{ minWidth: 100 }}
                        >
                          <MenuItem value="English">{t('english')}</MenuItem>
                          <MenuItem value="Chinese">{t('chinese')}</MenuItem>
                        </Select>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>?</Typography>
                      </Stack>
                    </Stack>
                  </Box>
                  
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" startIcon={<Typography>🔍</Typography>} onClick={handlePreviewChunk}>{t('previewChunk')}</Button>
                    <Button onClick={handleQaReset}>{t('reset')}</Button>
                  </Stack>
                </Stack>
              )}
            </Paper>

            {/* Directory structure */}
            <Paper
              variant="outlined"
              onClick={!tocExpanded && (!isFromDocuments || !dbChunkSettings?.chunk_type || dbChunkSettings?.chunk_type === 'toc') ? toggleToc : undefined}
              sx={{
                p: 2,
                mb: 2,
                borderColor: 'success.main',
                bgcolor: tocExpanded ? 'success.50' : 'grey.50',
                cursor: !tocExpanded && (!isFromDocuments || !dbChunkSettings?.chunk_type || dbChunkSettings?.chunk_type === 'toc') ? 'pointer' : 'default',
                transition: 'all 0.2s',
                ...(isFromDocuments && dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'toc' && {
                  bgcolor: 'grey.100',
                  opacity: 0.7,
                  cursor: 'not-allowed',
                }),
              }}
            >
              <Box
                onClick={tocExpanded && (!isFromDocuments || !dbChunkSettings?.chunk_type || dbChunkSettings?.chunk_type === 'toc') ? toggleToc : undefined}
                sx={{
                  cursor: tocExpanded && (!isFromDocuments || !dbChunkSettings?.chunk_type || dbChunkSettings?.chunk_type === 'toc') ? 'pointer' : 'default',
                  p: tocExpanded ? 1 : 0,
                  m: tocExpanded ? -1 : 0,
                  '&:hover': tocExpanded && (!isFromDocuments || !dbChunkSettings?.chunk_type || dbChunkSettings?.chunk_type === 'toc') ? {
                    bgcolor: 'rgba(0, 0, 0, 0.04)',
                    borderRadius: 1,
                  } : {},
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'success.light', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'success.contrastText' }}>📑</Typography>
                  </Box>
                  <Typography variant="subtitle2" fontWeight={600}>{t('directoryStructure')}</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {t('directoryDesc')}
                </Typography>
                {isFromDocuments && dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'toc' && (
                  <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
                    {t('chunkTypeLocked', { type: modeLabel(dbChunkSettings.chunk_type, t) })}
                  </Typography>
                )}
              </Box>

              {tocExpanded && (
                <Stack spacing={2} sx={{ mt: 2 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="body2" sx={{ minWidth: 140 }}>{t('directoryLevel')}</Typography>
                    <Select
                      size="small"
                      value={tocLevel}
                      onChange={(e) => setTocLevel(Number(e.target.value))}
                      disabled={isFromDocuments && !!dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'toc'}
                      sx={{ minWidth: 160 }}
                    >
                      {[1, 2, 3, 4, 5, 6].map((level) => (
                        <MenuItem key={level} value={level}>{t('levelN', { level })}</MenuItem>
                      ))}
                    </Select>
                  </Stack>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>{t('textPreprocess')}</Typography>
                    <Stack spacing={1}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={replaceSpaces}
                            onChange={(_, v) => setReplaceSpaces(v)}
                            disabled={isFromDocuments && !!dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'toc'}
                          />
                        }
                        label={t('replaceSpaces')}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={deleteUrls}
                            onChange={(_, v) => setDeleteUrls(v)}
                            disabled={isFromDocuments && !!dbChunkSettings?.chunk_type && dbChunkSettings.chunk_type !== 'toc'}
                          />
                        }
                        label={t('deleteUrls')}
                      />
                    </Stack>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('directoryHint')}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" startIcon={<Typography>🔍</Typography>} onClick={handlePreviewChunk}>{t('previewChunk')}</Button>
                  </Stack>
                </Stack>
              )}
            </Paper>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 2, ...(isFromDocuments && { bgcolor: 'grey.50', opacity: 0.7 }) }}>
            <Typography variant="subtitle1" fontWeight={600}>{t('indexMethod')}</Typography>
            <Divider sx={{ my: 1 }} />
            <RadioGroup row value={indexMethod} onChange={isFromDocuments ? undefined : (_, v) => setIndexMethod(v as any)}>
              <FormControlLabel value="hq" control={<Radio disabled={isFromDocuments} />} label={t('highQuality')} />
              <FormControlLabel value="eco" control={<Radio disabled={isFromDocuments} />} label={t('economical')} />
            </RadioGroup>
            <Typography variant="caption" color="text.secondary">{t('hqUnavailable')}</Typography>
            {isFromDocuments && (
              <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
                {t('docsPageLocked')}
              </Typography>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 2, ...(isFromDocuments && { bgcolor: 'grey.50', opacity: 0.7 }) }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>{t('embeddingModel')}</Typography>
              <Typography variant="caption" color="error.main" sx={{ fontWeight: 600 }}>*</Typography>
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Autocomplete
              sx={{ width: 360 }}
              options={embeddingOptions}
              groupBy={(o) => o.provider}
              getOptionLabel={(o) => o.label}
              value={embedding}
              disabled={isFromDocuments}
              onChange={(_, v) => {
                if (v && v.isManagement) {
                  // Navigate to LLM management page
                  navigate('/manage/llm')
                } else {
                  setEmbedding(v)
                }
              }}
              onHighlightChange={(_, v) => setHighlighted(v)}
              renderInput={(params) => <TextField {...params} size="small" placeholder={t('selectEmbedding')} />}
              renderOption={(props, option) => (
                <li {...props} key={option.id} style={{ position: 'relative' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography color={option.isManagement ? 'primary.main' : 'inherit'}>
                      {option.label}
                    </Typography>
                    {option.isManagement && (
                      <Typography variant="caption" color="primary.main">
                        →
                      </Typography>
                    )}
                  </Stack>
                  {highlighted?.id === option.id && !option.isManagement && (
                    <Paper elevation={3} style={{ position: 'absolute', left: 'calc(100% + 8px)', top: 0, width: 240, padding: 12 }}>
                      <Typography fontWeight={600}>{option.label}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                        {(option.tags ?? ['Text Embedding']).map(t => <Chip key={t} size="small" label={t} />)}
                      </Stack>
                    </Paper>
                  )}
                </li>
              )}
            />
            {isFromDocuments && (
              <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
                {t('docsPageLocked')}
              </Typography>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 2, ...(isFromDocuments && { bgcolor: 'grey.50', opacity: 0.7 }) }}>
            <Typography variant="subtitle1" fontWeight={600}>{t('retrievalSetting')}</Typography>
            <Divider sx={{ my: 1 }} />

            {/* Vector Search */}
            <Paper onClick={isFromDocuments ? () => {} : () => setRetrievalMode('vector')} variant="outlined" sx={{ p: 2, mb: 1.5, borderColor: retrievalMode === 'vector' ? 'primary.main' : 'divider', cursor: isFromDocuments ? 'not-allowed' : 'pointer', ...(isFromDocuments && { opacity: 0.7 }) }}>
              <Typography fontWeight={600}>{t('vectorSearch')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('vectorSearchDesc')}</Typography>
              {retrievalMode === 'vector' && (
                <Box sx={{ mt: 2 }}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                    <FormControlLabel control={<Switch checked={rerankEnabled} disabled={isFromDocuments} onChange={isFromDocuments ? undefined : (_, v) => setRerankEnabled(v)} />} label={t('rerankModel')} />
                    <Autocomplete
                      sx={{ width: 360 }}
                      options={rerankOptions}
                      groupBy={(o) => o.provider}
                      getOptionLabel={(o) => o.label}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      value={selectedRerank}
                      disabled={isFromDocuments || !rerankEnabled}
                      onChange={(_, v) => {
                        if (v && v.isManagement) {
                          navigate('/manage/llm')
                        } else {
                          setSelectedRerank(v)
                        }
                      }}
                      onHighlightChange={(_, v) => setHighlightedRerank(v)}
                      renderInput={(params) => <TextField {...params} size="small" placeholder={t('selectRerank')} />}
                      renderOption={(props, option) => (
                        <li {...props} key={option.id} style={{ position: 'relative' }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography color={option.isManagement ? 'primary.main' : 'inherit'}>
                              {option.label}
                            </Typography>
                            {option.isManagement && (
                              <Typography variant="caption" color="primary.main">→</Typography>
                            )}
                          </Stack>
                          {highlightedRerank?.id === option.id && !option.isManagement && (
                            <Paper elevation={3} style={{ position: 'absolute', left: 'calc(100% + 8px)', top: 0, width: 240, padding: 12 }}>
                              <Typography fontWeight={600}>{option.label}</Typography>
                              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                                {(option.tags ?? ['Rerank']).map(t => <Chip key={t} size="small" label={t} />)}
                              </Stack>
                            </Paper>
                          )}
                        </li>
                      )}
                    />
                  </Stack>
                  <Stack direction="row" spacing={4} alignItems="center" sx={{ mt: 2 }}>
                    <Box>
                      <Typography variant="caption">{t('topK')}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Select size="small" disabled={isFromDocuments} value={topK} onChange={e => setTopK(Number(e.target.value))}>
                          {[1,2,3,4,5].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                        </Select>
                        <Slider disabled={isFromDocuments} value={topK} onChange={(_, v) => setTopK(v as number)} min={1} max={10} sx={{ width: 220 }} />
                      </Stack>
                    </Box>
                    <Box>
                      <FormControlLabel control={<Switch checked={scoreEnabled} disabled={isFromDocuments} onChange={isFromDocuments ? undefined : (_, v) => setScoreEnabled(v)} />} label={t('scoreThreshold')} />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField size="small" value={score} sx={{ width: 80 }} disabled={isFromDocuments} />
                        <Slider disabled={isFromDocuments} value={score} onChange={(_, v) => setScore(v as number)} min={0} max={1} step={0.01} sx={{ width: 220 }} />
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              )}
            </Paper>

            {/* Full-Text Search */}
            <Paper onClick={isFromDocuments ? () => {} : () => setRetrievalMode('fulltext')} variant="outlined" sx={{ p: 2, mb: 1.5, borderColor: retrievalMode === 'fulltext' ? 'primary.main' : 'divider', cursor: isFromDocuments ? 'not-allowed' : 'pointer', ...(isFromDocuments && { opacity: 0.7 }) }}>
              <Typography fontWeight={600}>{t('fulltextSearch')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('fulltextSearchDesc')}</Typography>
              {retrievalMode === 'fulltext' && (
                <Box sx={{ mt: 2 }}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                    <FormControlLabel control={<Switch checked={rerankEnabled} onChange={(_, v) => setRerankEnabled(v)} />} label={t('rerankModel')} />
                    <Autocomplete
                      sx={{ width: 360 }}
                      options={rerankOptions}
                      groupBy={(o) => o.provider}
                      getOptionLabel={(o) => o.label}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      value={selectedRerank}
                      disabled={!rerankEnabled}
                      onChange={(_, v) => {
                        if (v && v.isManagement) {
                          navigate('/manage/llm')
                        } else {
                          setSelectedRerank(v)
                        }
                      }}
                      onHighlightChange={(_, v) => setHighlightedRerank(v)}
                      renderInput={(params) => <TextField {...params} size="small" placeholder={t('selectRerank')} />}
                      renderOption={(props, option) => (
                        <li {...props} key={option.id} style={{ position: 'relative' }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography color={option.isManagement ? 'primary.main' : 'inherit'}>
                              {option.label}
                            </Typography>
                            {option.isManagement && (
                              <Typography variant="caption" color="primary.main">→</Typography>
                            )}
                          </Stack>
                          {highlightedRerank?.id === option.id && !option.isManagement && (
                            <Paper elevation={3} style={{ position: 'absolute', left: 'calc(100% + 8px)', top: 0, width: 240, padding: 12 }}>
                              <Typography fontWeight={600}>{option.label}</Typography>
                              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                                {(option.tags ?? ['Rerank']).map(t => <Chip key={t} size="small" label={t} />)}
                              </Stack>
                            </Paper>
                          )}
                        </li>
                      )}
                    />
                  </Stack>
                  <Stack direction="row" spacing={4} alignItems="center" sx={{ mt: 2 }}>
                    <Box>
                      <Typography variant="caption">{t('topK')}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Select size="small" disabled={isFromDocuments} value={topK} onChange={e => setTopK(Number(e.target.value))}>
                          {[1,2,3,4,5].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                        </Select>
                        <Slider disabled={isFromDocuments} value={topK} onChange={(_, v) => setTopK(v as number)} min={1} max={10} sx={{ width: 220 }} />
                      </Stack>
                    </Box>
                    <Box>
                      <FormControlLabel control={<Switch checked={scoreEnabled} disabled={isFromDocuments} onChange={isFromDocuments ? undefined : (_, v) => setScoreEnabled(v)} />} label={t('scoreThreshold')} />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField size="small" value={score} sx={{ width: 80 }} disabled={isFromDocuments} />
                        <Slider disabled={isFromDocuments} value={score} onChange={(_, v) => setScore(v as number)} min={0} max={1} step={0.01} sx={{ width: 220 }} />
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              )}
            </Paper>

            {/* Hybrid Search */}
            <Paper onClick={isFromDocuments ? () => {} : () => setRetrievalMode('hybrid')} variant="outlined" sx={{ p: 2, borderColor: retrievalMode === 'hybrid' ? 'primary.main' : 'divider', cursor: isFromDocuments ? 'not-allowed' : 'pointer', ...(isFromDocuments && { opacity: 0.7 }) }}>
              <Typography fontWeight={600}>{t('hybridSearch')}</Typography>
              <Chip label={t('recommend')} size="small" sx={{ ml: 1 }} />
              <Typography variant="body2" color="text.secondary">{t('hybridSearchDesc')}</Typography>
              {retrievalMode === 'hybrid' && (
                <Box sx={{ mt: 2 }}>
                  <Stack direction="row" spacing={2}>
                    <Paper variant="outlined" sx={{ p: 2, flex: 1, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <FormControlLabel control={<Radio checked={hybridStrategy === 'weighted'} disabled={isFromDocuments} onChange={isFromDocuments ? undefined : () => setHybridStrategy('weighted')} />} label={t('weightedScore')} />
                      <Typography variant="body2" color="text.secondary">{t('weightedScoreDesc')}</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 2, flex: 1, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <FormControlLabel control={<Radio checked={hybridStrategy === 'rerank'} disabled={isFromDocuments} onChange={isFromDocuments ? undefined : () => setHybridStrategy('rerank')} />} label={t('rerankModel')} />
                      <Typography variant="body2" color="text.secondary">{t('rerankDesc')}</Typography>
                    </Paper>
                  </Stack>
                  <Autocomplete
                    sx={{ width: 360, mt: 2 }}
                    options={rerankOptions}
                    groupBy={(o) => o.provider}
                    getOptionLabel={(o) => o.label}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    value={selectedRerank}
                    disabled={isFromDocuments || hybridStrategy !== 'rerank'}
                    onChange={(_, v) => {
                      if (v && v.isManagement) {
                        navigate('/manage/llm')
                      } else {
                        setSelectedRerank(v)
                      }
                    }}
                    onHighlightChange={(_, v) => setHighlightedRerank(v)}
                    renderInput={(params) => <TextField {...params} size="small" placeholder={t('selectRerank')} />}
                    renderOption={(props, option) => (
                      <li {...props} key={option.id} style={{ position: 'relative' }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography color={option.isManagement ? 'primary.main' : 'inherit'}>
                            {option.label}
                          </Typography>
                          {option.isManagement && (
                            <Typography variant="caption" color="primary.main">→</Typography>
                          )}
                        </Stack>
                        {highlightedRerank?.id === option.id && !option.isManagement && (
                          <Paper elevation={3} style={{ position: 'absolute', left: 'calc(100% + 8px)', top: 0, width: 240, padding: 12 }}>
                            <Typography fontWeight={600}>{option.label}</Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                              {(option.tags ?? ['Rerank']).map(t => <Chip key={t} size="small" label={t} />)}
                            </Stack>
                          </Paper>
                        )}
                      </li>
                    )}
                  />
                  <Stack direction="row" spacing={4} alignItems="center" sx={{ mt: 2 }}>
                    <Box>
                      <Typography variant="caption">{t('topK')}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Select size="small" disabled={isFromDocuments} value={topK} onChange={e => setTopK(Number(e.target.value))}>
                          {[1,2,3,4,5].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                        </Select>
                        <Slider disabled={isFromDocuments} value={topK} onChange={(_, v) => setTopK(v as number)} min={1} max={10} sx={{ width: 220 }} />
                      </Stack>
                    </Box>
                    <Box>
                      <FormControlLabel control={<Switch checked={scoreEnabled} disabled={isFromDocuments} onChange={isFromDocuments ? undefined : (_, v) => setScoreEnabled(v)} />} label={t('scoreThreshold')} />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField size="small" value={score} sx={{ width: 80 }} disabled={isFromDocuments} />
                        <Slider disabled={isFromDocuments} value={score} onChange={(_, v) => setScore(v as number)} min={0} max={1} step={0.01} sx={{ width: 220 }} />
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              )}
            </Paper>
            
            {isFromDocuments && (
              <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 2 }}>
                {t('docsPageLocked')}
              </Typography>
            )}

            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              {isFromDocuments ? (
                <Button variant="outlined" onClick={() => navigate(kbId ? `/manage/kb/documents/${kbId}` : '/manage/kb')}>
                  {t('cancel')}
                </Button>
              ) : (
                <Button variant="outlined" onClick={() => navigate('/manage/kb/upload', { state: { files } })} startIcon={<ArrowBackIcon />}>
                  {t('previousStep')}
                </Button>
              )}
              <Box sx={{ flex: 1 }} />
              <Button variant="contained" onClick={handleSaveAndProcess}>{t('saveAndProcess')}</Button>
            </Stack>
            
            {/* Validation error display */}
            {validationError && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1, border: '1px solid', borderColor: 'error.main' }}>
                <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>
                  {validationError}
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>

        <Box sx={{ width: 360 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={600}>{t('preview')}</Typography>
              {isFromDocuments ? (
                <Select 
                  size="small" 
                  value={selectedDocument || ''} 
                  onChange={(e) => setSelectedDocument(Number(e.target.value))}
                  sx={{ minWidth: 200 }}
                  disabled={loadingDocuments}
                >
                  {documents.map(doc => (
                    <MenuItem key={doc.id} value={doc.id}>
                      {doc.file_name}
                    </MenuItem>
                  ))}
                </Select>
              ) : (
                <Select size="small" value={files[0] ?? ''} sx={{ minWidth: 200 }}>
                  {files.map(f => {
                    const fileName = f.includes('/') ? f.split('/').pop() : f
                    return <MenuItem key={f} value={f}>{fileName}</MenuItem>
                  })}
                </Select>
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              {isFromDocuments ? (
                loadingChunks ? t('loadingChunks') :
                showPreview ? t('storedChunks', { count: dbChunks.length }) : 
                loadingDocuments ? t('loadingDocsShort') : 
                t('docsAvailable', { count: documents.length })
              ) : (
                showPreview ? t('estimatedChunks', { count: chunks.length }) : t('preprocessDocs', { count: files.length })
              )}
            </Typography>
            
            {showPreview ? (
              <Stack spacing={1.5} sx={{ maxHeight: 600, overflow: 'auto' }}>
                {currentChunks.map((chunk, index) => (
                  <Paper key={chunk.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        {t('chunkNumber', { number: chunk.chunk_number ?? startIndex + index + 1 })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{chunk.characters} {t('characters')}</Typography>
                      <Box sx={{ flex: 1 }} />
                      <Button 
                        size="small" 
                        onClick={() => handleEditChunk(chunk.id)}
                        disabled={isFromDocuments && documentStatus === 'archived'}
                      >
                        {t('editChunk')}
                      </Button>
                      <Button 
                        size="small" 
                        color="error" 
                        onClick={() => handleDeleteChunk(chunk.id)}
                        disabled={isFromDocuments && documentStatus === 'archived'}
                      >
                        {t('deleteChunk')}
                      </Button>
                    </Stack>
                    {editingChunk === chunk.id ? (
                      <Stack spacing={1}>
                        <TextField
                          multiline
                          rows={3}
                          value={editingChunkContent}
                          onChange={e => setEditingChunkContent(e.target.value)}
                          size="small"
                          fullWidth
                        />
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="contained" onClick={handleSaveChunk}>{t('save')}</Button>
                          <Button size="small" onClick={() => {
                            setEditingChunk(null)
                            setEditingChunkContent('')
                          }}>{t('cancel')}</Button>
                        </Stack>
                      </Stack>
                    ) : (
                      renderChunkWithOverlap(chunk, startIndex + index)
                    )}
                  </Paper>
                ))}
                
                {/* Add new chunk */}
                <Paper variant="outlined" sx={{ p: 1.5, borderStyle: 'dashed' }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('addNewChunk')}</Typography>
                  <TextField
                    multiline
                    rows={3}
                    placeholder={t('enterChunk')}
                    value={newChunkContent}
                    onChange={e => setNewChunkContent(e.target.value)}
                    size="small"
                    fullWidth
                    sx={{ mb: 1 }}
                    disabled={isFromDocuments && documentStatus === 'archived'}
                  />
                  <Button 
                    size="small" 
                    variant="contained" 
                    onClick={handleAddChunk} 
                    disabled={!newChunkContent.trim() || (isFromDocuments && documentStatus === 'archived')}
                  >
                    {t('addChunk')}
                  </Button>
                </Paper>

                {/* Pagination */}
                {totalPages > 1 && (
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mt: 2 }}>
                    <Button 
                      size="small" 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => prev - 1)}
                    >
                      {t('previous')}
                    </Button>
                    <Typography variant="body2">
                      {t('pageOf', { page: currentPage, total: totalPages })}
                    </Typography>
                    <Button 
                      size="small" 
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                    >
                      {t('next')}
                    </Button>
                  </Stack>
                )}
              </Stack>
            ) : (
              <Stack spacing={1}>
            {files.map(f => (
              <Stack key={f} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <InsertDriveFileIcon fontSize="small" />
                <Typography variant="body2" sx={{ flex: 1 }}>{f}</Typography>
              </Stack>
            ))}
                <Box sx={{ mt: 4, color: 'text.secondary', textAlign: 'center' }}>
                  {t('previewHint')}
                </Box>
              </Stack>
            )}
          </Paper>
        </Box>
      </Stack>
      </Box>
      
      {/* Snackbar for archived document error */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity="error"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  )
}


