import { useLocation, useNavigate } from 'react-router-dom'
import {
  Box,
  Chip,
  Container,
  Divider,
  IconButton,
  Paper,
  Select,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  Button,
} from '@mui/material'
import ArrowBack from '@mui/icons-material/ArrowBack'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'

export default function KBDocumentDetail() {
  const navigate = useNavigate()
  const { state } = useLocation() as { state?: any }
  const fileName: string = state?.file || 'document.pdf'

  const chunks = [
    {
      id: 'Chunk-01',
      characters: 719,
      text: 'Q: Python中的列表和元组有什么区别? A: 主要区别包括: 可变性: 列表是可变的(创建后可以修改), 元组是不可变的(创建后不能修改)...',
    },
    { id: 'Chunk-02', characters: 461, text: 'my_decorator\n\ndef say_hello():...' },
    { id: 'Chunk-03', characters: 397, text: 'func(1, 2, 3, a=4, b=5)\nQ: Python的多进程和多线程各适用于什么场景? A: ...' },
    { id: 'Chunk-04', characters: 551, text: 'contextmanager\n\ndef my_context():...' },
  ]

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3, textAlign: 'center', fontWeight: 600, color: 'primary.main' }}>
        RAG Tool
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate('/')}><ArrowBack /></IconButton>
        <InsertDriveFileIcon fontSize="small" />
        <Typography variant="h6" sx={{ mr: 1 }}>{fileName}</Typography>
        <Chip size="small" label="Q&A" variant="outlined" />
        <Box sx={{ flex: 1 }} />
        <Chip size="small" color="success" label="AVAILABLE" />
        <Switch defaultChecked />
      </Stack>

      <Stack direction="row" spacing={2}>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Select size="small" value={'all'} sx={{ width: 120 }}>
              <MenuItem value={'all'}>All</MenuItem>
            </Select>
            <TextField size="small" placeholder="Search" sx={{ flex: 1 }} />
          </Stack>

          <Typography variant="caption" sx={{ mb: 1, display: 'block' }}>{chunks.length} CHUNKS</Typography>

          <Stack spacing={1.5}>
            {chunks.map((c, idx) => (
              <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">{c.id} · {c.characters} characters · 0 Retrieval count</Typography>
                <Typography sx={{ mt: 1 }}>{c.text}</Typography>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" sx={{ mt: 1 }}>
                  <Button size="small">Edit</Button>
                  <Button size="small">Delete</Button>
                  <Switch defaultChecked />
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>

        <Box sx={{ width: 360 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Metadata</Typography>
            <Button size="small" variant="contained">Start Labeling</Button>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle1">Document information</Typography>
            <Divider sx={{ my: 1 }} />
            <InfoRow label="Original filename" value={fileName} />
            <InfoRow label="Original file size" value="38.49 KB" />
            <InfoRow label="Upload date" value={new Date().toLocaleString()} />
            <InfoRow label="Last update date" value={new Date().toLocaleString()} />
            <InfoRow label="Source" value="Upload File" />
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle1">Technical parameters</Typography>
            <Divider sx={{ my: 1 }} />
            <InfoRow label="Chunks specification" value="General" />
            <InfoRow label="Chunks length" value="1,024" />
            <InfoRow label="Avg. paragraph length" value="535 characters" />
            <InfoRow label="Paragraphs" value={`${chunks.length} paragraphs`} />
            <InfoRow label="Retrieval count" value={`0.00% (0/${chunks.length})`} />
            <InfoRow label="Embedding time" value="4.95 sec" />
            <InfoRow label="Embedded spend" value="1,473 tokens" />
          </Paper>
        </Box>
      </Stack>
    </Container>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1} my={0.5}>
      <Typography color="text.secondary" sx={{ width: 160 }}>{label}</Typography>
      <Typography>{value}</Typography>
    </Stack>
  )
}


