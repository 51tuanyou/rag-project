import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Container,
  Popover,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Tooltip,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import Settings from '@mui/icons-material/Settings'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CircleIcon from '@mui/icons-material/Circle'
// (replaced by named import Settings above)
import { useNavigate } from 'react-router-dom'
import DeleteOutline from '@mui/icons-material/DeleteOutline'

type Provider = {
  id: string
  name: string
  badges: string[]
  apiKeys: string[]
  selectedKey?: number
  enabled: boolean
  models?: { id: string | number; name: string; tags: string[]; enabled: boolean }[]
}

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000'

type AddModelForm = {
  providerId: string
  modelName: string
  modelType: string
  authName: string
  baseUrl: string
  contextSize: string
}

export default function ManageLLM() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [providers, setProviders] = useState<Provider[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<AddModelForm>({ providerId: 'ollama', modelName: '', modelType: '', authName: '', baseUrl: '', contextSize: '4096' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [keyMenuAnchor, setKeyMenuAnchor] = useState<null | HTMLElement>(null)
  const [keyMenuProvider, setKeyMenuProvider] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [credAnchor, setCredAnchor] = useState<null | HTMLElement>(null)
  const [credProvider, setCredProvider] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editForm, setEditForm] = useState({
    authName: 'API_KEY1',
    baseUrl: '',
    completionMode: 'Chat',
    contextSize: '4096',
    maxTokens: '4096',
    visionSupport: true,
    functionCallSupport: false,
  })
  const [addKeyOpen, setAddKeyOpen] = useState(false)
  const [addKeyProvider, setAddKeyProvider] = useState<string | null>(null)
  const [newKey, setNewKey] = useState({ apiKey: '', organization: '', apiBase: '' })
  const [setupKeyOpen, setSetupKeyOpen] = useState(false)
  const [setupProviderId, setSetupProviderId] = useState<string | null>(null)
  const [setupProviderName, setSetupProviderName] = useState<string>('')
  const [setupKeyName, setSetupKeyName] = useState<string>('')
  const [setupForm, setSetupForm] = useState({ apiKey: '', organization: '', apiBase: '' })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return providers
    return providers.filter(p => p.name.toLowerCase().includes(q) || p.badges.some(b => b.toLowerCase().includes(q)))
  }, [providers, query])

  const loadProviders = async () => {
    const res = await fetch(`${API_BASE}/api/llm/providers/`)
    const data = await res.json()
    setProviders(data as Provider[])
  }

  useEffect(() => {
    loadProviders()
  }, [])

  const toggleProvider = async (id: string, enabled: boolean) => {
    await fetch(`${API_BASE}/api/llm/providers/${id}/toggle/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    await loadProviders()
  }

  const toggleModel = async (_pid: string, mid: string | number, enabled: boolean) => {
    await fetch(`${API_BASE}/api/llm/models/${mid}/toggle/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    await loadProviders()
  }

  const openAddModel = (pid: string) => {
    setForm({ providerId: pid, modelName: '', modelType: '', authName: '', baseUrl: '', contextSize: '4096' })
    setErrors({})
    setDialogOpen(true)
  }

  const validate = (v: AddModelForm) => {
    const es: Record<string, string> = {}
    if (!v.modelName.trim()) es.modelName = '必填'
    if (!v.modelType.trim()) es.modelType = '必选'
    if (!v.baseUrl.trim()) es.baseUrl = '必填'
    if (!v.contextSize.trim() || isNaN(Number(v.contextSize))) es.contextSize = '请输入数字'
    return es
  }

  const submitModel = async () => {
    const es = validate(form)
    setErrors(es)
    if (Object.keys(es).length > 0) return
    await fetch(`${API_BASE}/api/llm/models/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: form.providerId,
        model_id: form.modelName,
        model_name: form.modelName,
        model_type: form.modelType,
        base_url: form.baseUrl,
        context_size: Number(form.contextSize),
      }),
    })
    await loadProviders()
    setDialogOpen(false)
  }

  const openKeyMenu = async (pid: string, el: HTMLElement) => {
    const prov = providers.find(p => p.id === pid)
    if (prov && prov.apiKeys.length === 0) {
      setAddKeyProvider(pid)
      setNewKey({ apiKey: '', organization: '', apiBase: '' })
      setAddKeyOpen(true)
      return
    }
    // If provider has keys, open Setup dialog for the selected key
    if (prov && (prov.selectedKey ?? 0) >= 0 && prov.apiKeys.length > 0) {
      const keyName = prov.apiKeys[prov.selectedKey ?? 0]
      const res = await fetch(`${API_BASE}/api/llm/providers/${pid}/keys/${encodeURIComponent(keyName)}/`)
      const data = await res.json()
      setSetupProviderId(pid)
      setSetupProviderName(prov.name)
      setSetupKeyName(keyName)
      setSetupForm({
        apiKey: '', // do not pre-fill secret; keep masked
        organization: data.organization || '',
        apiBase: data.api_base || '',
      })
      setSetupKeyOpen(true)
      return
    }
    setKeyMenuProvider(pid)
    setKeyMenuAnchor(el)
  }
  const closeKeyMenu = () => {
    setKeyMenuProvider(null)
    setKeyMenuAnchor(null)
  }
  const selectKey = async (idx: number) => {
    if (!keyMenuProvider) return
    const prov = providers.find(p => p.id === keyMenuProvider)
    if (!prov) return
    const name = prov.apiKeys[idx]
    await fetch(`${API_BASE}/api/llm/providers/${keyMenuProvider}/select-key/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    await loadProviders()
    closeKeyMenu()
  }
  const addKey = async () => {
    const pid = keyMenuProvider
    if (!pid) return
    const prov = providers.find(p => p.id === pid)
    if (!prov) return
    const name = `API_KEY${prov.apiKeys.length + 1}`
    await fetch(`${API_BASE}/api/llm/providers/${pid}/keys/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, secret: newKey.apiKey, organization: newKey.organization || undefined, api_base: newKey.apiBase || undefined }),
    })
    await loadProviders()
  }
  const deleteKey = async (idx: number) => {
    if (!keyMenuProvider) return
    const prov = providers.find(p => p.id === keyMenuProvider)
    if (!prov) return
    const name = prov.apiKeys[idx]
    await fetch(`${API_BASE}/api/llm/providers/${keyMenuProvider}/keys/${encodeURIComponent(name)}/`, {
      method: 'DELETE',
    })
    await loadProviders()
  }

  const submitAddKey = async () => {
    if (!addKeyProvider || !newKey.apiKey.trim()) return
    await fetch(`${API_BASE}/api/llm/providers/${addKeyProvider}/keys/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: newKey.apiKey, organization: newKey.organization || undefined, api_base: newKey.apiBase || undefined }),
    })
    setAddKeyOpen(false)
    setAddKeyProvider(null)
    await loadProviders()
  }

  const submitSetupKey = async () => {
    if (!setupProviderId) return
    const body: any = {}
    if (setupForm.apiKey.trim()) body.secret = setupForm.apiKey
    body.organization = setupForm.organization || undefined
    body.api_base = setupForm.apiBase || undefined
    await fetch(`${API_BASE}/api/llm/providers/${setupProviderId}/keys/${encodeURIComponent(setupKeyName)}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSetupKeyOpen(false)
    await loadProviders()
  }

  const removeSetupKey = async () => {
    if (!setupProviderId) return
    await fetch(`${API_BASE}/api/llm/providers/${setupProviderId}/keys/${encodeURIComponent(setupKeyName)}/`, {
      method: 'DELETE',
    })
    setSetupKeyOpen(false)
    await loadProviders()
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3, textAlign: 'center', fontWeight: 600, color: 'primary.main' }}>
        Xenera RAG Tool
      </Typography>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">Model Provider</Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')}>返回主页面</Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="subtitle1">Models</Typography>
        <TextField
          size="small"
          placeholder="Search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
      </Stack>

      <Stack spacing={2}>
        {filtered.map(p => (
          <Paper key={p.id} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1 }}>
                <Typography variant="h6">{p.name}</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {p.badges.map(b => <Chip key={b} size="small" label={b} variant="outlined" />)}
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Paper variant="outlined" sx={{ px: 0.75, py: 0.5, borderRadius: 2, bgcolor: 'action.hover', alignSelf: 'flex-start', display: 'inline-flex', flexDirection: 'column', width: 'fit-content' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', mr: 0.5 }}>
                      {p.apiKeys[p.selectedKey ?? 0] ?? 'API_KEY'}
                    </Typography>
                    <CircleIcon fontSize="small" sx={{ ml: 0, fontSize: 12 }} color={(p.apiKeys.length > 0) ? 'success' : 'disabled'} />
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={(e) => openKeyMenu(p.id, e.currentTarget)}
                    startIcon={<Settings fontSize="small" />}
                    sx={{ mt: 0.4, bgcolor: 'background.paper', borderColor: 'divider', borderRadius: 1.5, py: 0.2, px: 1, fontSize: 11, minHeight: 24, minWidth: 0, alignSelf: 'flex-start' }}
                  >
                    CONFIG
                  </Button>
                </Paper>
              </Stack>
            </Stack>

            <Box sx={{ mt: 1.5, pl: 1 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Tooltip title="Show Models">
                  <Button size="small" variant="text" onClick={() => setExpanded(prev => ({ ...prev, [p.id]: !prev[p.id] }))}>
                    {(p.models?.length ?? 0)} Models ▾
                  </Button>
                </Tooltip>
                <Stack direction="row" spacing={1}>
                  {p.id === 'ollama' && (
                    <Button size="small" variant="text" onClick={(e) => { setCredProvider(p.id); setCredAnchor(e.currentTarget) }}>Manage Credentials</Button>
                  )}
                  <Button size="small" variant="text" startIcon={<AddIcon />} onClick={() => openAddModel(p.id)}>Add Model</Button>
                </Stack>
              </Stack>
              {expanded[p.id] && p.models && (
                <Stack spacing={1}>
                  {p.models.map(m => (
                    <Stack key={m.id} direction="row" alignItems="center" spacing={1}>
                      <Typography sx={{ width: 220 }}>{m.name}</Typography>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                        {m.tags.map(t => <Chip key={t} size="small" label={t} variant="outlined" />)}
                      </Stack>
                      <Box sx={{ flex: 1 }} />
                      <Switch checked={m.enabled} onChange={(_, v) => toggleModel(p.id, m.id, v)} />
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>
          </Paper>
        ))}
      </Stack>

      <Popover
        open={Boolean(credAnchor)}
        onClose={() => { setCredAnchor(null); setCredProvider(null) }}
        anchorEl={credAnchor}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { p: 2, width: 420 } }}
      >
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Custom Model Credentials</Typography>
        <Stack spacing={2}>
          {providers.find(p => p.id === credProvider)?.models?.map(m => (
            <Box key={m.id}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography fontWeight={600}>{m.name}</Typography>
                <Button size="small" variant="text" onClick={() => {
                  setEditTitle(m.name)
                  const prov = providers.find(p => p.id === credProvider)
                  setEditForm({
                    authName: prov?.apiKeys[prov.selectedKey ?? 0] ?? 'API_KEY1',
                    baseUrl: '',
                    completionMode: 'Chat',
                    contextSize: '4096',
                    maxTokens: '4096',
                    visionSupport: true,
                    functionCallSupport: false,
                  })
                  setEditOpen(true)
                }}>Edit</Button>
              </Stack>
              <Paper variant="outlined" sx={{ px: 1.25, py: 1, borderRadius: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CircleIcon fontSize="small" color='success' />
                  <Typography variant="body2" sx={{ flex: 1 }}>{providers.find(p => p.id === credProvider)?.apiKeys[0] ?? 'API_KEY1'}</Typography>
                  <IconButton size="small"><DeleteOutline fontSize="small" /></IconButton>
                </Stack>
              </Paper>
            </Box>
          ))}
        </Stack>
      </Popover>

      <Menu open={Boolean(keyMenuAnchor)} onClose={closeKeyMenu} anchorEl={keyMenuAnchor} keepMounted>
        <Typography sx={{ px: 2, py: 1, fontSize: 12, color: 'text.secondary' }}>API Keys</Typography>
        {providers.find(p => p.id === keyMenuProvider)?.apiKeys.map((k, idx) => (
          <MenuItem key={k} onClick={() => selectKey(idx)} sx={{
            '& .del-btn': { display: 'none' },
            '&:hover .del-btn': { display: 'inline-flex' },
          }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%', justifyContent: 'space-between' }}>
              <CircleIcon fontSize="small" color='success' />
              <span style={{ flex: 1 }}>{k}</span>
              <Button className="del-btn" size="small" variant="text" onClick={(e) => { e.stopPropagation(); deleteKey(idx) }}>Delete</Button>
            </Stack>
          </MenuItem>
        ))}
        <MenuItem onClick={addKey}>
          <AddIcon fontSize="small" style={{ marginRight: 8 }} /> Add API Key
        </MenuItem>
      </Menu>

      <Dialog open={addKeyOpen} onClose={() => setAddKeyOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add OpenAI</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              required
              label="API Key"
              placeholder="Enter your API Key"
              value={newKey.apiKey}
              onChange={e => setNewKey({ ...newKey, apiKey: e.target.value })}
            />
            <TextField
              label="Organization"
              placeholder="Enter your Organization ID"
              value={newKey.organization}
              onChange={e => setNewKey({ ...newKey, organization: e.target.value })}
            />
            <TextField
              label="API Base"
              placeholder="Enter your API Base, e.g. https://api.openai.com"
              value={newKey.apiBase}
              onChange={e => setNewKey({ ...newKey, apiBase: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddKeyOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!newKey.apiKey.trim()} onClick={submitAddKey}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={setupKeyOpen} onClose={() => setSetupKeyOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Setup {setupProviderName.toUpperCase()}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              required
              type="password"
              label="API Key"
              placeholder="****************"
              value={setupForm.apiKey}
              onChange={e => setSetupForm({ ...setupForm, apiKey: e.target.value })}
            />
            <TextField
              label="Organization"
              placeholder=""
              value={setupForm.organization}
              onChange={e => setSetupForm({ ...setupForm, organization: e.target.value })}
            />
            <TextField
              label="API Base"
              placeholder=""
              value={setupForm.apiBase}
              onChange={e => setSetupForm({ ...setupForm, apiBase: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="error" onClick={removeSetupKey}>Remove</Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setSetupKeyOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitSetupKey}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit model credential
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>{editTitle} <Chip size="small" label="LLM" sx={{ ml: 1 }} /></Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="Authorization Name"
              value={editForm.authName}
              onChange={e => setEditForm({ ...editForm, authName: e.target.value })}
              placeholder="API_KEY1"
            />
            <TextField
              required
              label="Base URL"
              placeholder="http://192.168.80.196:11434"
              value={editForm.baseUrl}
              onChange={e => setEditForm({ ...editForm, baseUrl: e.target.value })}
            />
            <TextField
              required
              select
              label="Completion mode"
              value={editForm.completionMode}
              onChange={e => setEditForm({ ...editForm, completionMode: e.target.value })}
              SelectProps={{ native: true }}
            >
              <option value="Chat">Chat</option>
              <option value="Completion">Completion</option>
            </TextField>
            <TextField
              required
              label="Model context size"
              value={editForm.contextSize}
              onChange={e => setEditForm({ ...editForm, contextSize: e.target.value })}
            />
            <TextField
              required
              label="Upper bound for max tokens"
              value={editForm.maxTokens}
              onChange={e => setEditForm({ ...editForm, maxTokens: e.target.value })}
            />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Vision support</Typography>
              <RadioGroup row value={editForm.visionSupport ? 'yes' : 'no'} onChange={(_, v) => setEditForm({ ...editForm, visionSupport: v === 'yes' })}>
                <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                <FormControlLabel value="no" control={<Radio />} label="No" />
              </RadioGroup>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Function call support</Typography>
              <RadioGroup row value={editForm.functionCallSupport ? 'yes' : 'no'} onChange={(_, v) => setEditForm({ ...editForm, functionCallSupport: v === 'yes' })}>
                <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                <FormControlLabel value="no" control={<Radio />} label="No" />
              </RadioGroup>
            </Box>
            <Button size="small" variant="text" sx={{ alignSelf: 'flex-start' }} href="#" target="_blank">How to integrate with Ollama</Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="error">Remove</Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setEditOpen(false)}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add model</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              required
              label="Model Name"
              placeholder="Enter your model name"
              value={form.modelName}
              onChange={e => setForm({ ...form, modelName: e.target.value })}
              error={Boolean(errors.modelName)}
              helperText={errors.modelName}
            />
            <TextField
              required
              select
              label="Model Type"
              placeholder="Please select"
              value={form.modelType}
              onChange={e => setForm({ ...form, modelType: e.target.value })}
              error={Boolean(errors.modelType)}
              helperText={errors.modelType}
              SelectProps={{ native: true }}
            >
              <option value=""></option>
              <option value="LLM">LLM</option>
              <option value="TEXT EMBEDDING">TEXT EMBEDDING</option>
              <option value="RERANK">RERANK</option>
              <option value="SPEECH2TEXT">SPEECH2TEXT</option>
              <option value="TTS">TTS</option>
            </TextField>

            <Divider textAlign="left">MODEL CREDENTIAL</Divider>
            <TextField
              label="Authorization Name"
              placeholder="Please enter"
              value={form.authName}
              onChange={e => setForm({ ...form, authName: e.target.value })}
            />
            <TextField
              required
              label="Base URL"
              placeholder="Base url of server, e.g. http://192.168.1.100:11434"
              value={form.baseUrl}
              onChange={e => setForm({ ...form, baseUrl: e.target.value })}
              error={Boolean(errors.baseUrl)}
              helperText={errors.baseUrl}
            />
            <TextField
              required
              label="Model context size"
              placeholder="4096"
              value={form.contextSize}
              onChange={e => setForm({ ...form, contextSize: e.target.value })}
              error={Boolean(errors.contextSize)}
              helperText={errors.contextSize}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitModel}>Add</Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}


