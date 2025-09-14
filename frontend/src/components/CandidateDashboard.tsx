import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Grid } from '@mui/material';
import { 
  Visibility, 
  GetApp, 
  Email, 
  Phone, 
  LinkedIn, 
  GitHub,
  Star,
  StarBorder,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { candidateApi, jobProfileApi, Candidate, JobProfile } from '../services/api';

const CandidateDashboard: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobProfiles, setJobProfiles] = useState<JobProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    jobProfileId: '',
    stage: '',
    minScore: '',
    search: '',
  });

  // Pagination
  const [page, setPage] = useState(1);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const pageSize = 25;

  useEffect(() => {
    loadJobProfiles();
    loadCandidates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters]);

  const loadJobProfiles = async () => {
    try {
      const response = await jobProfileApi.getAll();
      setJobProfiles(response.data);
    } catch (err) {
      setError('Failed to load job profiles');
    }
  };

  const loadCandidates = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: pageSize,
      };

      if (filters.jobProfileId) params.jobProfileId = filters.jobProfileId;
      if (filters.stage) params.stage = filters.stage;
      if (filters.minScore) params.minScore = parseInt(filters.minScore);

      const response = await candidateApi.getAll(params);
      setCandidates(response.data.candidates);
      setTotalCandidates(response.data.total);
    } catch (err) {
      setError('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(1); // Reset to first page when filtering
  };

  const clearFilters = () => {
    setFilters({
      jobProfileId: '',
      stage: '',
      minScore: '',
      search: '',
    });
    setPage(1);
  };

  const handleViewDetails = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setDetailsOpen(true);
  };

  const handleExportReport = async (candidateId: string, format: 'pdf' | 'csv') => {
    try {
      const response = await candidateApi.exportReport(candidateId, format);
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `candidate-report-${candidateId}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to export report');
    }
  };

  const getStageColor = (stage: string) => {
    const colors: { [key: string]: any } = {
      'resume': 'default',
      'ai-analysis': 'primary',
      'linkedin': 'secondary',
      'github': 'info',
      'interview': 'warning',
      'scoring': 'success',
      'completed': 'success',
    };
    return colors[stage] || 'default';
  };

  const getRecommendationColor = (recommendation: string) => {
    const colors: { [key: string]: any } = {
      'strong-hire': 'success',
      'hire': 'primary',
      'maybe': 'warning',
      'no-hire': 'error',
    };
    return colors[recommendation] || 'default';
  };

  const renderScoreStars = (score: number) => {
    const stars = Math.round(score / 20); // Convert 0-100 to 0-5 stars
    return (
      <Box display="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <IconButton key={star} size="small" disabled>
            {star <= stars ? <Star color="primary" /> : <StarBorder />}
          </IconButton>
        ))}
      </Box>
    );
  };

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Name',
      width: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {params.row.resumeData?.fileName?.replace('.pdf', '') || 'Unknown'}
        </Typography>
      ),
    },
    {
      field: 'email',
      headerName: 'Contact',
      width: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          {params.row.resumeData?.contactInfo?.email && (
            <Tooltip title={params.row.resumeData.contactInfo.email}>
              <IconButton size="small">
                <Email />
              </IconButton>
            </Tooltip>
          )}
          {params.row.resumeData?.contactInfo?.phone && (
            <Tooltip title={params.row.resumeData.contactInfo.phone}>
              <IconButton size="small">
                <Phone />
              </IconButton>
            </Tooltip>
          )}
          {params.row.resumeData?.contactInfo?.linkedInUrl && (
            <Tooltip title="LinkedIn Profile">
              <IconButton size="small">
                <LinkedIn />
              </IconButton>
            </Tooltip>
          )}
          {params.row.resumeData?.contactInfo?.githubUrl && (
            <Tooltip title="GitHub Profile">
              <IconButton size="small">
                <GitHub />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
    {
      field: 'stage',
      headerName: 'Stage',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.row.processingStage}
          color={getStageColor(params.row.processingStage)}
          size="small"
        />
      ),
    },
    {
      field: 'score',
      headerName: 'Score',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight="bold">
          {params.row.finalScore?.compositeScore?.toFixed(1) || 'N/A'}
        </Typography>
      ),
    },
    {
      field: 'recommendation',
      headerName: 'Recommendation',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        params.row.finalScore?.recommendation ? (
          <Chip
            label={params.row.finalScore.recommendation}
            color={getRecommendationColor(params.row.finalScore.recommendation)}
            size="small"
          />
        ) : null
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Tooltip title="View Details">
            <IconButton onClick={() => handleViewDetails(params.row)}>
              <Visibility />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export PDF">
            <IconButton onClick={() => handleExportReport(params.row.id, 'pdf')}>
              <GetApp />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Candidate Dashboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Job Profile</InputLabel>
                <Select
                  value={filters.jobProfileId}
                  onChange={(e) => handleFilterChange('jobProfileId', e.target.value)}
                >
                  <MenuItem value="">All Profiles</MenuItem>
                  {jobProfiles.map((profile) => (
                    <MenuItem key={profile.id} value={profile.id}>
                      {profile.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Processing Stage</InputLabel>
                <Select
                  value={filters.stage}
                  onChange={(e) => handleFilterChange('stage', e.target.value)}
                >
                  <MenuItem value="">All Stages</MenuItem>
                  <MenuItem value="resume">Resume Processing</MenuItem>
                  <MenuItem value="ai-analysis">AI Analysis</MenuItem>
                  <MenuItem value="linkedin">LinkedIn Analysis</MenuItem>
                  <MenuItem value="github">GitHub Analysis</MenuItem>
                  <MenuItem value="interview">Interview</MenuItem>
                  <MenuItem value="scoring">Scoring</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Minimum Score"
                type="number"
                value={filters.minScore}
                onChange={(e) => handleFilterChange('minScore', e.target.value)}
                inputProps={{ min: 0, max: 100 }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button onClick={clearFilters} variant="outlined" fullWidth>
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          {totalCandidates} Candidates Found
        </Typography>
        <Box>
          <Button
            variant="outlined"
            onClick={() => window.location.reload()}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Data Grid */}
      <Card>
        <Box sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={candidates}
            columns={columns}
            loading={loading}
            pagination
            paginationModel={{ page: page - 1, pageSize }}
            onPaginationModelChange={(model) => setPage(model.page + 1)}
            rowCount={totalCandidates}
            paginationMode="server"
            disableRowSelectionOnClick
            disableColumnMenu
          />
        </Box>
      </Card>

      {/* Candidate Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Candidate Details
        </DialogTitle>
        <DialogContent>
          {selectedCandidate && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedCandidate.resumeData?.fileName?.replace('.pdf', '') || 'Unknown'}
              </Typography>
              
              {/* Contact Information */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Contact Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2">
                        <strong>Email:</strong> {selectedCandidate.resumeData?.contactInfo?.email || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2">
                        <strong>Phone:</strong> {selectedCandidate.resumeData?.contactInfo?.phone || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2">
                        <strong>LinkedIn:</strong> {selectedCandidate.resumeData?.contactInfo?.linkedInUrl || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2">
                        <strong>GitHub:</strong> {selectedCandidate.resumeData?.contactInfo?.githubUrl || 'N/A'}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Scores */}
              {selectedCandidate.finalScore && (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Scoring Results
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Typography variant="h4">
                            {selectedCandidate.finalScore.compositeScore.toFixed(1)}
                          </Typography>
                          {renderScoreStars(selectedCandidate.finalScore.compositeScore)}
                          <Chip
                            label={selectedCandidate.finalScore.recommendation}
                            color={getRecommendationColor(selectedCandidate.finalScore.recommendation)}
                          />
                        </Box>
                      </Grid>
                    </Grid>
                    
                    <TableContainer component={Paper} sx={{ mt: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Stage</TableCell>
                            <TableCell align="right">Score</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell>Resume Analysis</TableCell>
                            <TableCell align="right">
                              {selectedCandidate.finalScore.stageScores.resumeAnalysis.toFixed(1)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>LinkedIn Analysis</TableCell>
                            <TableCell align="right">
                              {selectedCandidate.finalScore.stageScores.linkedInAnalysis.toFixed(1)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>GitHub Analysis</TableCell>
                            <TableCell align="right">
                              {selectedCandidate.finalScore.stageScores.githubAnalysis.toFixed(1)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Interview Performance</TableCell>
                            <TableCell align="right">
                              {selectedCandidate.finalScore.stageScores.interviewPerformance.toFixed(1)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              )}

              {/* Processing Status */}
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Processing Status
                  </Typography>
                  <Chip
                    label={selectedCandidate.processingStage}
                    color={getStageColor(selectedCandidate.processingStage)}
                  />
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>Created:</strong> {new Date(selectedCandidate.createdAt).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
          {selectedCandidate && (
            <>
              <Button
                onClick={() => handleExportReport(selectedCandidate.id, 'pdf')}
                variant="outlined"
              >
                Export PDF
              </Button>
              <Button
                onClick={() => handleExportReport(selectedCandidate.id, 'csv')}
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

export default CandidateDashboard;
