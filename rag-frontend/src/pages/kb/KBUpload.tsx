import { useCallback, useRef, useState } from 'react'
import {
  Box,
  Button,
  Container,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useNavigate } from 'react-router-dom'

type FileItem = { id: string; file: File; uploadedPath?: string }

export default function KBUpload() {
  const navigate = useNavigate()
  const [files, setFiles] = useState<FileItem[]>([])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000'

  const onFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return
    setUploading(true)
    
    try {
      const uploadPromises = Array.from(fileList).slice(0, 5).map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        
        const response = await fetch(`${API_BASE}/api/kb/upload-file/`, {
          method: 'POST',
          body: formData
        })
        
        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }
        
        const data = await response.json()
        return {
          id: `${file.name}-${file.size}-${file.lastModified}`,
          file,
          uploadedPath: data.file_path
        }
      })
      
      const uploadedFiles = await Promise.all(uploadPromises)
      setFiles(prev => [...prev, ...uploadedFiles])
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploading(false)
    }
  }, [API_BASE])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    onFiles(e.dataTransfer.files)
  }

  const openPicker = () => inputRef.current?.click()

  const remove = (id: string) => setFiles(prev => prev.filter(f => f.id !== id))

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', py: 1, display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ maxWidth: 'md', width: '100%', px: 2 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3, textAlign: 'center', fontWeight: 600, color: 'primary.main' }}>
          Xenera RAG Tool
        </Typography>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6">Upload file</Typography>
        <Button variant="outlined" onClick={() => navigate('/manage/kb')} startIcon={<ArrowBackIcon />}>
          返回管理知识库
        </Button>
      </Stack>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }} onDragOver={e => e.preventDefault()} onDrop={onDrop}>
        <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ color: 'text.secondary' }}>
          <UploadFileIcon />
          <Typography>Drag and drop file or folder, or <Button size="small" onClick={openPicker}>Browse</Button></Typography>
          <Typography variant="caption">Supports TXT, MARKDOWN, MDX, PDF, HTML, XLSX, XLS, DOCX, CSV, VTT, MD, HTM. Max 5 in a batch and 15 MB each.</Typography>
        </Stack>
        <input ref={inputRef} type="file" multiple hidden onChange={e => onFiles(e.target.files)} />
      </Paper>

      <List>
        {files.map(({ id, file }) => (
          <Paper key={id} variant="outlined" sx={{ mb: 1, p: 1 }}>
            <ListItem
              secondaryAction={
                <IconButton edge="end" onClick={() => remove(id)}>
                  <DeleteOutlineIcon />
                </IconButton>
              }
            >
              <ListItemAvatar>
                <Avatar variant="rounded"><InsertDriveFileIcon /></Avatar>
              </ListItemAvatar>
              <ListItemText primary={file.name} secondary={`PDF · ${(file.size/1024/1024).toFixed(2)}MB`} />
            </ListItem>
          </Paper>
        ))}
      </List>

      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button variant="outlined" onClick={() => navigate('/manage/kb')} startIcon={<ArrowBackIcon />}>
          Previous step
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button 
          variant="contained" 
          disabled={files.length === 0 || uploading}
          onClick={() => navigate('/manage/kb/chunk', { state: { files: files.map(f => f.uploadedPath || f.file.name) } })}
        >
          {uploading ? 'Uploading...' : 'Next'}
        </Button>
      </Stack>
      </Box>
    </Box>
  )
}


