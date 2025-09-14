import React, { useState, useEffect } from 'react';
import {
  Eye, 
  Download, 
  Mail, 
  Phone, 
  Linkedin, 
  Github,
  Star,
} from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import Button from './ui/Button';
import Select from './ui/Select';
import Input from './ui/Input';
import Alert from './ui/Alert';
import Badge from './ui/Badge';
import Modal from './ui/Modal';
import DataTable from './ui/DataTable';
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

  const getStageVariant = (stage: string) => {
    const variants: { [key: string]: any } = {
      'resume': 'default',
      'ai-analysis': 'primary',
      'linkedin': 'secondary',
      'github': 'primary',
      'interview': 'warning',
      'scoring': 'success',
      'completed': 'success',
    };
    return variants[stage] || 'default';
  };

  const getRecommendationVariant = (recommendation: string) => {
    const variants: { [key: string]: any } = {
      'strong-hire': 'success',
      'hire': 'primary',
      'maybe': 'warning',
      'no-hire': 'error',
    };
    return variants[recommendation] || 'default';
  };

  const renderScoreStars = (score: number) => {
    const stars = Math.round(score / 20); // Convert 0-100 to 0-5 stars
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= stars ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (candidate: Candidate) => (
        <span className="font-medium">
          {candidate.resumeData?.fileName?.replace('.pdf', '') || 'Unknown'}
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (candidate: Candidate) => (
        <div className="flex space-x-1">
          {candidate.resumeData?.contactInfo?.email && (
            <button
              title={candidate.resumeData.contactInfo.email}
              className="p-1 text-gray-400 hover:text-blue-600"
            >
              <Mail className="w-4 h-4" />
            </button>
          )}
          {candidate.resumeData?.contactInfo?.phone && (
            <button
              title={candidate.resumeData.contactInfo.phone}
              className="p-1 text-gray-400 hover:text-green-600"
            >
              <Phone className="w-4 h-4" />
            </button>
          )}
          {candidate.resumeData?.contactInfo?.linkedInUrl && (
            <button
              title="LinkedIn Profile"
              className="p-1 text-gray-400 hover:text-blue-600"
            >
              <Linkedin className="w-4 h-4" />
            </button>
          )}
          {candidate.resumeData?.contactInfo?.githubUrl && (
            <button
              title="GitHub Profile"
              className="p-1 text-gray-400 hover:text-gray-900"
            >
              <Github className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      render: (candidate: Candidate) => (
        <Badge variant={getStageVariant(candidate.processingStage)} size="sm">
          {candidate.processingStage}
        </Badge>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      render: (candidate: Candidate) => (
        <span className="font-bold">
          {candidate.finalScore?.compositeScore?.toFixed(1) || 'N/A'}
        </span>
      ),
    },
    {
      key: 'recommendation',
      header: 'Recommendation',
      render: (candidate: Candidate) => (
        candidate.finalScore?.recommendation ? (
          <Badge variant={getRecommendationVariant(candidate.finalScore.recommendation)} size="sm">
            {candidate.finalScore.recommendation}
          </Badge>
        ) : null
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (candidate: Candidate) => (
        <div className="flex space-x-1">
          <button
            onClick={() => handleViewDetails(candidate)}
            className="p-1 text-gray-400 hover:text-blue-600"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleExportReport(candidate.id, 'pdf')}
            className="p-1 text-gray-400 hover:text-green-600"
            title="Export PDF"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Candidate Dashboard</h1>

      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardContent>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              label="Job Profile"
              value={filters.jobProfileId}
              onChange={(e) => handleFilterChange('jobProfileId', e.target.value)}
            >
              <option value="">All Profiles</option>
              {jobProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.title}
                </option>
              ))}
            </Select>

            <Select
              label="Processing Stage"
              value={filters.stage}
              onChange={(e) => handleFilterChange('stage', e.target.value)}
            >
              <option value="">All Stages</option>
              <option value="resume">Resume Processing</option>
              <option value="ai-analysis">AI Analysis</option>
              <option value="linkedin">LinkedIn Analysis</option>
              <option value="github">GitHub Analysis</option>
              <option value="interview">Interview</option>
              <option value="scoring">Scoring</option>
              <option value="completed">Completed</option>
            </Select>

            <Input
              label="Minimum Score"
              type="number"
              value={filters.minScore}
              onChange={(e) => handleFilterChange('minScore', e.target.value)}
              min="0"
              max="100"
            />

            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">
          {totalCandidates} Candidates Found
        </h2>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Refresh
        </Button>
      </div>

      {/* Data Table */}
      <DataTable
        data={candidates}
        columns={columns}
        loading={loading}
        pagination={{
          page,
          pageSize,
          total: totalCandidates,
          onPageChange: setPage,
        }}
      />

      {/* Candidate Details Modal */}
      <Modal
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title="Candidate Details"
        size="lg"
      >
        {selectedCandidate && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">
              {selectedCandidate.resumeData?.fileName?.replace('.pdf', '') || 'Unknown'}
            </h3>
            
            {/* Contact Information */}
            <Card>
              <CardContent>
                <h4 className="font-medium text-gray-900 mb-3">Contact Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Email:</span>{' '}
                    {selectedCandidate.resumeData?.contactInfo?.email || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">Phone:</span>{' '}
                    {selectedCandidate.resumeData?.contactInfo?.phone || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">LinkedIn:</span>{' '}
                    {selectedCandidate.resumeData?.contactInfo?.linkedInUrl || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">GitHub:</span>{' '}
                    {selectedCandidate.resumeData?.contactInfo?.githubUrl || 'N/A'}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Scores */}
            {selectedCandidate.finalScore && (
              <Card>
                <CardContent>
                  <h4 className="font-medium text-gray-900 mb-3">Scoring Results</h4>
                  <div className="flex items-center space-x-4 mb-4">
                    <span className="text-3xl font-bold">
                      {selectedCandidate.finalScore.compositeScore.toFixed(1)}
                    </span>
                    {renderScoreStars(selectedCandidate.finalScore.compositeScore)}
                    <Badge variant={getRecommendationVariant(selectedCandidate.finalScore.recommendation)}>
                      {selectedCandidate.finalScore.recommendation}
                    </Badge>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Stage</th>
                          <th className="text-right py-2">Score</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        <tr className="border-b">
                          <td className="py-2">Resume Analysis</td>
                          <td className="text-right py-2">
                            {selectedCandidate.finalScore.stageScores.resumeAnalysis.toFixed(1)}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2">LinkedIn Analysis</td>
                          <td className="text-right py-2">
                            {selectedCandidate.finalScore.stageScores.linkedInAnalysis.toFixed(1)}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2">GitHub Analysis</td>
                          <td className="text-right py-2">
                            {selectedCandidate.finalScore.stageScores.githubAnalysis.toFixed(1)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2">Interview Performance</td>
                          <td className="text-right py-2">
                            {selectedCandidate.finalScore.stageScores.interviewPerformance.toFixed(1)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Processing Status */}
            <Card>
              <CardContent>
                <h4 className="font-medium text-gray-900 mb-3">Processing Status</h4>
                <div className="space-y-2">
                  <Badge variant={getStageVariant(selectedCandidate.processingStage)}>
                    {selectedCandidate.processingStage}
                  </Badge>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Created:</span>{' '}
                    {new Date(selectedCandidate.createdAt).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
          <Button variant="outline" onClick={() => setDetailsOpen(false)}>
            Close
          </Button>
          {selectedCandidate && (
            <>
              <Button
                variant="outline"
                onClick={() => handleExportReport(selectedCandidate.id, 'pdf')}
              >
                Export PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExportReport(selectedCandidate.id, 'csv')}
              >
                Export CSV
              </Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default CandidateDashboard;