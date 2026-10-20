import { useLocation, useNavigate } from 'react-router-dom'
import { AppTitle, useI18n } from '../../i18n'
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
  const { t } = useI18n()
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
      <AppTitle />
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate('/')}><ArrowBack /></IconButton>
        <InsertDriveFileIcon fontSize="small" />
        <Typography variant="h6" sx={{ mr: 1 }}>{fileName}</Typography>
        <Chip size="small" label="Q&A" variant="outlined" />
        <Box sx={{ flex: 1 }} />
        <Chip size="small" color="success" label={t('available')} />
        <Switch defaultChecked />
      </Stack>

      <Stack direction="row" spacing={2}>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Select size="small" value={'all'} sx={{ width: 120 }}>
              <MenuItem value={'all'}>{t('all')}</MenuItem>
            </Select>
            <TextField size="small" placeholder={t('search')} sx={{ flex: 1 }} />
          </Stack>

          <Typography variant="caption" sx={{ mb: 1, display: 'block' }}>{t('chunksCount', { count: chunks.length })}</Typography>

          <Stack spacing={1.5}>
            {chunks.map((c, idx) => (
              <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">{c.id} · {t('charactersValue', { count: c.characters })} · 0 {t('retrievalCountLabel')}</Typography>
                <Typography sx={{ mt: 1 }}>{c.text}</Typography>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" sx={{ mt: 1 }}>
                  <Button size="small">{t('edit')}</Button>
                  <Button size="small">{t('delete')}</Button>
                  <Switch defaultChecked />
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>

        <Box sx={{ width: 360 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>{t('metadata')}</Typography>
            <Button size="small" variant="contained">{t('startLabeling')}</Button>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle1">{t('documentInfo')}</Typography>
            <Divider sx={{ my: 1 }} />
            <InfoRow label={t('originalFilename')} value={fileName} />
            <InfoRow label={t('originalFileSize')} value="38.49 KB" />
            <InfoRow label={t('uploadDate')} value={new Date().toLocaleString()} />
            <InfoRow label={t('lastUpdate')} value={new Date().toLocaleString()} />
            <InfoRow label={t('source')} value={t('sourceUpload')} />
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle1">{t('technicalParams')}</Typography>
            <Divider sx={{ my: 1 }} />
            <InfoRow label={t('chunksSpec')} value={t('general')} />
            <InfoRow label={t('chunksLength')} value="1,024" />
            <InfoRow label={t('avgParagraph')} value={t('charactersValue', { count: 535 })} />
            <InfoRow label={t('paragraphs')} value={t('paragraphsValue', { count: chunks.length })} />
            <InfoRow label={t('retrievalCountLabel')} value={`0.00% (0/${chunks.length})`} />
            <InfoRow label={t('embeddingTime')} value="4.95 sec" />
            <InfoRow label={t('embeddedSpend')} value="1,473 tokens" />
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


