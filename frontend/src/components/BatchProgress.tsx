import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Download,
  Eye,
  CheckCircle,
  AlertCircle,
  Clock,
  Play,
} from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import Button from './ui/Button';
import Alert from './ui/Alert';
import Badge from './ui/Badge';
import Modal from './ui/Modal';
import ProgressBar from './ui/ProgressBar';
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

  const getStatusVariant = (status: string) => {
    const variants: { [key: string]: any } = {
      'processing': 'warning',
      'completed': 'success',
      'failed': 'error',
    };
    return variants[status] || 'default';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <Play className="w-4 h-4 text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Processing Status</h1>
        <div className="flex space-x-2">
          <Button
            variant={autoRefresh ? 'primary' : 'outline'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            Auto Refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button
            variant="outline"
            onClick={loadBatches}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent>
            <div className="text-sm text-gray-600">Total Batches</div>
            <div className="text-3xl font-bold text-gray-900">{batches.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-gray-600">Processing</div>
            <div className="text-3xl font-bold text-yellow-600">
              {batches.filter(b => b.status === 'processing').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-gray-600">Completed</div>
            <div className="text-3xl font-bold text-green-600">
              {batches.filter(b => b.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-gray-600">Failed</div>
            <div className="text-3xl font-bold text-red-600">
              {batches.filter(b => b.status === 'failed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch List */}
      <Card>
        <CardContent>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Processing Batches</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4">Batch ID</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Progress</th>
                  <th className="text-left py-3 px-4">Candidates</th>
                  <th className="text-left py-3 px-4">Duration</th>
                  <th className="text-left py-3 px-4">Rate</th>
                  <th className="text-left py-3 px-4">ETA</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {batch.id.substring(0, 8)}...
                      </code>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(batch.status)}
                        <Badge variant={getStatusVariant(batch.status)} size="sm">
                          {batch.status}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-24">
                        <ProgressBar
                          value={calculateProgress(batch)}
                          className="mb-1"
                        />
                        <div className="text-xs text-center text-gray-500">
                          {calculateProgress(batch).toFixed(1)}%
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm">
                        {batch.processedCandidates} / {batch.totalCandidates}
                        {batch.failedCandidates > 0 && (
                          <div className="text-xs text-red-600">
                            {batch.failedCandidates} failed
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {formatDuration(batch.startedAt, batch.completedAt)}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {getProcessingRate(batch)} /hr
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {getEstimatedCompletion(batch)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleViewDetails(batch)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {batch.status === 'completed' && (
                          <button
                            onClick={() => handleExportBatch(batch.id, 'pdf')}
                            className="p-1 text-gray-400 hover:text-green-600"
                            title="Export PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Batch Details Modal */}
      <Modal
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title="Batch Details"
        size="lg"
      >
        {selectedBatch && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Batch ID:</span>
                <code className="block text-xs bg-gray-100 p-1 rounded mt-1">
                  {selectedBatch.id}
                </code>
              </div>
              <div>
                <span className="font-medium text-gray-700">Job Profile ID:</span>
                <code className="block text-xs bg-gray-100 p-1 rounded mt-1">
                  {selectedBatch.jobProfileId}
                </code>
              </div>
              <div>
                <span className="font-medium text-gray-700">Status:</span>
                <div className="mt-1">
                  <Badge variant={getStatusVariant(selectedBatch.status)} size="sm">
                    {selectedBatch.status}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Progress:</span>
                <div className="mt-1">
                  <ProgressBar value={calculateProgress(selectedBatch)} showLabel />
                  <div className="text-xs text-gray-500 mt-1">
                    {selectedBatch.processedCandidates} / {selectedBatch.totalCandidates} candidates
                  </div>
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Started:</span>
                <div className="text-gray-600 mt-1">
                  {new Date(selectedBatch.startedAt).toLocaleString()}
                </div>
              </div>
              {selectedBatch.completedAt && (
                <div>
                  <span className="font-medium text-gray-700">Completed:</span>
                  <div className="text-gray-600 mt-1">
                    {new Date(selectedBatch.completedAt).toLocaleString()}
                  </div>
                </div>
              )}
              <div>
                <span className="font-medium text-gray-700">Processing Rate:</span>
                <div className="text-gray-600 mt-1">
                  {getProcessingRate(selectedBatch)} candidates/hour
                </div>
              </div>
              {selectedBatch.failedCandidates > 0 && (
                <div>
                  <span className="font-medium text-gray-700">Failed Candidates:</span>
                  <div className="text-red-600 mt-1">
                    {selectedBatch.failedCandidates}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
          <Button variant="outline" onClick={() => setDetailsOpen(false)}>
            Close
          </Button>
          {selectedBatch && selectedBatch.status === 'completed' && (
            <>
              <Button
                variant="outline"
                onClick={() => handleExportBatch(selectedBatch.id, 'pdf')}
              >
                Export PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExportBatch(selectedBatch.id, 'csv')}
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

export default BatchProgress;