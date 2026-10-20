import { useCallback, useRef, useState, useEffect } from 'react'
import { API_BASE, apiFetch } from '../../apiBase'
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
import { useNavigate, useLocation } from 'react-router-dom'
import { AppTitle, useI18n } from '../../i18n'

type FileItem = { id: string; file: File; uploadedPath?: string }

export default function KBUpload() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [files, setFiles] = useState<FileItem[]>([])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Restore files from location.state when coming back from chunk page
  useEffect(() => {
    const stateFiles = location.state?.files as string[] | undefined
    if (stateFiles && stateFiles.length > 0) {
      // Convert file paths back to FileItem objects
      const restoredFiles: FileItem[] = stateFiles.map((filePath, index) => {
        const fileName = filePath.includes('/') ? filePath.split('/').pop() : filePath.split('\\').pop()
        return {
          id: `restored-${index}-${fileName}`,
          file: new File([''], fileName || 'unknown', { type: 'application/octet-stream' }),
          uploadedPath: filePath
        }
      })
      setFiles(restoredFiles)
    }
  }, [location.state])

  const onFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return
    setUploading(true)
    
    try {
      const uploadPromises = Array.from(fileList).slice(0, 5).map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        
        const response = await apiFetch(`${API_BASE}/api/kb/upload-file/`, {
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
        <AppTitle />
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6">{t('uploadFile')}</Typography>
        <Button variant="outlined" onClick={() => navigate('/manage/kb')} startIcon={<ArrowBackIcon />}>
          {t('backToKb')}
        </Button>
      </Stack>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }} onDragOver={e => e.preventDefault()} onDrop={onDrop}>
        <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ color: 'text.secondary' }}>
          <UploadFileIcon />
          <Typography>{t('dragDrop')} <Button size="small" onClick={openPicker}>{t('browse')}</Button></Typography>
          <Typography variant="caption">{t('uploadHint')}</Typography>
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
          {t('previousStep')}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button 
          variant="contained" 
          disabled={files.length === 0 || uploading}
          onClick={() => navigate('/manage/kb/chunk', { state: { files: files.map(f => f.uploadedPath || f.file.name) } })}
        >
          {uploading ? t('uploading') : t('next')}
        </Button>
      </Stack>
      </Box>
    </Box>
  )
}


