import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
  TextField,
} from '@mui/material'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import type { SelectChangeEvent } from '@mui/material/Select'
import { useNavigate } from 'react-router-dom'
import Settings from '@mui/icons-material/Settings'
import CircleIcon from '@mui/icons-material/Circle'

type ChatMessage = { role: 'assistant' | 'user'; content: string }

function App() {
  const navigate = useNavigate()
  const [kb, setKb] = useState(() => localStorage.getItem('xenera.kb') || '请选择知识库')
  const [llm, setLlm] = useState(() => localStorage.getItem('xenera.llm') || '请选择LLM')
  const [chunk, setChunk] = useState(() => localStorage.getItem('xenera.chunk') || '检索分块数量')
  const [providers, setProviders] = useState<Array<{ id: string; name: string }>>([])
  const [knowledgeBases, setKnowledgeBases] = useState<Array<{ id: number; name: string; display_name: string; has_tags: boolean; tag_count: number }>>([])
  const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000'
  const KB_KEY = 'xenera.kb'
  const LLM_KEY = 'xenera.llm'
  const CHUNK_KEY = 'xenera.chunk'

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '你好，我是 AI 助手，有什么可以帮你？' },
  ])
  const [compose, setCompose] = useState('')

  const [logs, setLogs] = useState<string[]>([])
  const logText = useMemo(() => logs.map((t, i) => `${i + 1}. ${t}`).join('\n'), [logs])

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/llm/providers/`)
        const data = await res.json()
        setProviders((data || []).map((p: any) => ({ id: p.id, name: p.name })))
      } catch {}
    }
    loadProviders()
  }, [])

  useEffect(() => {
    const loadKnowledgeBases = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/kb/get-knowledge-bases-dropdown/`)
        if (res.ok) {
          const data = await res.json()
          setKnowledgeBases(data.knowledge_bases || [])
        } else {
          console.error('Failed to load knowledge bases:', res.status)
          setKnowledgeBases([])
        }
      } catch (error) {
        console.error('Error loading knowledge bases:', error)
        setKnowledgeBases([])
      }
    }
    loadKnowledgeBases()
  }, [])

  // Persist selections to localStorage
  useEffect(() => { localStorage.setItem(KB_KEY, kb) }, [kb])
  useEffect(() => { localStorage.setItem(LLM_KEY, llm) }, [llm])
  useEffect(() => { localStorage.setItem(CHUNK_KEY, chunk) }, [chunk])

  const onSend = () => {
    const text = compose.trim()
    if (!text) return

    const now = new Date().toLocaleString()
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setCompose('')

    setLogs(prev => [
      ...prev,
      `执行逻辑（${now}）：`,
      `用户选择了知识库：${kb}`,
      `用户选择了LLM：${llm}`,
      `检索分块数量：${chunk}`,
      `用户问题：${text}`,
    ])

    // mock assistant reply
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `已收到：${text}` },
      ])
      setLogs(prev => [...prev, '机器人已返回回答'])
    }, 300)
  }

  const selectSx = { minWidth: 160 }

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3, textAlign: 'center', fontWeight: 600, color: 'primary.main' }}>
        Xenera RAG Tool
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Select 
          size="small" 
          value={kb} 
          displayEmpty
          onChange={(e: SelectChangeEvent) => {
            const v = e.target.value
            if (v === '管理知识库') { navigate('/manage/kb'); return }
            setKb(v)
          }} 
          sx={selectSx}
        >
          <MenuItem value="请选择知识库">请选择知识库</MenuItem>
          {knowledgeBases.map(kbItem => (
            <MenuItem key={kbItem.id} value={kbItem.display_name}>
              {kbItem.display_name}
            </MenuItem>
          ))}
          <MenuItem value="管理知识库">
            <Stack direction="row" spacing={1} alignItems="center">
              <Settings fontSize="small" sx={{ color: 'primary.main' }} />
              <Typography color="primary.main">管理知识库</Typography>
              <Typography variant="caption" color="primary.main">
                →
              </Typography>
            </Stack>
          </MenuItem>
        </Select>
        <Select size="small" value={llm} onChange={(e: SelectChangeEvent) => {
          const v = e.target.value
          if (v === '管理 LLM') { navigate('/manage/llm'); return }
          setLlm(v)
        }} sx={selectSx}>
          <MenuItem value="请选择LLM">请选择LLM</MenuItem>
          {providers.map(p => (
            <MenuItem key={p.id} value={p.name}>{p.name}</MenuItem>
          ))}
          <MenuItem value="管理 LLM">
            <Stack direction="row" spacing={1} alignItems="center">
              <Settings fontSize="small" sx={{ color: 'primary.main' }} />
              <Typography color="primary.main">管理 LLM</Typography>
              <Typography variant="caption" color="primary.main">
                →
              </Typography>
            </Stack>
          </MenuItem>
        </Select>
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
            <Box component="pre" sx={{ mt: 1, whiteSpace: 'pre-wrap', flex: 1, overflow: 'auto' }}>{logText || '（空）'}</Box>
          </Paper>
        </Box>
      </Box>
    </Container>
  )
}

export default App
