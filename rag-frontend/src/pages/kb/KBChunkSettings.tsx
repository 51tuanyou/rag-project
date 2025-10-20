import { useEffect, useMemo, useState } from 'react'
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
} from '@mui/material'
import Autocomplete from '@mui/material/Autocomplete'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useLocation, useNavigate } from 'react-router-dom'

export default function KBChunkSettings() {
  const navigate = useNavigate()
  const location = useLocation()
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
  const [chunks, setChunks] = useState<Array<{id: string; content: string; characters: number}>>([])
  const [showPreview, setShowPreview] = useState(false)
  const [editingChunk, setEditingChunk] = useState<string | null>(null)
  const [newChunkContent, setNewChunkContent] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(5)
  const [generalExpanded, setGeneralExpanded] = useState(true)
  const [qaExpanded, setQaExpanded] = useState(false)
  
  // Q&A specific settings
  const [questionFlag, setQuestionFlag] = useState(() => localStorage.getItem('kb.questionFlag') || 'Q: ')
  const [answerFlag, setAnswerFlag] = useState(() => localStorage.getItem('kb.answerFlag') || 'A: ')
  const [qaMaxLength, setQaMaxLength] = useState(() => localStorage.getItem('kb.qaMaxLength') || '1024')
  type EmbeddingModel = { id: string; provider: string; label: string; tags?: string[] }
  const [embeddingOptions, setEmbeddingOptions] = useState<EmbeddingModel[]>([])
  const [embedding, setEmbedding] = useState<EmbeddingModel | null>(null)
  const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000'
  const [highlighted, setHighlighted] = useState<EmbeddingModel | null>(null)
  const [rerankEnabled, setRerankEnabled] = useState(() => localStorage.getItem('kb.rerankEnabled') === 'true')
  const [rerankModel, setRerankModel] = useState(() => localStorage.getItem('kb.rerankModel') || 'qte-rerank')
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
      setValidationError('Please upload documents first to continue processing')
      return false
    }
    
    // Check if embedding model is selected
    if (!embedding) {
      setValidationError('Please select an embedding model to continue processing')
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
    
    navigate('/manage/kb/processing', { state: {
      files,
      knowledgeName,
      delimiter,
      maxLen,
      replaceSpaces,
      indexMethod,
      retrievalMode,
      embeddingModel: embedding?.label || 'default',
      embeddingModelId: embedding?.id || null,
      overlap,
      deleteUrls,
      qaFormat,
      qaLanguage,
      questionFlag,
      answerFlag,
      qaMaxLength,
      // Pass preview chunks if they exist
      previewChunks: showPreview && chunks.length > 0 ? chunks : null,
    } })
  }

  // Load embedding models from backend
  useEffect(() => {
    const loadEmbeddingModels = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/llm/models/?enabled=true&model_type=TEXT EMBEDDING`)
        const data = await res.json()
        const models = data.results || data
        const groupedModels = models.map((model: any) => ({
          id: model.id.toString(),
          provider: model.provider,
          label: model.model_name,
          tags: ['TEXT EMBEDDING']
        }))
        
        // Add management option
        const hasModels = groupedModels.length > 0
        const managementOption = {
          id: 'manage-llm',
          // Only show the group header "No Embedding Models Configured" when there are no models
          provider: hasModels ? '' : 'No Embedding Models Configured',
          label: 'Manage LLM',
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
  }, [])

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
  useEffect(() => { localStorage.setItem('kb.rerankModel', rerankModel) }, [rerankModel])
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

  // Chunk management functions
  const handlePreviewChunk = async () => {
    try {
      let settings
      
      if (qaExpanded) {
        // Using Q&A mode settings
        settings = {
          delimiter: questionFlag,
          max_length: qaMaxLength,
          overlap: 0, // Q&A mode doesn't use overlap
          replace_spaces: replaceSpaces,
          delete_urls: deleteUrls,
          qa_format: true,
          qa_language: qaLanguage,
          answer_flag: answerFlag
        }
      } else {
        // General mode settings
        settings = {
          delimiter,
          max_length: maxLen,
          overlap,
          replace_spaces: replaceSpaces,
          delete_urls: deleteUrls,
          qa_format: false,
          qa_language: qaLanguage
        }
      }
      
      // Use the first uploaded file from the previous step
      if (files.length === 0) {
        console.error('No files available for processing')
        return
      }
      const filePath = files[0]
      
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
    try {
      await fetch(`${API_BASE}/api/kb/delete-chunk/${chunkId}/`, {
        method: 'DELETE'
      })
      const updatedChunks = chunks.filter(c => c.id !== chunkId)
      setChunks(updatedChunks)
      // Save to localStorage
      localStorage.setItem('kb.chunks', JSON.stringify(updatedChunks))
    } catch (error) {
      console.error('Failed to delete chunk:', error)
    }
  }

  const handleEditChunk = (chunkId: string) => {
    const chunk = chunks.find(c => c.id === chunkId)
    if (chunk) {
      setEditingChunk(chunkId)
      setNewChunkContent(chunk.content)
    }
  }

  const handleSaveChunk = async () => {
    if (!editingChunk) return
    
    try {
      const response = await fetch(`${API_BASE}/api/kb/update-chunk/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunk_id: editingChunk, content: newChunkContent })
      })
      
      const data = await response.json()
      const updatedChunks = chunks.map(c => 
        c.id === editingChunk 
          ? { ...c, content: data.content, characters: data.characters }
          : c
      )
      setChunks(updatedChunks)
      // Save to localStorage
      localStorage.setItem('kb.chunks', JSON.stringify(updatedChunks))
      setEditingChunk(null)
      setNewChunkContent('')
    } catch (error) {
      console.error('Failed to update chunk:', error)
    }
  }

  const handleAddChunk = async () => {
    if (!newChunkContent.trim()) return
    
    try {
      const response = await fetch(`${API_BASE}/api/kb/add-chunk/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newChunkContent, chunk_number: chunks.length + 1 })
      })
      
      const data = await response.json()
      const updatedChunks = [...chunks, data]
      setChunks(updatedChunks)
      // Save to localStorage
      localStorage.setItem('kb.chunks', JSON.stringify(updatedChunks))
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

  // Toggle functions with mutual exclusivity
  const toggleGeneral = () => {
    if (generalExpanded) {
      // If General is expanded, close it and open Q&A
      setGeneralExpanded(false)
      setQaExpanded(true)
    } else {
      // If General is closed, open it and close Q&A
      setGeneralExpanded(true)
      setQaExpanded(false)
    }
    // Reset pagination when switching between settings
    setCurrentPage(1)
  }

  const toggleQa = () => {
    if (qaExpanded) {
      // If Q&A is expanded, close it and open General
      setQaExpanded(false)
      setGeneralExpanded(true)
    } else {
      // If Q&A is closed, open it and close General
      setQaExpanded(true)
      setGeneralExpanded(false)
    }
    // Reset pagination when switching between settings
    setCurrentPage(1)
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
      setRerankModel('qte-rerank')
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
    }
  }, [files])

  // Function to render chunk content with overlap highlighting
  const renderChunkWithOverlap = (chunk: any, index: number) => {
    const overlapValue = parseInt(overlap)
    // Q&A mode doesn't show overlap highlighting
    if (qaFormat || overlapValue <= 0 || index === 0) {
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
  const totalPages = Math.ceil(chunks.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentChunks = chunks.slice(startIndex, endIndex)

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', py: 1, display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ maxWidth: 'lg', width: '100%', px: 2 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3, textAlign: 'center', fontWeight: 600, color: 'primary.main' }}>
          Xenera RAG Tool
        </Typography>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6">Chunk Settings</Typography>
        <Button variant="outlined" onClick={() => navigate('/manage/kb')} startIcon={<ArrowBackIcon />}>
          返回管理知识库
        </Button>
      </Stack>
      <Stack direction="row" spacing={2}>
        <Box sx={{ flex: 1 }}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            
            {/* General Setting */}
            <Paper 
              variant="outlined" 
              onClick={!generalExpanded ? toggleGeneral : undefined}
              sx={{ 
                p: 2, 
                mb: 2, 
                borderColor: 'primary.main', 
                bgcolor: generalExpanded ? 'primary.50' : 'grey.50',
                cursor: !generalExpanded ? 'pointer' : 'default',
                transition: 'all 0.2s'
              }}
            >
              <Box 
                onClick={generalExpanded ? toggleGeneral : undefined}
                sx={{ 
                  cursor: generalExpanded ? 'pointer' : 'default',
                  p: generalExpanded ? 1 : 0,
                  m: generalExpanded ? -1 : 0,
                  '&:hover': generalExpanded ? {
                    bgcolor: 'rgba(0, 0, 0, 0.04)',
                    borderRadius: 1
                  } : {}
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'primary.light', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'primary.contrastText' }}>⚙</Typography>
                  </Box>
                  <Typography variant="subtitle2" fontWeight={600}>General</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  General text chunking mode, the chunks retrieved and recalled are the same.
                </Typography>
              </Box>

              {generalExpanded && (
                <Stack spacing={2} sx={{ mt: 2 }}>
                  <Stack direction="row" spacing={2}>
                    <TextField 
                      label="Delimiter" 
                      value={delimiter} 
                      onChange={e => setDelimiter(e.target.value)} 
                      size="small" 
                      sx={{ width: 240 }} 
                      placeholder="Enter delimiter (e.g., \n\n for double newlines)"
                      InputProps={{
                        endAdornment: <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>characters</Typography>
                      }}
                    />
                    <TextField 
                      label="Maximum chunk length" 
                      value={maxLen} 
                      onChange={e => setMaxLen(e.target.value)} 
                      size="small" 
                      sx={{ width: 240 }} 
                      InputProps={{ 
                        endAdornment: <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>characters</span>
                      }} 
                    />
                    <TextField 
                      label="Chunk overlap" 
                      value={overlap} 
                      onChange={e => setOverlap(e.target.value)} 
                      size="small" 
                      sx={{ width: 240 }} 
                      InputProps={{ 
                        endAdornment: <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>number</span>
                      }} 
                    />
                  </Stack>
                  
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Text Pre-processing Rules</Typography>
                    <Stack spacing={1}>
                      <FormControlLabel 
                        control={<Switch checked={replaceSpaces} onChange={(_, v) => setReplaceSpaces(v)} />} 
                        label="Replace consecutive spaces, newlines and tabs" 
                      />
                      <FormControlLabel 
                        control={<Switch checked={deleteUrls} onChange={(_, v) => setDeleteUrls(v)} />} 
                        label="Delete all URLs and email addresses" 
                      />
                    </Stack>
                  </Box>
                  
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" startIcon={<Typography>🔍</Typography>} onClick={handlePreviewChunk}>Preview Chunk</Button>
                    <Button onClick={handleGeneralReset}>Reset</Button>
                  </Stack>
                </Stack>
              )}
            </Paper>

            {/* Using Q&A Setting */}
            <Paper 
              variant="outlined" 
              onClick={!qaExpanded ? toggleQa : undefined}
              sx={{ 
                p: 2, 
                mb: 2, 
                borderColor: 'warning.main', 
                bgcolor: qaExpanded ? 'warning.50' : 'grey.50',
                cursor: !qaExpanded ? 'pointer' : 'default',
                transition: 'all 0.2s'
              }}
            >
              <Box 
                onClick={qaExpanded ? toggleQa : undefined}
                sx={{ 
                  cursor: qaExpanded ? 'pointer' : 'default',
                  p: qaExpanded ? 1 : 0,
                  m: qaExpanded ? -1 : 0,
                  '&:hover': qaExpanded ? {
                    bgcolor: 'rgba(0, 0, 0, 0.04)',
                    borderRadius: 1
                  } : {}
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'warning.light', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'warning.contrastText' }}>👥</Typography>
                  </Box>
                  <Typography variant="subtitle2" fontWeight={600}>Using Q&A</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  When using the Q&A mode, the Question is used for embedding and retrieval.
                </Typography>
              </Box>

              {qaExpanded && (
                <Stack spacing={2} sx={{ mt: 2 }}>
                  <Stack direction="row" spacing={2}>
                    <TextField 
                      label="Question flag" 
                      value={questionFlag} 
                      onChange={e => setQuestionFlag(e.target.value)} 
                      size="small" 
                      sx={{ width: 240 }} 
                      InputProps={{
                        endAdornment: <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>characters</Typography>
                      }}
                    />
                    <TextField 
                      label="Answer flag" 
                      value={answerFlag} 
                      onChange={e => setAnswerFlag(e.target.value)} 
                      size="small" 
                      sx={{ width: 240 }} 
                      InputProps={{ 
                        endAdornment: <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>characters</span>
                      }} 
                    />
                    <TextField 
                      label="Maximum chunk length" 
                      value={qaMaxLength} 
                      onChange={e => setQaMaxLength(e.target.value)} 
                      size="small" 
                      sx={{ width: 240 }} 
                      InputProps={{ 
                        endAdornment: <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>number</span>
                      }} 
                    />
                  </Stack>
                  
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Text Pre-processing Rules</Typography>
                    <Stack spacing={1}>
                      <FormControlLabel 
                        control={<Switch checked={replaceSpaces} onChange={(_, v) => setReplaceSpaces(v)} />} 
                        label="Replace consecutive spaces, newlines and tabs" 
                      />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <FormControlLabel 
                          control={<Switch checked={qaFormat} onChange={(_, v) => setQaFormat(v)} />} 
                          label="Chunk using Q&A format in" 
                        />
                        <Select 
                          size="small" 
                          value={qaLanguage} 
                          onChange={e => setQaLanguage(e.target.value)}
                          disabled={!qaFormat}
                          sx={{ minWidth: 100 }}
                        >
                          <MenuItem value="English">English</MenuItem>
                          <MenuItem value="Chinese">Chinese</MenuItem>
                        </Select>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>?</Typography>
                      </Stack>
                    </Stack>
                  </Box>
                  
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" startIcon={<Typography>🔍</Typography>} onClick={handlePreviewChunk}>Preview Chunk</Button>
                    <Button onClick={handleQaReset}>Reset</Button>
                  </Stack>
                </Stack>
              )}
            </Paper>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>Index Method</Typography>
            <Divider sx={{ my: 1 }} />
            <RadioGroup row value={indexMethod} onChange={(_, v) => setIndexMethod(v as any)}>
              <FormControlLabel value="hq" control={<Radio />} label="High Quality" />
              <FormControlLabel value="eco" control={<Radio />} label="Economical" />
            </RadioGroup>
            <Typography variant="caption" color="text.secondary">Once finishing embedding in High Quality mode, reverting to Economical mode is not available.</Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>Embedding Model</Typography>
              <Typography variant="caption" color="error.main" sx={{ fontWeight: 600 }}>*</Typography>
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Autocomplete
              sx={{ width: 360 }}
              options={embeddingOptions}
              groupBy={(o) => o.provider}
              getOptionLabel={(o) => o.label}
              value={embedding}
              onChange={(_, v) => {
                if (v && v.isManagement) {
                  // Navigate to LLM management page
                  navigate('/manage/llm')
                } else {
                  setEmbedding(v)
                }
              }}
              onHighlightChange={(_, v) => setHighlighted(v)}
              renderInput={(params) => <TextField {...params} size="small" placeholder="Please select an embedding model" />}
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
                        {(option.tags ?? ['TEXT EMBEDDING']).map(t => <Chip key={t} size="small" label={t} />)}
                      </Stack>
                    </Paper>
                  )}
                </li>
              )}
            />
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>Retrieval Setting</Typography>
            <Divider sx={{ my: 1 }} />

            {/* Vector Search */}
            <Paper onClick={() => setRetrievalMode('vector')} variant="outlined" sx={{ p: 2, mb: 1.5, borderColor: retrievalMode === 'vector' ? 'primary.main' : 'divider', cursor: 'pointer' }}>
              <Typography fontWeight={600}>Vector Search</Typography>
              <Typography variant="body2" color="text.secondary">Generate query embeddings and search for the text chunk most similar to its vector representation.</Typography>
              {retrievalMode === 'vector' && (
                <Box sx={{ mt: 2 }}>
                  <FormControlLabel control={<Switch checked={rerankEnabled} onChange={(_, v) => setRerankEnabled(v)} />} label="Rerank Model" />
                  <Select size="small" disabled={!rerankEnabled} value={rerankModel} onChange={e => setRerankModel(e.target.value)} sx={{ ml: 2 }}>
                    <MenuItem value="qte-rerank">qte-rerank</MenuItem>
                  </Select>
                  <Stack direction="row" spacing={4} alignItems="center" sx={{ mt: 2 }}>
                    <Box>
                      <Typography variant="caption">Top K</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Select size="small" value={topK} onChange={e => setTopK(Number(e.target.value))}>
                          {[1,2,3,4,5].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                        </Select>
                        <Slider value={topK} onChange={(_, v) => setTopK(v as number)} min={1} max={10} sx={{ width: 220 }} />
                      </Stack>
                    </Box>
                    <Box>
                      <FormControlLabel control={<Switch checked={scoreEnabled} onChange={(_, v) => setScoreEnabled(v)} />} label="Score Threshold" />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField size="small" value={score} sx={{ width: 80 }} disabled={!scoreEnabled} />
                        <Slider value={score} onChange={(_, v) => setScore(v as number)} min={0} max={1} step={0.01} disabled={!scoreEnabled} sx={{ width: 220 }} />
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              )}
            </Paper>

            {/* Full-Text Search */}
            <Paper onClick={() => setRetrievalMode('fulltext')} variant="outlined" sx={{ p: 2, mb: 1.5, borderColor: retrievalMode === 'fulltext' ? 'primary.main' : 'divider', cursor: 'pointer' }}>
              <Typography fontWeight={600}>Full-Text Search</Typography>
              <Typography variant="body2" color="text.secondary">Index all terms in the document, allowing users to search any term and retrieve relevant text chunk containing those terms.</Typography>
              {retrievalMode === 'fulltext' && (
                <Box sx={{ mt: 2 }}>
                  <FormControlLabel control={<Switch checked={rerankEnabled} onChange={(_, v) => setRerankEnabled(v)} />} label="Rerank Model" />
                  <Select size="small" disabled={!rerankEnabled} value={rerankModel} onChange={e => setRerankModel(e.target.value)} sx={{ ml: 2 }}>
                    <MenuItem value="qte-rerank">qte-rerank</MenuItem>
                  </Select>
                  <Stack direction="row" spacing={4} alignItems="center" sx={{ mt: 2 }}>
                    <Box>
                      <Typography variant="caption">Top K</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Select size="small" value={topK} onChange={e => setTopK(Number(e.target.value))}>
                          {[1,2,3,4,5].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                        </Select>
                        <Slider value={topK} onChange={(_, v) => setTopK(v as number)} min={1} max={10} sx={{ width: 220 }} />
                      </Stack>
                    </Box>
                    <Box>
                      <FormControlLabel control={<Switch checked={scoreEnabled} onChange={(_, v) => setScoreEnabled(v)} />} label="Score Threshold" />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField size="small" value={score} sx={{ width: 80 }} disabled={!scoreEnabled} />
                        <Slider value={score} onChange={(_, v) => setScore(v as number)} min={0} max={1} step={0.01} disabled={!scoreEnabled} sx={{ width: 220 }} />
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              )}
            </Paper>

            {/* Hybrid Search */}
            <Paper onClick={() => setRetrievalMode('hybrid')} variant="outlined" sx={{ p: 2, borderColor: retrievalMode === 'hybrid' ? 'primary.main' : 'divider', cursor: 'pointer' }}>
              <Typography fontWeight={600}>Hybrid Search</Typography>
              <Chip label="RECOMMEND" size="small" sx={{ ml: 1 }} />
              <Typography variant="body2" color="text.secondary">Execute full-text search and vector searches simultaneously, re-rank to select the best match for the user's query. Users can choose to set weights or configure to a Rerank model.</Typography>
              {retrievalMode === 'hybrid' && (
                <Box sx={{ mt: 2 }}>
                  <Stack direction="row" spacing={2}>
                    <Paper variant="outlined" sx={{ p: 2, flex: 1, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <FormControlLabel control={<Radio checked={hybridStrategy === 'weighted'} onChange={() => setHybridStrategy('weighted')} />} label="Weighted Score" />
                      <Typography variant="body2" color="text.secondary">By adjusting the weights assigned, this rerank strategy determines whether to prioritize semantic or keyword matching.</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 2, flex: 1, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <FormControlLabel control={<Radio checked={hybridStrategy === 'rerank'} onChange={() => setHybridStrategy('rerank')} />} label="Rerank Model" />
                      <Typography variant="body2" color="text.secondary">Rerank model will reorder the candidate document list based on the semantic match with user query, improving the results of semantic ranking</Typography>
                    </Paper>
                  </Stack>
                  <Select size="small" value={rerankModel} onChange={e => setRerankModel(e.target.value)} sx={{ mt: 2 }}>
                    <MenuItem value="qte-rerank">qte-rerank</MenuItem>
                  </Select>
                  <Stack direction="row" spacing={4} alignItems="center" sx={{ mt: 2 }}>
                    <Box>
                      <Typography variant="caption">Top K</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Select size="small" value={topK} onChange={e => setTopK(Number(e.target.value))}>
                          {[1,2,3,4,5].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                        </Select>
                        <Slider value={topK} onChange={(_, v) => setTopK(v as number)} min={1} max={10} sx={{ width: 220 }} />
                      </Stack>
                    </Box>
                    <Box>
                      <FormControlLabel control={<Switch checked={scoreEnabled} onChange={(_, v) => setScoreEnabled(v)} />} label="Score Threshold" />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField size="small" value={score} sx={{ width: 80 }} disabled={!scoreEnabled} />
                        <Slider value={score} onChange={(_, v) => setScore(v as number)} min={0} max={1} step={0.01} disabled={!scoreEnabled} sx={{ width: 220 }} />
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              )}
            </Paper>

            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button variant="outlined" onClick={() => navigate('/manage/kb/upload', { state: { files } })} startIcon={<ArrowBackIcon />}>
                Previous step
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button variant="contained" onClick={handleSaveAndProcess}>Save & Process</Button>
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
              <Typography variant="subtitle2" fontWeight={600}>PREVIEW</Typography>
              <Select size="small" value={files[0] ?? ''} sx={{ minWidth: 200 }}>
                {files.map(f => {
                  const fileName = f.includes('/') ? f.split('/').pop() : f
                  return <MenuItem key={f} value={f}>{fileName}</MenuItem>
                })}
              </Select>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              {showPreview ? `${chunks.length} ESTIMATED CHUNKS` : `${files.length} preprocess documents`}
            </Typography>
            
            {showPreview ? (
              <Stack spacing={1.5} sx={{ maxHeight: 600, overflow: 'auto' }}>
                {currentChunks.map((chunk, index) => (
                  <Paper key={chunk.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">{chunk.id} · {chunk.characters} characters</Typography>
                      <Box sx={{ flex: 1 }} />
                      <Button size="small" onClick={() => handleEditChunk(chunk.id)}>Edit</Button>
                      <Button size="small" color="error" onClick={() => handleDeleteChunk(chunk.id)}>Delete</Button>
                    </Stack>
                    {editingChunk === chunk.id ? (
                      <Stack spacing={1}>
                        <TextField
                          multiline
                          rows={3}
                          value={newChunkContent}
                          onChange={e => setNewChunkContent(e.target.value)}
                          size="small"
                          fullWidth
                        />
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="contained" onClick={handleSaveChunk}>Save</Button>
                          <Button size="small" onClick={() => setEditingChunk(null)}>Cancel</Button>
                        </Stack>
                      </Stack>
                    ) : (
                      renderChunkWithOverlap(chunk, startIndex + index)
                    )}
                  </Paper>
                ))}
                
                {/* Add new chunk */}
                <Paper variant="outlined" sx={{ p: 1.5, borderStyle: 'dashed' }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Add New Chunk</Typography>
                  <TextField
                    multiline
                    rows={3}
                    placeholder="Enter chunk content..."
                    value={newChunkContent}
                    onChange={e => setNewChunkContent(e.target.value)}
                    size="small"
                    fullWidth
                    sx={{ mb: 1 }}
                  />
                  <Button size="small" variant="contained" onClick={handleAddChunk} disabled={!newChunkContent.trim()}>
                    Add Chunk
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
                      Previous
                    </Button>
                    <Typography variant="body2">
                      Page {currentPage} of {totalPages}
                    </Typography>
                    <Button 
                      size="small" 
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                    >
                      Next
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
                  Click the 'Preview Chunk' button on the left to load the preview
                </Box>
              </Stack>
            )}
          </Paper>
        </Box>
      </Stack>
      </Box>
    </Box>
  )
}


