import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Container,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
  Paper,
  Select,
  MenuItem,
  Chip,
  Slider,
} from '@mui/material'
import Autocomplete from '@mui/material/Autocomplete'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import { useLocation, useNavigate } from 'react-router-dom'

export default function KBChunkSettings() {
  const navigate = useNavigate()
  const location = useLocation()
  const files: string[] = useMemo(() => (location.state?.files ?? []) as string[], [location.state])

  const [delimiter, setDelimiter] = useState('\n\n')
  const [maxLen, setMaxLen] = useState('1024')
  const [overlap, setOverlap] = useState('50')
  const [replaceSpaces, setReplaceSpaces] = useState(true)
  const [indexMethod, setIndexMethod] = useState<'hq' | 'eco'>('hq')
  type EmbeddingModel = { id: string; provider: string; label: string; tags?: string[] }
  const embeddingOptions: EmbeddingModel[] = [
    { id: 'text-embedding-3-large', provider: 'OpenAI', label: 'text-embedding-3-large' },
    { id: 'text-embedding-3-small', provider: 'OpenAI', label: 'text-embedding-3-small' },
    { id: 'text-embedding-ada-002', provider: 'OpenAI', label: 'text-embedding-ada-002' },
    { id: 'text-embedding-v1', provider: 'TONGYI', label: 'text-embedding-v1' },
    { id: 'text-embedding-v2', provider: 'TONGYI', label: 'text-embedding-v2', tags: ['TEXT EMBEDDING', '2K'] },
    { id: 'text-embedding-v3', provider: 'TONGYI', label: 'text-embedding-v3', tags: ['TEXT EMBEDDING', '8K'] },
    { id: 'text-embedding-v4', provider: 'TONGYI', label: 'text-embedding-v4' },
    { id: 'bge-m3', provider: 'Ollama', label: 'bge-m3' },
  ]
  const [embedding, setEmbedding] = useState<EmbeddingModel | null>(embeddingOptions[0])
  const [highlighted, setHighlighted] = useState<EmbeddingModel | null>(null)
  const [rerankEnabled, setRerankEnabled] = useState(false)
  const [rerankModel, setRerankModel] = useState('qte-rerank')
  const [retrievalMode, setRetrievalMode] = useState<'vector' | 'fulltext' | 'hybrid'>('vector')
  const [topK, setTopK] = useState(3)
  const [scoreEnabled, setScoreEnabled] = useState(false)
  const [score, setScore] = useState(0.5)
  const [hybridStrategy, setHybridStrategy] = useState<'weighted' | 'rerank'>('rerank')

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction="row" spacing={2}>
        <Box sx={{ flex: 1 }}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>Chunk Settings</Typography>
            <Divider sx={{ my: 1 }} />
            <Stack spacing={2}>
              <Stack direction="row" spacing={2}>
                <TextField label="Delimiter" value={delimiter} onChange={e => setDelimiter(e.target.value)} size="small" sx={{ width: 240 }} />
                <TextField label="Maximum chunk length" value={maxLen} onChange={e => setMaxLen(e.target.value)} size="small" sx={{ width: 240 }} InputProps={{ endAdornment: <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>characters</span> }} />
                <TextField label="Chunk overlap" value={overlap} onChange={e => setOverlap(e.target.value)} size="small" sx={{ width: 240 }} InputProps={{ endAdornment: <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>characters</span> }} />
              </Stack>
              <FormControlLabel control={<Switch checked={replaceSpaces} onChange={(_, v) => setReplaceSpaces(v)} />} label="Replace consecutive spaces, newlines and tabs" />
              <Stack direction="row" spacing={1}>
                <Button variant="outlined">Preview Chunk</Button>
                <Button>Reset</Button>
              </Stack>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>Index Method</Typography>
            <Divider sx={{ my: 1 }} />
            <RadioGroup row value={indexMethod} onChange={(_, v) => setIndexMethod(v as any)}>
              <FormControlLabel value="hq" control={<Radio />} label="High Quality" />
              <FormControlLabel value="eco" control={<Radio />} label="Economical" />
            </RadioGroup>
            <Typography variant="caption" color="text.secondary">Once finishing embedding in High Quality mode, reverting to Economical mode is not available.</Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>Embedding Model</Typography>
            <Divider sx={{ my: 1 }} />
            <Autocomplete
              sx={{ width: 360 }}
              options={embeddingOptions}
              groupBy={(o) => o.provider}
              getOptionLabel={(o) => o.label}
              value={embedding}
              onChange={(_, v) => setEmbedding(v)}
              onHighlightChange={(_, v) => setHighlighted(v)}
              renderInput={(params) => <TextField {...params} size="small" placeholder="Search model" />}
              renderOption={(props, option) => (
                <li {...props} key={option.id} style={{ position: 'relative' }}>
                  <Typography>{option.label}</Typography>
                  {highlighted?.id === option.id && (
                    <Paper elevation={3} style={{ position: 'absolute', left: 'calc(100% + 8px)', top: 0, width: 240, padding: 12 }}>
                      <Typography fontWeight={600}>{option.label}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                        {(option.tags ?? ['TEXT EMBEDDING']).map(t => <Chip key={t} size="small" label={t} />)}
                      </Stack>
                    </Paper>
                  )}
                </li>
              )}
            />
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>Retrieval Setting</Typography>
            <Divider sx={{ my: 1 }} />

            {/* Vector Search */}
            <Paper onClick={() => setRetrievalMode('vector')} variant="outlined" sx={{ p: 2, mb: 1.5, borderColor: retrievalMode === 'vector' ? 'primary.main' : 'divider', cursor: 'pointer' }}>
              <Typography fontWeight={600}>Vector Search</Typography>
              <Typography variant="body2" color="text.secondary">Generate query embeddings and search for the text chunk most similar to its vector representation.</Typography>
              {retrievalMode === 'vector' && (
                <Box sx={{ mt: 2 }}>
                  <FormControlLabel control={<Switch checked={rerankEnabled} onChange={(_, v) => setRerankEnabled(v)} />} label="Rerank Model" />
                  <Select size="small" disabled={!rerankEnabled} value={rerankModel} onChange={e => setRerankModel(e.target.value)} sx={{ ml: 2 }}>
                    <MenuItem value="qte-rerank">qte-rerank</MenuItem>
                  </Select>
                  <Stack direction="row" spacing={4} alignItems="center" sx={{ mt: 2 }}>
                    <Box>
                      <Typography variant="caption">Top K</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Select size="small" value={topK} onChange={e => setTopK(Number(e.target.value))}>
                          {[1,2,3,4,5].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                        </Select>
                        <Slider value={topK} onChange={(_, v) => setTopK(v as number)} min={1} max={10} sx={{ width: 220 }} />
                      </Stack>
                    </Box>
                    <Box>
                      <FormControlLabel control={<Switch checked={scoreEnabled} onChange={(_, v) => setScoreEnabled(v)} />} label="Score Threshold" />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField size="small" value={score} sx={{ width: 80 }} disabled={!scoreEnabled} />
                        <Slider value={score} onChange={(_, v) => setScore(v as number)} min={0} max={1} step={0.01} disabled={!scoreEnabled} sx={{ width: 220 }} />
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              )}
            </Paper>

            {/* Full-Text Search */}
            <Paper onClick={() => setRetrievalMode('fulltext')} variant="outlined" sx={{ p: 2, mb: 1.5, borderColor: retrievalMode === 'fulltext' ? 'primary.main' : 'divider', cursor: 'pointer' }}>
              <Typography fontWeight={600}>Full-Text Search</Typography>
              <Typography variant="body2" color="text.secondary">Index all terms in the document, allowing users to search any term and retrieve relevant text chunk containing those terms.</Typography>
              {retrievalMode === 'fulltext' && (
                <Box sx={{ mt: 2 }}>
                  <FormControlLabel control={<Switch checked={rerankEnabled} onChange={(_, v) => setRerankEnabled(v)} />} label="Rerank Model" />
                  <Select size="small" disabled={!rerankEnabled} value={rerankModel} onChange={e => setRerankModel(e.target.value)} sx={{ ml: 2 }}>
                    <MenuItem value="qte-rerank">qte-rerank</MenuItem>
                  </Select>
                  <Stack direction="row" spacing={4} alignItems="center" sx={{ mt: 2 }}>
                    <Box>
                      <Typography variant="caption">Top K</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Select size="small" value={topK} onChange={e => setTopK(Number(e.target.value))}>
                          {[1,2,3,4,5].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                        </Select>
                        <Slider value={topK} onChange={(_, v) => setTopK(v as number)} min={1} max={10} sx={{ width: 220 }} />
                      </Stack>
                    </Box>
                    <Box>
                      <FormControlLabel control={<Switch checked={scoreEnabled} onChange={(_, v) => setScoreEnabled(v)} />} label="Score Threshold" />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField size="small" value={score} sx={{ width: 80 }} disabled={!scoreEnabled} />
                        <Slider value={score} onChange={(_, v) => setScore(v as number)} min={0} max={1} step={0.01} disabled={!scoreEnabled} sx={{ width: 220 }} />
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              )}
            </Paper>

            {/* Hybrid Search */}
            <Paper onClick={() => setRetrievalMode('hybrid')} variant="outlined" sx={{ p: 2, borderColor: retrievalMode === 'hybrid' ? 'primary.main' : 'divider', cursor: 'pointer' }}>
              <Typography fontWeight={600}>Hybrid Search</Typography>
              <Chip label="RECOMMEND" size="small" sx={{ ml: 1 }} />
              <Typography variant="body2" color="text.secondary">Execute full-text search and vector searches simultaneously, re-rank to select the best match for the user's query. Users can choose to set weights or configure to a Rerank model.</Typography>
              {retrievalMode === 'hybrid' && (
                <Box sx={{ mt: 2 }}>
                  <Stack direction="row" spacing={2}>
                    <Paper variant="outlined" sx={{ p: 2, flex: 1, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <FormControlLabel control={<Radio checked={hybridStrategy === 'weighted'} onChange={() => setHybridStrategy('weighted')} />} label="Weighted Score" />
                      <Typography variant="body2" color="text.secondary">By adjusting the weights assigned, this rerank strategy determines whether to prioritize semantic or keyword matching.</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 2, flex: 1, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <FormControlLabel control={<Radio checked={hybridStrategy === 'rerank'} onChange={() => setHybridStrategy('rerank')} />} label="Rerank Model" />
                      <Typography variant="body2" color="text.secondary">Rerank model will reorder the candidate document list based on the semantic match with user query, improving the results of semantic ranking</Typography>
                    </Paper>
                  </Stack>
                  <Select size="small" value={rerankModel} onChange={e => setRerankModel(e.target.value)} sx={{ mt: 2 }}>
                    <MenuItem value="qte-rerank">qte-rerank</MenuItem>
                  </Select>
                  <Stack direction="row" spacing={4} alignItems="center" sx={{ mt: 2 }}>
                    <Box>
                      <Typography variant="caption">Top K</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Select size="small" value={topK} onChange={e => setTopK(Number(e.target.value))}>
                          {[1,2,3,4,5].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                        </Select>
                        <Slider value={topK} onChange={(_, v) => setTopK(v as number)} min={1} max={10} sx={{ width: 220 }} />
                      </Stack>
                    </Box>
                    <Box>
                      <FormControlLabel control={<Switch checked={scoreEnabled} onChange={(_, v) => setScoreEnabled(v)} />} label="Score Threshold" />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField size="small" value={score} sx={{ width: 80 }} disabled={!scoreEnabled} />
                        <Slider value={score} onChange={(_, v) => setScore(v as number)} min={0} max={1} step={0.01} disabled={!scoreEnabled} sx={{ width: 220 }} />
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              )}
            </Paper>

            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button onClick={() => navigate(-1)}>Previous step</Button>
              <Box sx={{ flex: 1 }} />
              <Button variant="contained" onClick={() => navigate('/manage/kb/processing', { state: {
                files,
                knowledgeName: files[0] || 'knowledge',
                delimiter,
                maxLen,
                replaceSpaces,
                indexMethod,
                retrievalMode,
              } })}>Save & Process</Button>
            </Stack>
          </Paper>
        </Box>

        <Box sx={{ width: 360 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={600}>Preview</Typography>
            <Divider sx={{ my: 1 }} />
            <Select size="small" value={files[0] ?? ''} sx={{ width: '100%', mb: 1 }}>
              {files.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>{files.length} preprocess documents</Typography>
            {files.map(f => (
              <Stack key={f} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <InsertDriveFileIcon fontSize="small" />
                <Typography variant="body2" sx={{ flex: 1 }}>{f}</Typography>
              </Stack>
            ))}
            <Box sx={{ mt: 4, color: 'text.secondary', textAlign: 'center' }}>Click the 'Preview Chunk' button on the left to load the preview</Box>
          </Paper>
        </Box>
      </Stack>
    </Container>
  )
}


