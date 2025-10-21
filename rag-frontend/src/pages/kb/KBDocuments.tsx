import { useMemo, useState, useEffect } from 'react'
import {
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Stack,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Snackbar,
  Alert,
} from '@mui/material'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import DescriptionIcon from '@mui/icons-material/Description'
import TableChartIcon from '@mui/icons-material/TableChart'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import Settings from '@mui/icons-material/Settings'
import MoreVert from '@mui/icons-material/MoreVert'
import Add from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import ArchiveIcon from '@mui/icons-material/Archive'
import DeleteIcon from '@mui/icons-material/Delete'
import UnarchiveIcon from '@mui/icons-material/Unarchive'
import { useNavigate, useParams } from 'react-router-dom'

// Document type interface
interface Document {
  id: number
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  chunking_mode: string
  word_count: string
  chunk_count: number
  retrieval_count: number
  upload_time: string
  status: string
  knowledge_base_id: number
  knowledge_base_name: string
}

export default function KBDocuments() {
  const navigate = useNavigate()
  const { kbId } = useParams<{ kbId: string }>()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [knowledgeBaseName, setKnowledgeBaseName] = useState<string>('')
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success')
  
  const API_BASE = (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || 'http://localhost:8000'

  // Show snackbar message
  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message)
    setSnackbarSeverity(severity)
    setSnackbarOpen(true)
  }

  const handleSnackbarClose = () => {
    setSnackbarOpen(false)
  }

  // Fetch documents from API for specific knowledge base
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!kbId) {
        setError('Knowledge base ID is required')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const response = await fetch(`${API_BASE}/api/kb/get-documents/?kb_id=${kbId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch documents')
        }
        const data = await response.json()
        setDocuments(data.documents || [])
        setKnowledgeBaseName(data.documents?.[0]?.knowledge_base_name || '')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch documents')
      } finally {
        setLoading(false)
      }
    }

    fetchDocuments()
  }, [kbId, API_BASE])

  // Handle menu open/close
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, document: Document) => {
    setMenuAnchor(event.currentTarget)
    setSelectedDocument(document)
  }

  const handleMenuClose = () => {
    setMenuAnchor(null)
    setSelectedDocument(null)
  }

  // Handle menu actions
  const handleRename = () => {
    if (selectedDocument) {
      setNewFileName(selectedDocument.file_name)
      setRenameDialogOpen(true)
      // Don't call handleMenuClose() here to keep selectedDocument
    }
    setMenuAnchor(null) // Only close the menu, don't clear selectedDocument
  }

  const handleArchive = () => {
    if (selectedDocument) {
      // Directly archive without confirmation dialog
      handleArchiveConfirm(selectedDocument.id, 'archived')
    }
    setMenuAnchor(null) // Close menu
  }

  const handleUnarchive = () => {
    if (selectedDocument) {
      // Directly unarchive without confirmation dialog
      handleArchiveConfirm(selectedDocument.id, 'completed')
    }
    setMenuAnchor(null) // Close menu
  }

  const handleDelete = () => {
    if (selectedDocument) {
      setDeleteDialogOpen(true)
    }
    setMenuAnchor(null) // Close menu but keep selectedDocument
  }

  // Handle rename dialog
  const handleRenameDialogClose = () => {
    setRenameDialogOpen(false)
    setNewFileName('')
    setSelectedDocument(null) // Clear selected document when dialog closes
  }

  // Handle delete dialog
  const handleDeleteDialogClose = () => {
    setDeleteDialogOpen(false)
    setSelectedDocument(null) // Clear selected document when dialog closes
  }


  const handleArchiveConfirm = async (docId: number, status: string) => {
    try {
      console.log(`${status === 'disabled' ? 'Archiving' : 'Unarchiving'} document:`, docId)
      
      const response = await fetch(`${API_BASE}/api/kb/update-document-status/${docId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: status })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${status === 'disabled' ? 'archive' : 'unarchive'} document`)
      }
      
      // Update local state
      setDocuments(prevDocs => 
        prevDocs.map(doc => 
          doc.id === docId ? { ...doc, status: status } : doc
        )
      )
      
      console.log(`Document ${status === 'archived' ? 'archived' : 'unarchived'} successfully`)
      
      // Show success message
      showSnackbar(`Document ${status === 'archived' ? 'archived' : 'unarchived'} successfully`, 'success')
    } catch (error) {
      console.error(`Error ${status === 'archived' ? 'archiving' : 'unarchiving'} document:`, error)
      showSnackbar(`Failed to ${status === 'archived' ? 'archive' : 'unarchive'} document: ${error.message}`, 'error')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedDocument) return
    
    try {
      console.log('Deleting document:', selectedDocument.id)
      
      const response = await fetch(`${API_BASE}/api/kb/delete-document/${selectedDocument.id}/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete document')
      }
      
      // Update local state - remove the deleted document
      setDocuments(prevDocs => 
        prevDocs.filter(doc => doc.id !== selectedDocument.id)
      )
      
      console.log('Document deleted successfully')
      handleDeleteDialogClose()
      showSnackbar('Document deleted successfully', 'success')
    } catch (error) {
      console.error('Error deleting document:', error)
      showSnackbar(`Failed to delete document: ${error.message}`, 'error')
    }
  }

  const handleRenameSave = async () => {
    console.log('handleRenameSave called', { selectedDocument, newFileName })
    
    if (!selectedDocument || !newFileName.trim()) {
      console.log('Validation failed:', { selectedDocument: !!selectedDocument, newFileName: newFileName })
      return
    }
    
    try {
      console.log('Making API call to:', `${API_BASE}/api/kb/update-document-name/${selectedDocument.id}/`)
      
      const response = await fetch(`${API_BASE}/api/kb/update-document-name/${selectedDocument.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_name: newFileName.trim()
        })
      })
      
      console.log('API response status:', response.status)
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('API error:', errorData)
        throw new Error(errorData.error || 'Failed to rename document')
      }
      
      const data = await response.json()
      console.log('API success response:', data)
      
      // Update local state
      setDocuments(prevDocs => 
        prevDocs.map(doc => 
          doc.id === selectedDocument.id ? { ...doc, file_name: data.file_name } : doc
        )
      )
      
      console.log('Local state updated, closing dialog')
      handleRenameDialogClose()
      showSnackbar('Document renamed successfully', 'success')
    } catch (error) {
      console.error('Error renaming document:', error)
      showSnackbar(`Failed to rename document: ${error.message}`, 'error')
    }
  }

  // Handle document status toggle
  const handleStatusToggle = async (docId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'disabled' : 'completed'
    
    try {
      setUpdatingStatus(docId)
      const response = await fetch(`${API_BASE}/api/kb/update-document-status/${docId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      })
      
      if (!response.ok) {
        throw new Error('Failed to update document status')
      }
      
      // Update local state
      setDocuments(prevDocs => 
        prevDocs.map(doc => 
          doc.id === docId ? { ...doc, status: newStatus } : doc
        )
      )
      showSnackbar(`Document ${newStatus === 'completed' ? 'enabled' : 'disabled'} successfully`, 'success')
    } catch (err) {
        console.error('Error updating document status:', err)
        showSnackbar(`Failed to update status: ${err.message}`, 'error')
      } finally {
        setUpdatingStatus(null)
      }
  }

  // Get file icon based on file type
  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return <PictureAsPdfIcon fontSize="small" sx={{ color: 'error.main' }} />
      case 'docx':
      case 'doc':
        return <DescriptionIcon fontSize="small" sx={{ color: 'primary.main' }} />
      case 'csv':
      case 'xlsx':
      case 'xls':
        return <TableChartIcon fontSize="small" sx={{ color: 'success.main' }} />
      default:
        return <InsertDriveFileIcon fontSize="small" sx={{ color: 'text.secondary' }} />
    }
  }

  // Filter documents based on status and search query
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesStatus = statusFilter === 'all' || doc.status === statusFilter
      const matchesSearch = searchQuery === '' || 
        doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.knowledge_base_name.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [documents, statusFilter, searchQuery])

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', width: '100%', py: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Typography>Loading documents...</Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', width: '100%', py: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', py: 1, display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ maxWidth: 'lg', width: '100%', px: 2 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 3, textAlign: 'center', fontWeight: 600, color: 'primary.main' }}>
          Xenera RAG Tool
        </Typography>
        
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6">
            Documents {knowledgeBaseName && `- ${knowledgeBaseName}`}
          </Typography>
          <Button variant="outlined" onClick={() => navigate('/manage/kb')} startIcon={<ArrowBackIcon />}>
            返回管理知识库
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <Select 
            size="small" 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ width: 140 }}
          >
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="completed">Available</MenuItem>
            <MenuItem value="disabled">Disabled</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
            <MenuItem value="processing">Processing</MenuItem>
          </Select>
          <TextField 
            size="small" 
            placeholder="Search" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flex: 1 }} 
          />
          <Button variant="contained" startIcon={<Add />}>ADD FILE</Button>
        </Stack>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 44 }}>#</TableCell>
                <TableCell>NAME</TableCell>
                <TableCell>CHUNKING MODE</TableCell>
                <TableCell>WORDS</TableCell>
                <TableCell>RETRIEVAL COUNT</TableCell>
                <TableCell>UPLOAD TIME</TableCell>
                <TableCell>STATUS</TableCell>
                <TableCell align="right">ACTION</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredDocuments.map((doc, idx) => (
                <TableRow key={doc.id} hover>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell 
                    onClick={() => navigate(`/manage/kb/documents/${doc.id}`, { state: { document: doc } })} 
                    style={{ cursor: 'pointer' }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      {getFileIcon(doc.file_type)}
                      <Typography color="primary">{doc.file_name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={doc.chunking_mode} variant="outlined" />
                  </TableCell>
                  <TableCell>{doc.word_count}</TableCell>
                  <TableCell>{doc.retrieval_count}</TableCell>
                  <TableCell>{doc.upload_time}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <FiberManualRecordIcon 
                        sx={{ 
                          color: doc.status === 'completed' ? 'success.main' : 
                                 doc.status === 'failed' ? 'error.main' : 
                                 doc.status === 'disabled' ? 'text.disabled' : 
                                 doc.status === 'archived' ? 'text.disabled' : 'warning.main', 
                          fontSize: 12 
                        }} 
                      />
                      <Typography>
                        {doc.status === 'completed' ? 'Available' : 
                         doc.status === 'failed' ? 'Failed' : 
                         doc.status === 'disabled' ? 'Disabled' : 
                         doc.status === 'archived' ? 'Archived' : 'Processing'}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                      <Tooltip 
                        title={doc.status === 'archived' ? 'Archived file cannot be enabled' : ''}
                        placement="top"
                      >
                        <span>
                          <Switch 
                            checked={doc.status === 'completed'} 
                            disabled={updatingStatus === doc.id || doc.status === 'archived'}
                            onChange={() => handleStatusToggle(doc.id, doc.status)}
                            sx={{
                              '& .MuiSwitch-thumb': {
                                ...(doc.status === 'archived' && {
                                  backgroundColor: '#f44336', // Red color for disabled state
                                })
                              },
                              '& .MuiSwitch-track': {
                                ...(doc.status === 'archived' && {
                                  backgroundColor: '#ffcdd2', // Light red background
                                })
                              }
                            }}
                          />
                        </span>
                      </Tooltip>
                      <IconButton 
                        size="small"
                        onClick={() => navigate(`/manage/kb/chunk-settings/${kbId}`)}
                      >
                        <Settings />
                      </IconButton>
                      <IconButton 
                        size="small"
                        onClick={(e) => handleMenuOpen(e, doc)}
                      >
                        <MoreVert />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Action Menu */}
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
          {selectedDocument?.status === 'completed' && (
            <MenuItem onClick={handleRename}>
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Rename</ListItemText>
            </MenuItem>
          )}
          {selectedDocument?.status === 'completed' ? (
            <MenuItem onClick={handleArchive}>
              <ListItemIcon>
                <ArchiveIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Archive</ListItemText>
            </MenuItem>
          ) : selectedDocument?.status === 'archived' ? (
            <MenuItem onClick={handleUnarchive}>
              <ListItemIcon>
                <UnarchiveIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Unarchive</ListItemText>
            </MenuItem>
          ) : null}
          <MenuItem onClick={handleDelete}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        </Menu>

        {/* Rename Dialog */}
        <Dialog
          open={renameDialogOpen}
          onClose={handleRenameDialogClose}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Rename</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Name
            </Typography>
            <TextField
              fullWidth
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              variant="outlined"
              size="small"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleRenameDialogClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleRenameSave}
              variant="contained"
              disabled={!newFileName.trim()}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={handleDeleteDialogClose}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Are you sure Delete?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              If you need to resume processing later, you will continue from where you left off
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteDialogClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteConfirm}
              variant="contained"
              color="error"
            >
              I'm sure
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={4000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert 
            onClose={handleSnackbarClose} 
            severity={snackbarSeverity}
            sx={{ width: '100%' }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  )
}
