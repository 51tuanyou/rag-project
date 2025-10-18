import { useMemo, useState } from 'react'
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
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import FolderIcon from '@mui/icons-material/Folder'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useNavigate } from 'react-router-dom'

type KnowledgeBase = {
  id: string
  name: string
  tags: string[]
  enabled: boolean
  itemsLabel?: string
}

type KbForm = {
  id?: string
  name: string
  type: string
  authName: string
  baseUrl: string
  contextSize: string
}

const initialKBs: KnowledgeBase[] = [
  { id: 'kb1', name: '产品库', tags: ['文档', 'PDF', 'FAQ'], enabled: true, itemsLabel: '56 篇文档' },
  { id: 'kb2', name: '用户手册', tags: ['文档', '网页'], enabled: true },
  { id: 'kb3', name: 'FAQ', tags: ['FAQ'], enabled: false },
]

export default function ManageKB() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [kbs, setKbs] = useState<KnowledgeBase[]>(initialKBs)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<KbForm>({ name: '', type: '', authName: '', baseUrl: '', contextSize: '4096' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return kbs
    return kbs.filter(k => k.name.toLowerCase().includes(q) || k.tags.some(t => t.toLowerCase().includes(q)))
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
                        <Chip size="small" label="GENERAL" variant="outlined" />
                        <Chip size="small" label="HQ · VECTOR" variant="outlined" />
                      </Stack>
                    </Box>
                  </Stack>

                  <Typography variant="body2" sx={{ mt: 1.5 }}>
                    useful for when you want to answer queries about the {kb.name}
                  </Typography>

                  <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">📄 1</Typography>
                    <Typography variant="caption" color="text.secondary">⭐ 0</Typography>
                    <Typography variant="caption" color="text.secondary">Updated 23 days ago</Typography>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
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


