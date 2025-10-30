import { useEffect, useMemo, useState, useRef } from 'react'
import {
  Box,
  Button,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
  TextField,
  Chip,
  Alert,
  AlertTitle,
} from '@mui/material'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Autocomplete from '@mui/material/Autocomplete'
import type { SelectChangeEvent } from '@mui/material/Select'
import { useNavigate } from 'react-router-dom'
import Settings from '@mui/icons-material/Settings'
import CircleIcon from '@mui/icons-material/Circle'
import WarningIcon from '@mui/icons-material/Warning'

type ChatMessage = { role: 'assistant' | 'user'; content: string }
type LLMModel = { id: string; provider: string; label: string; tags?: string[]; isManagement?: boolean }

function App() {
  const navigate = useNavigate()
  const [kb, setKb] = useState(() => localStorage.getItem('xenera.kb') || '请选择知识库')
  const [llm, setLlm] = useState(() => localStorage.getItem('xenera.llm') || '请选择LLM')
  const [chunk, setChunk] = useState(() => localStorage.getItem('xenera.chunk') || '检索分块数量')
  const [llmOptions, setLlmOptions] = useState<LLMModel[]>([])
  const [selectedLlm, setSelectedLlm] = useState<LLMModel | null>(null)
  const [highlightedLlm, setHighlightedLlm] = useState<LLMModel | null>(null)
  const [knowledgeBases, setKnowledgeBases] = useState<Array<{ id: number; name: string; display_name: string; has_tags: boolean; tag_count: number }>>([])
  const [selectedKb, setSelectedKb] = useState<{ id: number; display_name: string } | null>(null)
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null) // null: checking, true: connected, false: disconnected
  const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000'
  const KB_KEY = 'xenera.kb'
  const LLM_KEY = 'xenera.llm'
  const CHUNK_KEY = 'xenera.chunk'

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '你好，我是 AI 助手，有什么可以帮你？' },
  ])
  const [compose, setCompose] = useState('')

  const [logs, setLogs] = useState<string[]>([])
  const renderLogs = useMemo(() => {
    const label = 'RAG提示词内容:'
    return logs.map((t, i) => {
      // 如果是分块汇总日志（多行，且每行以"- 分块"开头），不要在前面添加序号，并逐行渲染
      if (t.includes('\n') && t.split('\n').every(line => line.trim().startsWith('- 分块'))) {
        const lines = t.split('\n')
        return (
          <div key={i} style={{ marginBottom: 6, lineHeight: 1.6 }}>
            {lines.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </div>
        )
      }
      const idx = t.indexOf(label)
      if (idx >= 0) {
        const before = t.slice(0, idx)
        const content = t.slice(idx + label.length)
        return (
          <div key={i} style={{ marginBottom: 6, lineHeight: 1.6 }}>
            <span>{`${i + 1}. ${before}${label} `}</span>
            <span style={{ backgroundColor: '#e6f4ff', padding: '2px 4px', borderRadius: 4, display: 'inline-block', whiteSpace: 'pre-wrap' }}>
              {content}
            </span>
          </div>
        )
      }
      return (
        <div key={i} style={{ marginBottom: 6, lineHeight: 1.6 }}>
          {`${i + 1}. ${t}`}
        </div>
      )
    })
  }, [logs])
  
  // Refs for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  
  // Auto-scroll functions
  const scrollToBottom = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth' })
    }
  }
  
  const scrollToBottomMessages = () => scrollToBottom(messagesEndRef)
  const scrollToBottomLogs = () => scrollToBottom(logsEndRef)
  
  // Check backend connection
  const checkBackendConnection = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/llm/models/?enabled=true&model_type=LLM`, {
        method: 'GET',
        timeout: 5000, // 5 second timeout
      } as any)
      setBackendConnected(response.ok)
    } catch (error) {
      console.error('Backend connection failed:', error)
      setBackendConnected(false)
    }
  }
  
  // Auto-scroll when messages change
  useEffect(() => {
    // Small delay to ensure DOM is updated
    const timer = setTimeout(() => {
      scrollToBottomMessages()
    }, 100)
    return () => clearTimeout(timer)
  }, [messages])
  
  // Auto-scroll when logs change
  useEffect(() => {
    // Small delay to ensure DOM is updated
    const timer = setTimeout(() => {
      scrollToBottomLogs()
    }, 100)
    return () => clearTimeout(timer)
  }, [logs])
  
  // Initial backend connection check
  useEffect(() => {
    checkBackendConnection()
  }, [])

  useEffect(() => {
    const loadLlmModels = async () => {
      try {
        setBackendConnected(null) // Set to checking state
        const res = await fetch(`${API_BASE}/api/llm/models/?enabled=true&model_type=LLM`)
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }
        
        const data = await res.json()
        const models = data.results || data
        const groupedModels = models.map((model: any) => ({
          id: model.id.toString(),
          provider: model.provider,
          label: model.model_name,
          tags: ['LLM']
        }))
        
        // Add management option
        const hasModels = groupedModels.length > 0
        const managementOption = {
          id: 'manage-llm',
          provider: hasModels ? '' : 'No LLM Models Configured',
          label: '管理 LLM',
          tags: ['MANAGEMENT'],
          isManagement: true
        }

        // When there are models, append Manage LLM at the end without the warning group header
        setLlmOptions(hasModels ? [...groupedModels, managementOption] : [managementOption])
        setBackendConnected(true) // Set to connected state
        
        // Set default selection if there's a saved LLM
        if (llm !== '请选择LLM' && hasModels) {
          const savedModel = groupedModels.find(m => m.label === llm)
          if (savedModel) {
            setSelectedLlm(savedModel)
          }
        }
        
        // Set default knowledge base selection if there's a saved KB
        if (kb !== '请选择知识库') {
          // This will be handled in the knowledge bases loading effect
        }
        
        // Add warning for potentially problematic models
        const problematicModels = ['gpt-5', 'gpt-5-mini']
        const hasProblematicModels = groupedModels.some(m => problematicModels.includes(m.label))
        if (hasProblematicModels) {
          console.warn('检测到可能不存在的模型：', problematicModels.filter(m => groupedModels.some(gm => gm.label === m)))
        }
      } catch (error) {
        console.error('Failed to load LLM models:', error)
        setBackendConnected(false) // Set to disconnected state
        setLlmOptions([]) // Clear options when backend is down
      }
    }
    loadLlmModels()
  }, [llm])

  useEffect(() => {
    const loadKnowledgeBases = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/kb/get-knowledge-bases-dropdown/`)
        if (res.ok) {
          const data = await res.json()
          setKnowledgeBases(data.knowledge_bases || [])
          
          // Set default selection if there's a saved KB
          if (kb !== '请选择知识库') {
            const savedKb = (data.knowledge_bases || []).find((kbItem: any) => kbItem.display_name === kb)
            if (savedKb) {
              setSelectedKb({ id: savedKb.id, display_name: savedKb.display_name })
            }
          }
        } else {
          console.error('Failed to load knowledge bases:', res.status)
          setKnowledgeBases([])
          if (backendConnected === null) {
            setBackendConnected(false)
          }
        }
      } catch (error) {
        console.error('Error loading knowledge bases:', error)
        setKnowledgeBases([])
        if (backendConnected === null) {
          setBackendConnected(false)
        }
      }
    }
    loadKnowledgeBases()
  }, [kb, backendConnected])

  // Persist selections to localStorage
  useEffect(() => { 
    if (selectedKb) {
      localStorage.setItem(KB_KEY, selectedKb.display_name)
    }
  }, [selectedKb])
  useEffect(() => { 
    if (selectedLlm && !selectedLlm.isManagement) {
      localStorage.setItem(LLM_KEY, selectedLlm.label)
    }
  }, [selectedLlm])
  useEffect(() => { localStorage.setItem(CHUNK_KEY, chunk) }, [chunk])

  const onSend = async () => {
    const text = compose.trim()
    if (!text) return

    // Check if LLM is selected
    if (!selectedLlm || selectedLlm.isManagement) {
      const now = new Date().toLocaleString()
      setMessages(prev => [...prev, { role: 'user', content: text }])
      setCompose('')

      setLogs(prev => [
        ...prev,
        `执行逻辑（${now}）：`,
        `用户选择了知识库：${selectedKb?.display_name || '未选择'}`,
        `用户选择了LLM：${selectedLlm?.label || '未选择'}`,
        `检索分块数量：${chunk}`,
        `用户问题：${text}`,
      ])

      // Show error message from assistant
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: '请选择LLM' },
        ])
        setLogs(prev => [...prev, '机器人提示：请选择LLM'])
      }, 300)
      return
    }

    const now = new Date().toLocaleString()
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setCompose('')

    // Clear previous logs and add new ones
    setLogs([
      `执行逻辑（${now}）：`,
      `用户选择了知识库：${selectedKb?.display_name || '未选择'}`,
      `用户选择了LLM：${selectedLlm?.label || '未选择'}`,
      `检索分块数量：${chunk}`,
      `用户问题：${text}`,
    ])

    try {
      // Prepare request data
      const requestData = {
        message: text,
        llm_model_name: selectedLlm?.label || '',
        knowledge_base_id: selectedKb?.id || null,
        chunk_count: chunk !== '检索分块数量' ? parseInt(chunk) : 3,
        max_tokens: 500
      }

      // Call chat API
      const response = await fetch(`${API_BASE}/api/agents/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'API调用失败')
      }

      const data = await response.json()
      
      // Add response to messages
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.response }
      ])

      // Update logs with detailed execution steps
      setLogs(prev => [
        ...prev,
        ...data.logs
      ])

    } catch (error) {
      console.error('Chat API error:', error)
      
      // Show error message with better formatting
      const errorMessage = error.message || '未知错误'
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `❌ ${errorMessage}` }
      ])

      setLogs(prev => [
        ...prev,
        `❌ API调用失败：${errorMessage}`
      ])
    }
  }

  const selectSx = { minWidth: 160 }

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3, textAlign: 'center', fontWeight: 600, color: 'primary.main' }}>
        Xenera RAG Tool
      </Typography>
      
      {/* Backend Connection Status Alert */}
      {backendConnected === false && (
        <Alert 
          severity="error" 
          icon={<WarningIcon />}
          sx={{ mb: 3 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={checkBackendConnection}
            >
              重试连接
            </Button>
          }
        >
          <AlertTitle>后端服务连接失败</AlertTitle>
          无法连接到后端服务 (http://localhost:8000)。请确保后端服务器正在运行。
          <br />
          <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
            解决方案：在终端中运行 <code>cd rag-backend && python manage.py runserver</code>
          </Typography>
        </Alert>
      )}
      
      {backendConnected === null && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <AlertTitle>正在连接后端服务...</AlertTitle>
          正在检查后端服务连接状态，请稍候。
        </Alert>
      )}
      
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Select 
          size="small" 
          value={selectedKb?.id || ''} 
          displayEmpty
          onChange={(e: SelectChangeEvent) => {
            const v = e.target.value
            if (v === 'manage-kb') { navigate('/manage/kb'); return }
            if (v === '') {
              setSelectedKb(null)
              return
            }
            const kbId = parseInt(v as string)
            const kbItem = knowledgeBases.find(kb => kb.id === kbId)
            if (kbItem) {
              setSelectedKb({ id: kbItem.id, display_name: kbItem.display_name })
            }
          }} 
          sx={selectSx}
        >
          <MenuItem value="">请选择知识库</MenuItem>
          {knowledgeBases.map(kbItem => (
            <MenuItem key={kbItem.id} value={kbItem.id}>
              {kbItem.display_name}
            </MenuItem>
          ))}
          <MenuItem value="manage-kb">
            <Stack direction="row" spacing={1} alignItems="center">
              <Settings fontSize="small" sx={{ color: 'primary.main' }} />
              <Typography color="primary.main">管理知识库</Typography>
              <Typography variant="caption" color="primary.main">
                →
              </Typography>
            </Stack>
          </MenuItem>
        </Select>
        <Autocomplete
          size="small"
          sx={{ minWidth: 200 }}
          options={llmOptions}
          groupBy={(option) => option.provider}
          getOptionLabel={(option) => option.label}
          value={selectedLlm}
          onChange={(_, newValue) => {
            if (newValue && newValue.isManagement) {
              navigate('/manage/llm')
            } else {
              setSelectedLlm(newValue)
            }
          }}
          onHighlightChange={(_, newValue) => setHighlightedLlm(newValue)}
          renderInput={(params) => (
            <TextField 
              {...params} 
              placeholder="请选择LLM" 
              size="small"
            />
          )}
          renderOption={(props, option) => {
            const isProblematic = ['gpt-5', 'gpt-5-mini'].includes(option.label)
            return (
              <li {...props} key={option.id} style={{ position: 'relative' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography 
                    color={option.isManagement ? 'primary.main' : isProblematic ? 'warning.main' : 'inherit'}
                    sx={{ opacity: isProblematic ? 0.7 : 1 }}
                  >
                    {option.label}
                  </Typography>
                  {isProblematic && (
                    <Typography variant="caption" color="warning.main" sx={{ fontSize: '0.7rem' }}>
                      ⚠️
                    </Typography>
                  )}
                  {option.isManagement && (
                    <Typography variant="caption" color="primary.main">
                      →
                    </Typography>
                  )}
                </Stack>
                {highlightedLlm?.id === option.id && !option.isManagement && (
                  <Paper elevation={3} style={{ position: 'absolute', left: 'calc(100% + 8px)', top: 0, width: 240, padding: 12 }}>
                    <Typography fontWeight={600}>{option.label}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                      {(option.tags ?? ['LLM']).map(t => <Chip key={t} size="small" label={t} />)}
                    </Stack>
                    {isProblematic && (
                      <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
                        ⚠️ 此模型可能不存在于API中
                      </Typography>
                    )}
                  </Paper>
                )}
              </li>
            )
          }}
        />
        <Select size="small" value={chunk} onChange={(e: SelectChangeEvent) => setChunk(e.target.value)} sx={selectSx}>
          <MenuItem value="检索分块数量">检索分块数量</MenuItem>
          <MenuItem value="2">2</MenuItem>
          <MenuItem value="3">3</MenuItem>
          <MenuItem value="4">4</MenuItem>
          <MenuItem value="5">5</MenuItem>
          <MenuItem value="6">6</MenuItem>
          <MenuItem value="7">7</MenuItem>
          <MenuItem value="8">8</MenuItem>
        </Select>
      </Stack>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
        <Box sx={{ width: { xs: '100%', md: '66.666%' } }}>
          <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
            <Typography variant="subtitle2">聊天</Typography>
            <Divider />
            <Box sx={{ flex: 1, minHeight: 360, maxHeight: '60vh', overflow: 'auto', pr: 1 }}>
              <Stack spacing={1}>
                {messages.map((m, idx) => (
                  <Box key={idx} sx={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <Paper
                      variant="outlined"
                      sx={{
                        px: 1.5,
                        py: 1,
                        maxWidth: '75%',
                        bgcolor: m.role === 'user' ? 'primary.main' : 'background.paper',
                        color: m.role === 'user' ? 'primary.contrastText' : 'text.primary',
                      }}
                    >
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>{m.role === 'user' ? '用户' : '机器人'}</Typography>
                      <Typography variant="body2">{m.content}</Typography>
                    </Paper>
                  </Box>
                ))}
                {/* Invisible element to scroll to */}
                <div ref={messagesEndRef} />
              </Stack>
            </Box>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <TextField
                fullWidth
                multiline
                minRows={2}
                placeholder="请输入文本"
                value={compose}
                onChange={e => setCompose(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
              />
              <Button variant="contained" onClick={onSend} sx={{ minWidth: 88 }}>发送</Button>
            </Stack>
          </Paper>
        </Box>

        <Box sx={{ width: { xs: '100%', md: '33.333%' } }}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%', minHeight: 360, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle1" fontWeight={600}>执行日志：</Typography>
            <Box sx={{ mt: 1, flex: 1, maxHeight: '60vh', overflowY: 'auto', overflowX: 'hidden', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 13 }}>
              {logs.length ? renderLogs : '（空）'}
              {/* Invisible element to scroll to */}
              <div ref={logsEndRef} />
            </Box>
          </Paper>
        </Box>
      </Box>
    </Container>
  )
}

export default App
