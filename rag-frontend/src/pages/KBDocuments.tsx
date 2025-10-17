import { useMemo } from 'react'
import {
  Box,
  Button,
  Chip,
  Container,
  IconButton,
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
} from '@mui/material'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import Settings from '@mui/icons-material/Settings'
import MoreVert from '@mui/icons-material/MoreVert'
import Add from '@mui/icons-material/Add'
import { useLocation, useNavigate } from 'react-router-dom'

export default function KBDocuments() {
  const { state } = useLocation() as { state?: any }
  const files: string[] = useMemo(() => state?.files ?? ['sample.pdf'], [state])
  const navigate = useNavigate()

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Documents</Typography>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <Select size="small" value="all" sx={{ width: 140 }}>
          <MenuItem value="all">All Status</MenuItem>
          <MenuItem value="available">Available</MenuItem>
          <MenuItem value="disabled">Disabled</MenuItem>
        </Select>
        <TextField size="small" placeholder="Search" sx={{ flex: 1 }} />
        <Button variant="outlined">Metadata</Button>
        <Button variant="contained" startIcon={<Add />}>Add file</Button>
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
            {files.map((f, idx) => (
              <TableRow key={f + idx} hover>
                <TableCell>{idx + 1}</TableCell>
                <TableCell onClick={() => navigate(`/manage/kb/documents/${encodeURIComponent(f)}`, { state: { file: f } })} style={{ cursor: 'pointer' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <InsertDriveFileIcon fontSize="small" />
                    <Typography color="primary">{f}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip size="small" label="GENERAL" variant="outlined" />
                </TableCell>
                <TableCell>2.1k</TableCell>
                <TableCell>0</TableCell>
                <TableCell>{new Date().toLocaleString()}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FiberManualRecordIcon sx={{ color: 'success.main', fontSize: 12 }} />
                    <Typography>Available</Typography>
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                    <Switch defaultChecked />
                    <IconButton size="small"><Settings /></IconButton>
                    <IconButton size="small"><MoreVert /></IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  )
}


