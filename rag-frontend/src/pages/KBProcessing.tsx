import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Container,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { useLocation, useNavigate } from 'react-router-dom'

export default function KBProcessing() {
  const navigate = useNavigate()
  const { state } = useLocation() as { state?: any }
  const files: string[] = useMemo(() => state?.files ?? [], [state])
  const [name, setName] = useState(state?.knowledgeName || (files[0] ? files[0].split('.')[0] : 'knowledge'))
  const [completed] = useState(true)

  const settings = {
    chunkingSetting: state?.delimiter ? 'Custom' : 'General',
    maxLen: state?.maxLen ?? '1024',
    preprocess: state?.replaceSpaces ? 'Replace consecutive spaces, newlines and tabs' : '—',
    indexMethod: state?.indexMethod === 'hq' ? 'High Quality' : 'Economical',
    retrieval: (state?.retrievalMode || 'vector').replace(/\b\w/g, (s: string) => s.toUpperCase()) + ' Search',
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>🎉 Knowledge created</Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Knowledge name</Typography>
        <TextField fullWidth value={name} onChange={e => setName(e.target.value)} placeholder="knowledge name" />
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>{completed ? 'EMBEDDING COMPLETED' : 'EMBEDDING PROCESSING...'}</Typography>
        {files.map((f, i) => (
          <Stack key={f + i} direction="row" spacing={1} alignItems="center" sx={{ mb: 1, p: 1, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <InsertDriveFileIcon fontSize="small" />
            <Typography sx={{ flex: 1 }}>{f}</Typography>
            {completed ? (
              <CheckCircleIcon sx={{ color: 'success.main' }} />
            ) : (
              <Typography variant="caption">0%</Typography>
            )}
          </Stack>
        ))}
        {!completed && <LinearProgress variant="indeterminate" />}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack spacing={1}>
          <Row label="Chunking Setting" value={settings.chunkingSetting} />
          <Row label="Maximum Chunk Length" value={String(settings.maxLen)} />
          <Row label="Text Preprocessing Rules" value={settings.preprocess} />
          <Row label="Index Method" value={settings.indexMethod} iconColor="orange" />
          <Row label="Retrieval Setting" value={settings.retrieval} iconColor="purple" />
        </Stack>
      </Paper>

      <Stack direction="row" spacing={1}>
        <Button variant="outlined">Access the API</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" onClick={() => navigate('/manage/kb/documents', { state: { files } })}>Go to document</Button>
      </Stack>
    </Container>
  )
}

function Row({ label, value, iconColor }: { label: string; value: string; iconColor?: string }) {
  return (
    <Stack direction="row" spacing={2} alignItems="center">
      <Typography sx={{ width: 200 }} color="text.secondary">{label}</Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <FiberManualRecordIcon sx={{ color: iconColor || 'text.secondary', fontSize: 12 }} />
        <Typography>{value}</Typography>
      </Stack>
    </Stack>
  )
}


