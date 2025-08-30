import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Grid,
  Chip,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Refresh,
  GetApp,
  Visibility,
  CheckCircle,
  Error,
  Schedule,
  PlayArrow,
} from '@mui/icons-material';
import { batchApi, candidateApi, ProcessingBatch } from '../services/api';

const BatchProgress: React.FC = () => {
  const [batches, setBatches] = useState<ProcessingBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<ProcessingBatch | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadBatches();
      }, 5000); // Refresh every 5 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const loadBatches = async () => {
    try {
      setLoading(true);
      const response = await batchApi.getAll();
      setBatches(response.data);
    } catch (err) {
      setError('Failed to load batch information');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (batch: ProcessingBatch) => {
    try {
      const response = await batchApi.getProgress(batch.id);
      setSelectedBatch(response.data);
      setDetailsOpen(true);
    } catch (err) {
      setError('Failed to load batch details');
    }
  };

  const handleExportBatch = async (batchId: string, format: 'pdf' | 'csv') => {
    try {
      const response = await candidateApi.exportBatch(batchId, format);
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batch-report-${batchId}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to export batch report');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: any } = {
      'processing': 'warning',
      'completed': 'success',
      'failed': 'error',
    };
    return colors[status] || 'default';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <PlayArrow color="warning" />;
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <Error color="error" />;
      default:
        return <Schedule />;
    }
  };

  const calculateProgress = (batch: ProcessingBatch) => {
    if (batch.totalCandidates === 0) return 0;
    return (batch.processedCandidates / batch.totalCandidates) * 100;
  };

  const formatDuration = (startDate: string, endDate?: string) => {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    }
    return `${diffMins}m`;
  };

  const getProcessingRate = (batch: ProcessingBatch) => {
    if (batch.status !== 'processing' || batch.processedCandidates === 0) return 0;
    
    const start = new Date(batch.startedAt);
    const now = new Date();
    const diffHours = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    return Math.round(batch.processedCandidates / diffHours);
  };

  const getEstimatedCompletion = (batch: ProcessingBatch) => {
    if (batch.status !== 'processing' || batch.processedCandidates === 0) return 'N/A';
    
    const rate = getProcessingRate(batch);
    if (rate === 0) return 'N/A';
    
    const remaining = batch.totalCandidates - batch.processedCandidates;
    const hoursRemaining = remaining / rate;
    
    if (hoursRemaining < 1) {
      return `${Math.round(hoursRemaining * 60)} minutes`;
    }
    return `${Math.round(hoursRemaining)} hours`;
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Processing Status</Typography>
        <Box>
          <Button
            variant={autoRefresh ? 'contained' : 'outlined'}
            onClick={() => setAutoRefresh(!autoRefresh)}
            sx={{ mr: 1 }}
          >
            Auto Refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadBatches}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Batches
              </Typography>
              <Typography variant="h4">
                {batches.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Processing
              </Typography>
              <Typography variant="h4" color="warning.main">
                {batches.filter(b => b.status === 'processing').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Completed
              </Typography>
              <Typography variant="h4" color="success.main">
                {batches.filter(b => b.status === 'completed').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Failed
              </Typography>
              <Typography variant="h4" color="error.main">
                {batches.filter(b => b.status === 'failed').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Batch List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Processing Batches
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Batch ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell>Candidates</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Rate</TableCell>
                  <TableCell>ETA</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {batch.id.substring(0, 8)}...
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {getStatusIcon(batch.status)}
                        <Chip
                          label={batch.status}
                          color={getStatusColor(batch.status)}
                          size="small"
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ width: 100 }}>
                        <LinearProgress
                          variant="determinate"
                          value={calculateProgress(batch)}
                          color={batch.status === 'failed' ? 'error' : 'primary'}
                        />
                        <Typography variant="caption" display="block" textAlign="center">
                          {calculateProgress(batch).toFixed(1)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {batch.processedCandidates} / {batch.totalCandidates}
                      </Typography>
                      {batch.failedCandidates > 0 && (
                        <Typography variant="caption" color="error">
                          {batch.failedCandidates} failed
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDuration(batch.startedAt, batch.completedAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {getProcessingRate(batch)} /hr
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {getEstimatedCompletion(batch)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Tooltip title="View Details">
                          <IconButton onClick={() => handleViewDetails(batch)}>
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        {batch.status === 'completed' && (
                          <>
                            <Tooltip title="Export PDF">
                              <IconButton onClick={() => handleExportBatch(batch.id, 'pdf')}>
                                <GetApp />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Batch Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Batch Details
        </DialogTitle>
        <DialogContent>
          {selectedBatch && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Batch ID</Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {selectedBatch.id}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Job Profile ID</Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {selectedBatch.jobProfileId}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Status</Typography>
                  <Chip
                    label={selectedBatch.status}
                    color={getStatusColor(selectedBatch.status)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Progress</Typography>
                  <Box sx={{ width: '100%', mt: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={calculateProgress(selectedBatch)}
                    />
                    <Typography variant="caption">
                      {selectedBatch.processedCandidates} / {selectedBatch.totalCandidates} candidates
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Started</Typography>
                  <Typography variant="body2">
                    {new Date(selectedBatch.startedAt).toLocaleString()}
                  </Typography>
                </Grid>
                {selectedBatch.completedAt && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2">Completed</Typography>
                    <Typography variant="body2">
                      {new Date(selectedBatch.completedAt).toLocaleString()}
                    </Typography>
                  </Grid>
                )}
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Processing Rate</Typography>
                  <Typography variant="body2">
                    {getProcessingRate(selectedBatch)} candidates/hour
                  </Typography>
                </Grid>
                {selectedBatch.failedCandidates > 0 && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2">Failed Candidates</Typography>
                    <Typography variant="body2" color="error">
                      {selectedBatch.failedCandidates}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
          {selectedBatch && selectedBatch.status === 'completed' && (
            <>
              <Button
                onClick={() => handleExportBatch(selectedBatch.id, 'pdf')}
                variant="outlined"
              >
                Export PDF
              </Button>
              <Button
                onClick={() => handleExportBatch(selectedBatch.id, 'csv')}
                variant="outlined"
              >
                Export CSV
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BatchProgress;