import { useMemo, useState, useEffect } from 'react'
import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import FolderIcon from '@mui/icons-material/Folder'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useNavigate } from 'react-router-dom'

type KnowledgeBase = {
  id: number
  name: string
  description: string
  document_count: number
  chunking_mode: string
  retrieval_mode: string
  index_method: string
  embedding_model?: string
  created_at: string
  updated_at: string
  created_by?: string
}

type KbForm = {
  id?: string
  name: string
  type: string
  authName: string
  baseUrl: string
  contextSize: string
}

export default function ManageKB() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [kbs, setKbs] = useState<KnowledgeBase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<KbForm>({ name: '', type: '', authName: '', baseUrl: '', contextSize: '4096' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch knowledge bases from API
  useEffect(() => {
    const fetchKnowledgeBases = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch('http://localhost:8000/api/kb/get-knowledge-bases/')
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        setKbs(data.knowledge_bases || [])
      } catch (err) {
        console.error('Error fetching knowledge bases:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch knowledge bases')
      } finally {
        setLoading(false)
      }
    }

    fetchKnowledgeBases()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return kbs
    return kbs.filter(k => 
      k.name.toLowerCase().includes(q) || 
      k.description.toLowerCase().includes(q) ||
      k.chunking_mode.toLowerCase().includes(q) ||
      k.retrieval_mode.toLowerCase().includes(q)
    )
  }, [kbs, query])

  // toggling moved out of current UI (cards are read-only in this view)

  // const openAdd = () => {
  //   setForm({ name: '', type: '', authName: '', baseUrl: '', contextSize: '4096' })
  //   setErrors({})
  //   setDialogOpen(true)
  // }

  // config dialog entry hidden in this simplified card UI for now

  const validate = (v: KbForm) => {
    const es: Record<string, string> = {}
    if (!v.name.trim()) es.name = '必填'
    if (!v.type.trim()) es.type = '必选'
    if (!v.baseUrl.trim()) es.baseUrl = '必填'
    if (!v.contextSize.trim() || isNaN(Number(v.contextSize))) es.contextSize = '请输入数字'
    return es
  }

  const onSubmit = () => {
    const es = validate(form)
    setErrors(es)
    if (Object.keys(es).length > 0) return
    if (form.id) {
      setKbs(prev => prev.map(k => (k.id === form.id ? { ...k, name: form.name, tags: [form.type, ...k.tags.filter(t => t !== form.type)] } : k)))
    } else {
      const id = `kb_${Date.now()}`
      setKbs(prev => [
        ...prev,
        { id, name: form.name, tags: [form.type], enabled: true, itemsLabel: '0 篇文档' },
      ])
    }
    setDialogOpen(false)
  }

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', py: 1, display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ maxWidth: 'lg', width: '100%', px: 2 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3, textAlign: 'center', fontWeight: 600, color: 'primary.main' }}>
          Xenera RAG Tool
        </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => location.assign('/manage/kb/upload')}>Create Knowledge</Button>
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 9 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6">Knowledge</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField size="small" placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
              <Button variant="outlined" onClick={() => navigate('/')} startIcon={<ArrowBackIcon />}>
                返回主页面
              </Button>
            </Stack>
          </Stack>

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {!loading && !error && (
            <Grid container spacing={2}>
              {filtered.map(kb => (
                <Grid key={kb.id} size={{ xs: 12, sm: 6, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 40, height: 40, bgcolor: 'action.hover', color: 'text.primary', borderRadius: 2, display: 'grid', placeItems: 'center' }}>
                        <FolderIcon />
                      </Box>
                      <Box>
                        <Typography fontWeight={700}>{kb.name}</Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                          <Chip size="small" label={kb.chunking_mode} variant="outlined" />
                          <Chip size="small" label={`${kb.index_method} · ${kb.retrieval_mode}`} variant="outlined" />
                        </Stack>
                      </Box>
                    </Stack>

                    <Typography variant="body2" sx={{ mt: 1.5 }}>
                      {kb.description || `Useful for when you want to answer queries about ${kb.name}`}
                    </Typography>

                    <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">📄 {kb.document_count}</Typography>
                      <Typography variant="caption" color="text.secondary">⭐ 0</Typography>
                      <Typography variant="caption" color="text.secondary">Updated {new Date(kb.updated_at).toLocaleDateString()}</Typography>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}

          {!loading && !error && filtered.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                {kbs.length === 0 ? 'No knowledge bases found. Create your first knowledge base!' : 'No knowledge bases match your search.'}
              </Typography>
            </Box>
          )}
        </Grid>
      </Grid>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{form.id ? '配置知识库' : '新增知识库'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              required
              label="知识库名称"
              placeholder="请输入知识库名称"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              error={Boolean(errors.name)}
              helperText={errors.name}
            />
            <TextField
              required
              select
              label="知识库类型"
              placeholder="请选择"
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
              error={Boolean(errors.type)}
              helperText={errors.type}
              SelectProps={{ native: true }}
            >
              <option value=""></option>
              <option value="文档">文档</option>
              <option value="网页">网页</option>
              <option value="数据库">数据库</option>
            </TextField>

            <Divider textAlign="left">凭证</Divider>
            <TextField
              label="Authorization Name"
              placeholder="请输入"
              value={form.authName}
              onChange={e => setForm({ ...form, authName: e.target.value })}
            />
            <TextField
              required
              label="Base URL"
              placeholder="例如：http://127.0.0.1:8000"
              value={form.baseUrl}
              onChange={e => setForm({ ...form, baseUrl: e.target.value })}
              error={Boolean(errors.baseUrl)}
              helperText={errors.baseUrl}
            />
            <TextField
              required
              label="上下文大小"
              placeholder="4096"
              value={form.contextSize}
              onChange={e => setForm({ ...form, contextSize: e.target.value })}
              error={Boolean(errors.contextSize)}
              helperText={errors.contextSize}
            />

            <Button size="small" variant="text" sx={{ alignSelf: 'flex-start' }} href="#" target="_blank">如何集成知识库</Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={onSubmit}>{form.id ? '保存' : '新增'}</Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  )
}


