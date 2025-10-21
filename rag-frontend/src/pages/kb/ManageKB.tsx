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
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Popover,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import FolderIcon from '@mui/icons-material/Folder'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import { useNavigate } from 'react-router-dom'

type KnowledgeBase = {
  id: number
  name: string
  description: string
  document_count: number
  available_document_count: number
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

type EditKbForm = {
  id: number
  name: string
  description: string
}

type Tag = {
  id: number
  name: string
  description: string
  color: string
  status: string
  knowledge_base: number
  kb_count: number
  created_at: string
  created_by?: string
}

type KbTag = {
  id: number
  name: string
  description: string
  color: string
  created_at: string
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
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditKbForm>({ id: 0, name: '', description: '' })
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null)
  
  // Tag-related states
  const [tags, setTags] = useState<Tag[]>([])
  const [kbTags, setKbTags] = useState<Record<number, KbTag[]>>({})
  const [tagDropdownOpen, setTagDropdownOpen] = useState<Record<number, boolean>>({})
  const [addTagsAnchor, setAddTagsAnchor] = useState<Record<number, HTMLElement | null>>({})
  const [addTagsHovered, setAddTagsHovered] = useState<Record<number, boolean>>({})
  const [addTagsTimeout, setAddTagsTimeout] = useState<Record<number, NodeJS.Timeout | null>>({})
  const [tagSearchQuery, setTagSearchQuery] = useState<Record<number, string>>({})
  const [manageTagsOpen, setManageTagsOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#1976d2')
  const [hoveredKb, setHoveredKb] = useState<number | null>(null)
  const [manageTagsAnchor, setManageTagsAnchor] = useState<HTMLElement | null>(null)
  const [currentKbId, setCurrentKbId] = useState<number | null>(null)
  
  // 编辑标签相关状态
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [editTagName, setEditTagName] = useState('')
  const [editTagColor, setEditTagColor] = useState('#1976d2')

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

  // Fetch tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/kb/get-tags/')
        if (response.ok) {
          const data = await response.json()
          setTags(data.tags || [])
        }
      } catch (err) {
        console.error('Error fetching tags:', err)
      }
    }

    fetchTags()
  }, [])

  // Fetch tags for each knowledge base
  useEffect(() => {
    const fetchKbTags = async () => {
      const newKbTags: Record<number, KbTag[]> = {}
      
      for (const kb of kbs) {
        try {
          // Add cache busting parameter to ensure fresh data
          const response = await fetch(`http://localhost:8000/api/kb/get-kb-tags/${kb.id}/?t=${Date.now()}`)
          if (response.ok) {
            const data = await response.json()
            console.log(`Fresh data for KB ${kb.id}:`, data.tags)
            newKbTags[kb.id] = data.tags || []
          }
        } catch (err) {
          console.error(`Error fetching tags for KB ${kb.id}:`, err)
          newKbTags[kb.id] = []
        }
      }
      
      console.log('Setting new kbTags:', newKbTags)
      setKbTags(newKbTags)
    }

    if (kbs.length > 0) {
      fetchKbTags()
    }
  }, [kbs])


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

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, kb: KnowledgeBase) => {
    setMenuAnchor(event.currentTarget)
    setSelectedKb(kb)
  }

  const handleMenuClose = () => {
    setMenuAnchor(null)
    setSelectedKb(null)
  }

  const handleEdit = () => {
    if (selectedKb) {
      setEditForm({
        id: selectedKb.id,
        name: selectedKb.name,
        description: selectedKb.description || ''
      })
      setEditErrors({})
      setEditDialogOpen(true)
    }
    handleMenuClose()
  }

  const handleDelete = () => {
    if (selectedKb) {
      // TODO: Implement delete functionality
      console.log('Delete KB:', selectedKb.id)
    }
    handleMenuClose()
  }

  const validateEdit = (v: EditKbForm) => {
    const es: Record<string, string> = {}
    if (!v.name.trim()) es.name = 'Knowledge Name is required'
    return es
  }

  const onEditSubmit = async () => {
    const es = validateEdit(editForm)
    setEditErrors(es)
    if (Object.keys(es).length > 0) return

    try {
      const response = await fetch(`http://localhost:8000/api/kb/update-knowledge-base/${editForm.id}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Update local state
      setKbs(prev => prev.map(kb => 
        kb.id === editForm.id 
          ? { ...kb, name: editForm.name, description: editForm.description }
          : kb
      ))

      setEditDialogOpen(false)
    } catch (err) {
      console.error('Error updating knowledge base:', err)
      setEditErrors({ submit: 'Failed to update knowledge base' })
    }
  }

  // Tag-related functions

  const handleTagSearch = (kbId: number, query: string) => {
    setTagSearchQuery(prev => ({
      ...prev,
      [kbId]: query
    }))
  }

  const handleAddTagToKb = async (kbId: number, tagId: number) => {
    try {
      const response = await fetch(`http://localhost:8000/api/kb/add-tag-to-kb/${kbId}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tag_id: tagId }),
      })

      if (response.ok) {
        console.log('Successfully activated tag, refreshing data...')
        
        // Refresh global tags list to get updated status
        const tagsResponse = await fetch(`http://localhost:8000/api/kb/get-tags/?t=${Date.now()}`)
        if (tagsResponse.ok) {
          const tagsData = await tagsResponse.json()
          console.log('Updated tags:', tagsData.tags)
          setTags(tagsData.tags || [])
        } else {
          console.error('Failed to refresh global tags')
        }
        
        // Refresh KB tags
        const kbTagsResponse = await fetch(`http://localhost:8000/api/kb/get-kb-tags/${kbId}/?t=${Date.now()}`)
        if (kbTagsResponse.ok) {
          const data = await kbTagsResponse.json()
          console.log('Updated KB tags:', data.tags)
          setKbTags(prev => ({
            ...prev,
            [kbId]: data.tags || []
          }))
        } else {
          console.error('Failed to refresh KB tags')
        }
      } else {
        console.error('Failed to add tag to knowledge base')
      }
    } catch (err) {
      console.error('Error adding tag to knowledge base:', err)
    }
  }

  const handleRemoveTagFromKb = async (kbId: number, tagId: number) => {
    try {
      const response = await fetch(`http://localhost:8000/api/kb/remove-tag-from-kb/${kbId}/${tagId}/`, {
        method: 'DELETE',
      })

      if (response.ok) {
        console.log('Successfully deactivated tag, refreshing data...')
        
        // Refresh global tags list to get updated status
        const tagsResponse = await fetch(`http://localhost:8000/api/kb/get-tags/?t=${Date.now()}`)
        if (tagsResponse.ok) {
          const tagsData = await tagsResponse.json()
          console.log('Updated tags:', tagsData.tags)
          setTags(tagsData.tags || [])
        } else {
          console.error('Failed to refresh global tags')
        }
        
        // Refresh KB tags
        const kbTagsResponse = await fetch(`http://localhost:8000/api/kb/get-kb-tags/${kbId}/?t=${Date.now()}`)
        if (kbTagsResponse.ok) {
          const data = await kbTagsResponse.json()
          console.log('Updated KB tags:', data.tags)
          setKbTags(prev => ({
            ...prev,
            [kbId]: data.tags || []
          }))
        } else {
          console.error('Failed to refresh KB tags')
        }
      } else {
        console.error('Failed to remove tag from knowledge base')
      }
    } catch (err) {
      console.error('Error removing tag from knowledge base:', err)
    }
  }

  const handleCreateTag = async () => {
    console.log('handleCreateTag called with:', { newTagName, newTagColor })
    if (!newTagName.trim()) return

    try {
      const response = await fetch('http://localhost:8000/api/kb/create-tag/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTagName,
          color: newTagColor,
          knowledge_base_id: currentKbId,
        }),
      })

      if (response.ok) {
        const newTag = await response.json()
        
        // Refresh tags list
        const tagsResponse = await fetch('http://localhost:8000/api/kb/get-tags/')
        if (tagsResponse.ok) {
          const data = await tagsResponse.json()
          setTags(data.tags || [])
        }
        
        // Refresh the specific knowledge base tags since the new tag is already associated
        if (currentKbId) {
          const kbTagsResponse = await fetch(`http://localhost:8000/api/kb/get-kb-tags/${currentKbId}/?t=${Date.now()}`)
          if (kbTagsResponse.ok) {
            const kbTagsData = await kbTagsResponse.json()
            console.log('Refreshed KB tags:', kbTagsData)
            setKbTags(prev => ({
              ...prev,
              [currentKbId]: kbTagsData.tags || []
            }))
          }
        }
        
        setNewTagName('')
        setNewTagColor('#1976d2')
        setManageTagsAnchor(null)
        setCurrentKbId(null)
      } else {
        console.error('Failed to create tag')
      }
    } catch (err) {
      console.error('Error creating tag:', err)
    }
  }

  // 编辑标签相关函数
  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag)
    setEditTagName(tag.name)
    setEditTagColor(tag.color)
  }

  const handleUpdateTag = async () => {
    if (!editingTag || !editTagName.trim()) return

    try {
      const response = await fetch(`http://localhost:8000/api/kb/update-tag/${editingTag.id}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editTagName,
          color: editTagColor,
        }),
      })

      if (response.ok) {
        // Refresh tags list
        const tagsResponse = await fetch('http://localhost:8000/api/kb/get-tags/')
        if (tagsResponse.ok) {
          const data = await tagsResponse.json()
          setTags(data.tags || [])
        }
        
        // Clear and refresh all knowledge base tags
        setKbTags({})
        
        // Re-fetch all knowledge base tags
        const newKbTags: Record<number, KbTag[]> = {}
        for (const kb of kbs) {
          try {
            const kbTagsResponse = await fetch(`http://localhost:8000/api/kb/get-kb-tags/${kb.id}/`)
            if (kbTagsResponse.ok) {
              const kbTagsData = await kbTagsResponse.json()
              newKbTags[kb.id] = kbTagsData.tags || []
            }
          } catch (err) {
            console.error(`Error refreshing tags for KB ${kb.id}:`, err)
            newKbTags[kb.id] = []
          }
        }
        setKbTags(newKbTags)
        
        setEditingTag(null)
        setEditTagName('')
        setEditTagColor('#1976d2')
      } else {
        console.error('Failed to update tag')
      }
    } catch (err) {
      console.error('Error updating tag:', err)
    }
  }

  const handleCancelEdit = () => {
    setEditingTag(null)
    setEditTagName('')
    setEditTagColor('#1976d2')
  }

  const handleDeleteTag = async (tagId: number) => {
    try {
      const response = await fetch(`http://localhost:8000/api/kb/delete-tag/${tagId}/`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Refresh tags list
        const tagsResponse = await fetch('http://localhost:8000/api/kb/get-tags/')
        if (tagsResponse.ok) {
          const data = await tagsResponse.json()
          setTags(data.tags || [])
        }
        
        // Clear and refresh all knowledge base tags
        setKbTags({})
        
        // Re-fetch all knowledge base tags
        const newKbTags: Record<number, KbTag[]> = {}
        for (const kb of kbs) {
          try {
            const kbTagsResponse = await fetch(`http://localhost:8000/api/kb/get-kb-tags/${kb.id}/`)
            if (kbTagsResponse.ok) {
              const kbTagsData = await kbTagsResponse.json()
              newKbTags[kb.id] = kbTagsData.tags || []
            }
          } catch (err) {
            console.error(`Error refreshing tags for KB ${kb.id}:`, err)
            newKbTags[kb.id] = []
          }
        }
        setKbTags(newKbTags)
      } else {
        console.error('Failed to delete tag')
      }
    } catch (err) {
      console.error('Error deleting tag:', err)
    }
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
              <Button 
                variant="outlined" 
                onClick={async () => {
                  console.log('Manual refresh triggered')
                  setKbTags({})
                  const newKbTags: Record<number, KbTag[]> = {}
                  for (const kb of kbs) {
                    try {
                      const response = await fetch(`http://localhost:8000/api/kb/get-kb-tags/${kb.id}/?t=${Date.now()}`)
                      if (response.ok) {
                        const data = await response.json()
                        console.log(`Manual refresh for KB ${kb.id}:`, data.tags)
                        newKbTags[kb.id] = data.tags || []
                      }
                    } catch (err) {
                      console.error(`Error refreshing KB ${kb.id}:`, err)
                      newKbTags[kb.id] = []
                    }
                  }
                  setKbTags(newKbTags)
                }}
                sx={{ minWidth: 100 }}
              >
                Refresh Tags
              </Button>
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
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      pt: 2,
                      px: 2,
                      pb: 2,
                      height: 200,
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: 'pointer',
                      '&:hover': {
                        boxShadow: 2,
                        transform: 'translateY(-2px)',
                        transition: 'all 0.2s ease-in-out'
                      }
                    }}
                    onClick={() => navigate(`/manage/kb/documents/${kb.id}`)}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 40, height: 40, bgcolor: 'primary.light', color: 'white', borderRadius: 2, display: 'grid', placeItems: 'center' }}>
                        <SmartToyIcon />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Tooltip title={kb.name} placement="top">
                            <Typography 
                              fontWeight={700} 
                              sx={{ 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                whiteSpace: 'nowrap',
                                maxWidth: '200px'
                              }}
                            >
                              {kb.name}
                            </Typography>
                          </Tooltip>
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMenuClick(e, kb)
                            }}
                            sx={{ ml: 1 }}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                          <Chip size="small" label="GENERAL" variant="outlined" />
                          <Chip size="small" label="HQ" variant="outlined" />
                          <Chip size="small" label="VECTOR" variant="outlined" />
                        </Stack>
                      </Box>
                    </Stack>

                    {/* Description area */}
                    <Box 
                      sx={{ 
                        mt: 1.5,
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <Typography 
                        variant="body2"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          lineHeight: 1.4,
                          flex: 1
                        }}
                      >
                        {kb.description || `useful for when you want to answer queries about the ${kb.name}`}
                    </Typography>
                    </Box>

                    {/* Tags Section - 在description和底部状态栏之间 */}
                    <Box 
                      sx={{ 
                        mt: 1.5, 
                        mb: 1.5,
                        position: 'relative',
                        minHeight: '32px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      onMouseEnter={() => {
                        setHoveredKb(kb.id)
                        // 如果ADD TAGS窗口是打开的，保持悬停状态
                        if (addTagsAnchor[kb.id]) {
                          setAddTagsHovered(prev => ({ ...prev, [kb.id]: true }))
                          // 清除之前的定时器
                          if (addTagsTimeout[kb.id]) {
                            clearTimeout(addTagsTimeout[kb.id])
                            setAddTagsTimeout(prev => ({ ...prev, [kb.id]: null }))
                          }
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredKb(null)
                        // 如果ADD TAGS窗口是打开的，设置延迟关闭
                        if (addTagsAnchor[kb.id]) {
                          setAddTagsHovered(prev => ({ ...prev, [kb.id]: false }))
                          const timeout = setTimeout(() => {
                            setAddTagsAnchor(prev => ({ ...prev, [kb.id]: null }))
                            setAddTagsTimeout(prev => ({ ...prev, [kb.id]: null }))
                          }, 500)
                          setAddTagsTimeout(prev => ({ ...prev, [kb.id]: timeout }))
                        }
                      }}
                    >
                      {/* Display existing tags or ADD TAGS button */}
                      {(() => {
                        console.log(`Rendering KB ${kb.id} with tags:`, kbTags[kb.id])
                        console.log(`KB ${kb.id} name:`, kb.name)
                        return kbTags[kb.id] && kbTags[kb.id].length > 0
                      })() ? (
                        // Show tags when they exist
                        <Box 
                          sx={{ 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            gap: 0.5, 
                            width: '100%',
                            p: 1,
                            borderRadius: 1,
                            backgroundColor: hoveredKb === kb.id ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s ease-in-out'
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setAddTagsAnchor(prev => ({ ...prev, [kb.id]: e.currentTarget }))
                          }}
                        >
                          {kbTags[kb.id].slice(0, 3).map((tag) => (
                            <Box
                              key={tag.id}
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                backgroundColor: '#f5f5f5',
                                border: '1px solid #e0e0e0',
                                borderRadius: '12px',
                                px: 1,
                                py: 0.5,
                                fontSize: '12px',
                                color: '#666',
                                maxWidth: '120px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor: tag.color,
                                  mr: 0.5,
                                  flexShrink: 0
                                }}
                              />
                              <span style={{ 
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {tag.name}
                              </span>
                            </Box>
                          ))}
                          {kbTags[kb.id].length > 3 && (
                            <Box
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                backgroundColor: '#f5f5f5',
                                border: '1px solid #e0e0e0',
                                borderRadius: '12px',
                                px: 1,
                                py: 0.5,
                                fontSize: '12px',
                                color: '#666'
                              }}
                            >
                              +{kbTags[kb.id].length - 3}
                            </Box>
                          )}
                        </Box>
                      ) : (
                        // Show ADD TAGS button when no tags exist - only on hover
                        <Box
                          sx={{
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            minHeight: '32px',
                            opacity: hoveredKb === kb.id ? 1 : 0,
                            visibility: hoveredKb === kb.id ? 'visible' : 'hidden',
                            transition: 'opacity 0.2s ease-in-out, visibility 0.2s ease-in-out'
                          }}
                        >
                          <Button
                            className="add-tags-button"
                            variant="outlined"
                            size="small"
                            startIcon={<LocalOfferIcon />}
                            onClick={(e) => {
                              e.stopPropagation()
                              setAddTagsAnchor(prev => ({ ...prev, [kb.id]: e.currentTarget }))
                            }}
                            sx={{ 
                              borderStyle: 'dashed',
                              borderColor: 'grey.300',
                              color: 'grey.600',
                              '&:hover': {
                                borderColor: 'primary.main',
                                color: 'primary.main'
                              }
                            }}
                          >
                            ADD TAGS
                          </Button>
                        </Box>
                      )}
                      
                      {/* Add Tags Popover */}
                      <Popover
                        open={Boolean(addTagsAnchor[kb.id])}
                        anchorEl={addTagsAnchor[kb.id]}
                        onClose={() => setAddTagsAnchor(prev => ({ ...prev, [kb.id]: null }))}
                        anchorOrigin={{
                          vertical: 'bottom',
                          horizontal: 'left',
                        }}
                        transformOrigin={{
                          vertical: 'top',
                          horizontal: 'left',
                        }}
                        PaperProps={{
                          sx: { 
                            width: 300, 
                            maxHeight: 400,
                            mt: 1
                          },
                          onMouseEnter: () => {
                            setAddTagsHovered(prev => ({ ...prev, [kb.id]: true }))
                            // 清除之前的定时器
                            if (addTagsTimeout[kb.id]) {
                              clearTimeout(addTagsTimeout[kb.id])
                              setAddTagsTimeout(prev => ({ ...prev, [kb.id]: null }))
                            }
                          },
                          onMouseLeave: () => {
                            setAddTagsHovered(prev => ({ ...prev, [kb.id]: false }))
                            // 设置延迟关闭
                            const timeout = setTimeout(() => {
                              setAddTagsAnchor(prev => ({ ...prev, [kb.id]: null }))
                              setAddTagsTimeout(prev => ({ ...prev, [kb.id]: null }))
                            }, 500)
                            setAddTagsTimeout(prev => ({ ...prev, [kb.id]: timeout }))
                          }
                        }}
                      >
                        <Box 
                          sx={{ p: 2 }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                        >
                          <Stack spacing={2}>
                            {/* Search Input */}
                            <TextField
                              size="small"
                              placeholder="Type to search or create"
                              value={tagSearchQuery[kb.id] || ''}
                              onChange={(e) => handleTagSearch(kb.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              onMouseUp={(e) => e.stopPropagation()}
                              InputProps={{
                                startAdornment: <SearchIcon fontSize="small" />
                              }}
                            />
                            
                            {/* Tag List */}
                            <Box 
                              sx={{ maxHeight: 200, overflow: 'auto' }}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              onMouseUp={(e) => e.stopPropagation()}
                            >
                              {console.log('All tags:', tags)}
                              {console.log('Current KB ID:', kb.id)}
                              {tags
                                .filter(tag => {
                                  // Show all tags that belong to this knowledge base (both active and inactive)
                                  const belongsToKb = tag.knowledge_base === kb.id
                                  const matchesSearch = !tagSearchQuery[kb.id] || 
                                    tag.name.toLowerCase().includes(tagSearchQuery[kb.id].toLowerCase())
                                  
                                  console.log(`Tag ${tag.name} for KB ${kb.id}: belongsToKb=${belongsToKb}, tag.knowledge_base=${tag.knowledge_base}, kb.id=${kb.id}, matchesSearch=${matchesSearch}`)
                                  
                                  return belongsToKb && matchesSearch
                                })
                                .map((tag) => {
                                  const isSelected = tag.status === 'active'
                                  const isEditing = editingTag?.id === tag.id
                                  
                                  return (
                                    <Box
                                      key={tag.id}
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        p: 1,
                                        cursor: isEditing ? 'default' : 'pointer',
                                        '&:hover': { backgroundColor: isEditing ? 'transparent' : 'action.hover' }
                                      }}
                                      onClick={isEditing ? undefined : (e) => {
                                        e.stopPropagation()
                                        if (isSelected) {
                                          handleRemoveTagFromKb(kb.id, tag.id)
                                        } else {
                                          handleAddTagToKb(kb.id, tag.id)
                                        }
                                      }}
                                    >
                                      {isEditing ? (
                                        // 编辑模式
                                        <>
                                          <Box
                                            sx={{
                                              width: 12,
                                              height: 12,
                                              borderRadius: '50%',
                                              backgroundColor: editTagColor,
                                              mr: 1
                                            }}
                                          />
                                          <TextField
                                            size="small"
                                            value={editTagName}
                                            onChange={(e) => setEditTagName(e.target.value)}
                                            sx={{ flex: 1, mr: 1 }}
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          <input
                                            type="color"
                                            value={editTagColor}
                                            onChange={(e) => setEditTagColor(e.target.value)}
                                            style={{ width: 24, height: 24, border: 'none', borderRadius: 4, marginRight: 8 }}
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          <IconButton
                                            size="small"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleUpdateTag()
                                            }}
                                            sx={{ color: 'primary.main', mr: 1 }}
                                          >
                                            <CheckIcon fontSize="small" />
                                          </IconButton>
                                          <IconButton
                                            size="small"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleCancelEdit()
                                            }}
                                            sx={{ color: 'error.main' }}
                                          >
                                            <CloseIcon fontSize="small" />
                                          </IconButton>
                                        </>
                                      ) : (
                                        // 显示模式
                                        <>
                                          <Box
                                            sx={{
                                              width: 12,
                                              height: 12,
                                              borderRadius: '50%',
                                              backgroundColor: tag.color,
                                              mr: 1
                                            }}
                                          />
                                          <Typography variant="body2" sx={{ flex: 1 }}>
                                            {tag.name}
                    </Typography>
                                          {isSelected && <CheckIcon fontSize="small" color="primary" />}
                                          <IconButton
                                            size="small"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleEditTag(tag)
                                            }}
                                            sx={{ color: 'primary.main', ml: 1 }}
                                          >
                                            <EditIcon fontSize="small" />
                                          </IconButton>
                                          <IconButton
                                            size="small"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleDeleteTag(tag.id)
                                            }}
                                            sx={{ color: 'error.main' }}
                                          >
                                            <DeleteIcon fontSize="small" />
                                          </IconButton>
                                        </>
                                      )}
                                    </Box>
                                  )
                                })}
                            </Box>
                            
                            {/* Manage Tags Button */}
                            <Button
                              variant="text"
                              size="small"
                              startIcon={<LocalOfferIcon />}
                              onClick={(e) => {
                                e.stopPropagation()
                                console.log('MANAGE TAGS clicked, setting anchor:', e.currentTarget)
                                setCurrentKbId(kb.id)
                                setManageTagsAnchor(e.currentTarget)
                              }}
                              sx={{ alignSelf: 'flex-start' }}
                            >
                              MANAGE TAGS
                            </Button>
                          </Stack>
                        </Box>
                      </Popover>
                    </Box>

                    {/* 底部状态信息 - 独立的一行 */}
                    <Stack 
                      direction="row" 
                      spacing={1} 
                      justifyContent="space-between" 
                      sx={{ 
                        mt: 'auto', 
                        mb: 0,
                        cursor: 'pointer'
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setAddTagsAnchor(prev => ({ ...prev, [kb.id]: e.currentTarget }))
                      }}
                    >
                      <Stack direction="row" spacing={1}>
                        <Tooltip 
                          title={
                            kb.available_document_count === kb.document_count 
                              ? `${kb.document_count} document enabled`
                              : `Total of ${kb.document_count} document, ${kb.available_document_count} available`
                          } 
                          placement="top"
                        >
                          <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help', lineHeight: 1 }}>
                            📄 {kb.available_document_count === kb.document_count ? kb.document_count : `${kb.available_document_count}/${kb.document_count}`}
                          </Typography>
                        </Tooltip>
                        <Tooltip title="0 linked applications" placement="top">
                          <Typography variant="caption" color="text.secondary" sx={{ cursor: 'help', lineHeight: 1 }}>
                            🤖 0
                          </Typography>
                        </Tooltip>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                        Updated {new Date(kb.updated_at).toLocaleDateString()}
                      </Typography>
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

      {/* Edit Knowledge Base Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Knowledge settings</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Knowledge Name
              </Typography>
              <TextField
                fullWidth
                value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                error={Boolean(editErrors.name)}
                helperText={editErrors.name}
                placeholder="Enter knowledge base name"
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Description
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={editForm.description}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Enter description"
              />
            </Box>
            {editErrors.submit && (
              <Alert severity="error">{editErrors.submit}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={onEditSubmit}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Manage Tags Dialog */}
      <Dialog
        open={Boolean(manageTagsAnchor)}
        onClose={() => {
          console.log('Manage Tags Dialog closing')
          setManageTagsAnchor(null)
          setCurrentKbId(null)
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { 
            width: 400, 
            maxHeight: 500,
            position: 'relative'
          }
        }}
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
      >
        <Box 
          sx={{ p: 2 }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>
            Manage Tags
          </Typography>
          <Stack spacing={2}>
            {/* Add new tag section */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Add new tag
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => {
                    e.stopPropagation()
                    setNewTagName(e.target.value)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  onBlur={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  onKeyUp={(e) => e.stopPropagation()}
                  onKeyPress={(e) => e.stopPropagation()}
                  InputProps={{
                    onFocus: (e) => e.stopPropagation(),
                    onBlur: (e) => e.stopPropagation(),
                  }}
                />
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="body2">Color:</Typography>
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => {
                      e.stopPropagation()
                      setNewTagColor(e.target.value)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                    onBlur={(e) => e.stopPropagation()}
                    style={{ width: 40, height: 32, border: 'none', borderRadius: 4 }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCreateTag()
                    }}
                    disabled={!newTagName.trim()}
                  >
                    ADD
                  </Button>
                </Stack>
              </Stack>
            </Box>

            <Divider />

            {/* Existing tags */}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Existing Tags
              </Typography>
              <Stack spacing={1} sx={{ maxHeight: 200, overflow: 'auto' }}>
                {tags.map((tag) => (
                  <Box
                    key={tag.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      p: 1,
                      border: '1px solid',
                      borderColor: 'grey.300',
                      borderRadius: 1
                    }}
                  >
                    {editingTag?.id === tag.id ? (
                      // 编辑模式
                      <>
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            backgroundColor: editTagColor,
                            mr: 1
                          }}
                        />
                        <Box sx={{ flex: 1 }}>
                          <TextField
                            size="small"
                            value={editTagName}
                            onChange={(e) => setEditTagName(e.target.value)}
                            sx={{ mr: 1 }}
                          />
                        </Box>
                        <input
                          type="color"
                          value={editTagColor}
                          onChange={(e) => setEditTagColor(e.target.value)}
                          style={{ width: 32, height: 32, border: 'none', borderRadius: 4, marginRight: 8 }}
                        />
                        <IconButton
                          size="small"
                          onClick={handleUpdateTag}
                          sx={{ color: 'primary.main', mr: 1 }}
                        >
                          <CheckIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={handleCancelEdit}
                          sx={{ color: 'error.main' }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </>
                    ) : (
                      // 显示模式
                      <>
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            backgroundColor: tag.color,
                            mr: 1
                          }}
                        />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={500}>
                            {tag.name}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                          {tag.kb_count} KBs
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => handleEditTag(tag)}
                          sx={{ color: 'primary.main', mr: 1 }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteTag(tag.id)}
                          sx={{ color: 'error.main' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </Box>
                ))}
                {tags.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No tags created yet
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Dialog>
      </Box>
    </Box>
  )
}


