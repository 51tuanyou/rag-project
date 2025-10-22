import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Grid,
  Card,
  CardContent,
  Divider,
  Tooltip,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SearchIcon from '@mui/icons-material/Search'
import GridViewIcon from '@mui/icons-material/GridView'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import DescriptionIcon from '@mui/icons-material/Description'
import { useNavigate, useParams } from 'react-router-dom'

interface RetrievedChunk {
  id: string
  content: string
  score: number
  source_document: string
  character_count: number
}

interface TestRecord {
  id: string
  source: string
  text: string
  time: string
}

export default function RetrievalTest() {
  const navigate = useNavigate()
  const { kbId } = useParams<{ kbId: string }>()
  const [sourceText, setSourceText] = useState('')
  const [retrievedChunks, setRetrievedChunks] = useState<RetrievedChunk[]>([])
  const [testRecords, setTestRecords] = useState<TestRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [knowledgeBaseName, setKnowledgeBaseName] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  const API_BASE = (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || 'http://localhost:8000'

  // Fetch knowledge base name and test records
  useEffect(() => {
    const fetchKBName = async () => {
      if (!kbId) return
      
      try {
        const response = await fetch(`${API_BASE}/api/kb/get-documents/?kb_id=${kbId}`)
        if (response.ok) {
          const data = await response.json()
          setKnowledgeBaseName(data.documents?.[0]?.knowledge_base_name || '')
        }
      } catch (error) {
        console.error('Error fetching KB name:', error)
      }
    }
    
    const fetchTestRecords = async () => {
      if (!kbId) return
      
      try {
        const response = await fetch(`${API_BASE}/api/kb/get-retrieval-test-records/${kbId}/`)
        if (response.ok) {
          const data = await response.json()
          const records: TestRecord[] = data.records.map((record: any) => ({
            id: record.id.toString(),
            source: 'Retrieval Test',
            text: record.query_text,
            time: record.created_at
          }))
          setTestRecords(records)
        }
      } catch (error) {
        console.error('Error fetching test records:', error)
      }
    }
    
    fetchKBName()
    fetchTestRecords()
  }, [kbId, API_BASE])

  // Perform retrieval test with backend API
  const handleTest = async () => {
    if (!sourceText.trim()) return
    
    setLoading(true)
    setError(null) // Clear any previous errors
    
    try {
      const response = await fetch(`${API_BASE}/api/kb/perform-retrieval-test/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query_text: sourceText,
          knowledge_base_id: kbId,
          top_k: 3
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Failed to perform retrieval test'
        const errorType = errorData.error_type || 'unknown'
        
        // Create a more specific error object
        const error = new Error(errorMessage)
        ;(error as any).errorType = errorType
        throw error
      }
      
      const data = await response.json()
      
      // Update retrieved chunks (sort by similarity score descending)
      const chunks: RetrievedChunk[] = data.results
        .map((result: any) => ({
          id: result.id,
          content: result.content,
          score: result.score,
          source_document: result.source_document,
          character_count: result.character_count
        }))
        .sort((a, b) => b.score - a.score) // Sort by similarity score descending
      
      setRetrievedChunks(chunks)
      
      // Add to test records
      const newRecord: TestRecord = {
        id: data.test_record_id.toString(),
        source: 'Retrieval Test',
        text: sourceText,
        time: new Date().toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
      }
      
      setTestRecords(prev => [newRecord, ...prev])
      
    } catch (error) {
      console.error('Error performing retrieval test:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      const errorType = (error as any)?.errorType || 'unknown'
      
      // Check if it's an embedding service error
      if (errorType === 'embedding_service_error' || 
          errorMessage.includes('Failed to create embeddings') || 
          errorMessage.includes('Embedding service unavailable') ||
          errorMessage.includes('API configuration') ||
          errorMessage.includes('network connection')) {
        setError('⚠️ Embedding service is unavailable. Please check your API configuration and network connection.')
      } else if (errorType === 'retrieval_error') {
        setError(`🔍 Retrieval test failed: ${errorMessage}`)
      } else {
        setError(`❌ Error: ${errorMessage}`)
      }
    } finally {
      setLoading(false)
    }
  }

  // Handle clicking on a test record to show its results
  const handleRecordClick = async (recordId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/kb/get-retrieval-test-results/${recordId}/`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch test results')
      }
      
      const data = await response.json()
      
      // Update retrieved chunks with the historical results (sort by similarity score descending)
      const chunks: RetrievedChunk[] = data.results
        .map((result: any) => ({
          id: result.id,
          content: result.content,
          score: result.score,
          source_document: result.source_document,
          character_count: result.character_count
        }))
        .sort((a, b) => b.score - a.score) // Sort by similarity score descending
      
      setRetrievedChunks(chunks)
      
      // Update source text with the query from the record
      setSourceText(data.query_text)
      
    } catch (error) {
      console.error('Error fetching test results:', error)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return 'success'
    if (score >= 0.5) return 'warning'
    return 'error'
  }

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', py: 1, display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ maxWidth: 'lg', width: '100%', px: 2 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3, textAlign: 'center', fontWeight: 600, color: 'primary.main' }}>
          Xenera RAG Tool
        </Typography>
        
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6">
            Retrieval Test {knowledgeBaseName && `- ${knowledgeBaseName}`}
          </Typography>
          <Button variant="outlined" onClick={() => navigate(`/manage/kb/documents/${kbId}`)} startIcon={<ArrowBackIcon />}>
            返回管理知识库
          </Button>
        </Stack>

        <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
          Retrieval Test
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Test the hitting effect of the Knowledge based on the given query text.
        </Typography>

        <Box sx={{ display: 'flex', gap: 3, width: '100%' }}>
          {/* Left Column: Source Text + Records */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* SOURCE TEXT Panel */}
            <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', border: '1px solid #e0e0e0' }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                SOURCE TEXT
              </Typography>
              
              {/* Error Message */}
              {error && (
                <Box sx={{ 
                  mb: 2, 
                  p: 2, 
                  backgroundColor: '#ffebee', 
                  border: '1px solid #f44336', 
                  borderRadius: 1,
                  color: '#d32f2f'
                }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    ⚠️ {error}
                  </Typography>
                </Box>
              )}
              
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <TextField
                    multiline
                    rows={8}
                    value={sourceText}
                    onChange={(e) => {
                      if (e.target.value.length <= 2000) {
                        setSourceText(e.target.value)
                      }
                    }}
                    placeholder="Q: Python的多进程和多线程各适用于什么场景? A: 多进程:适合CPU密集型任务,可充分利用多核CPU,避免GIL限制 多线程:适合I/O密集型任务,线程间切换开销小,但受GIL限制"
                    variant="outlined"
                    fullWidth
                    error={sourceText.length > 2000}
                    helperText={sourceText.length > 2000 ? 'Text cannot exceed 2000 characters' : ''}
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        alignItems: 'flex-start'
                      }
                    }}
                  />
                
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {sourceText.length} / 2000
                  </Typography>
                  
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<GridViewIcon />}
                      endIcon={<SearchIcon />}
                      sx={{ textTransform: 'none' }}
                    >
                      VECTOR SEARCH
                    </Button>
                  </Stack>
                </Stack>
                
                  <Button
                    variant="contained"
                    onClick={handleTest}
                    disabled={!sourceText.trim() || loading || sourceText.length > 2000}
                    sx={{ mt: 2, alignSelf: 'flex-end', px: 3 }}
                  >
                    {loading ? 'Testing...' : 'Test'}
                  </Button>
              </Box>
            </Paper>

            {/* Records Table */}
            <Paper variant="outlined" sx={{ p: 2, border: '1px solid #e0e0e0' }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Records
              </Typography>
              
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>SOURCE</TableCell>
                      <TableCell>TEXT</TableCell>
                      <TableCell>TIME</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {testRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">
                            No test records yet. Run a test to see history.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      testRecords.map((record) => (
                        <TableRow 
                          key={record.id} 
                          hover 
                          onClick={() => handleRecordClick(record.id)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor: 'primary.main'
                                }}
                              />
                              <Typography variant="body2">{record.source}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Tooltip 
                              title={record.text}
                              placement="top"
                              arrow
                              enterDelay={500}
                              leaveDelay={200}
                            >
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  maxWidth: 300, 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  lineHeight: 1.4,
                                  maxHeight: '2.8em', // 2 lines * 1.4 line height
                                  cursor: 'help'
                                }}
                              >
                                {record.text}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {record.time}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>

          {/* Right Column: Retrieved Chunks */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Retrieved Chunks（{retrievedChunks.length}）
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, height: '600px', overflow: 'auto', border: '1px solid #e0e0e0' }}>
              
              {retrievedChunks.length === 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography color="text.secondary">
                    No chunks retrieved yet. Enter text and click Test to see results.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={2}>
                  {retrievedChunks.map((chunk, index) => (
                    <Card key={chunk.id} variant="outlined" sx={{ p: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          Chunk-{String(index + 1).padStart(2, '0')}
                        </Typography>
                        <Chip 
                          label={`SCORE ${chunk.score}`}
                          color={getScoreColor(chunk.score)}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </Stack>
                      
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        {chunk.character_count} characters
                      </Typography>
                      
                      <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.4 }}>
                        {chunk.content}
                      </Typography>
                      
                      <Divider sx={{ my: 1 }} />
                      
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <DescriptionIcon fontSize="small" color="action" />
                          <Typography variant="caption" color="text.secondary">
                            {chunk.source_document}
                          </Typography>
                        </Stack>
                        
                        <Button
                          size="small"
                          endIcon={<OpenInNewIcon />}
                          sx={{ textTransform: 'none' }}
                        >
                          OPEN
                        </Button>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              )}
            </Paper>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
