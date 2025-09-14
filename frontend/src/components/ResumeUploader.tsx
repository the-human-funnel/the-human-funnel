import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Trash2, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import Button from './ui/Button';
import Select from './ui/Select';
import Alert from './ui/Alert';
import Badge from './ui/Badge';
import ProgressBar from './ui/ProgressBar';
import { jobProfileApi, resumeApi, JobProfile } from '../services/api';

interface FileWithStatus {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

const ResumeUploader: React.FC = () => {
  const [jobProfiles, setJobProfiles] = useState<JobProfile[]>([]);
  const [selectedJobProfile, setSelectedJobProfile] = useState('');
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadJobProfiles();
  }, []);

  const loadJobProfiles = async () => {
    try {
      const response = await jobProfileApi.getAll();
      setJobProfiles(response.data);
    } catch (err) {
      setError('Failed to load job profiles');
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      status: 'pending' as const,
    }));
    setFiles(prev => [...prev, ...newFiles]);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: true,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setFiles([]);
    setError(null);
    setSuccess(null);
  };

  const handleUpload = async () => {
    if (!selectedJobProfile) {
      setError('Please select a job profile');
      return;
    }

    if (files.length === 0) {
      setError('Please select files to upload');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('jobProfileId', selectedJobProfile);
      
      files.forEach((fileWithStatus, index) => {
        formData.append('resumes', fileWithStatus.file);
      });

      // Update file statuses to uploading
      setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' })));

      const response = await resumeApi.uploadBatch(formData);
      
      // Update file statuses to success
      setFiles(prev => prev.map(f => ({ ...f, status: 'success' })));
      setUploadProgress(100);
      setSuccess(`Successfully uploaded ${files.length} resumes. Batch ID: ${response.data.batchId}`);
      
      // Clear files after successful upload
      setTimeout(() => {
        clearFiles();
      }, 3000);

    } catch (err: any) {
      setFiles(prev => prev.map(f => ({ 
        ...f, 
        status: 'error',
        error: err.response?.data?.message || 'Upload failed'
      })));
      setError(err.response?.data?.message || 'Failed to upload resumes');
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'uploading':
        return <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      default:
        return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'uploading':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Upload Resumes</h1>

      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          {success}
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-6">
          <Select
            label="Select Job Profile"
            value={selectedJobProfile}
            onChange={(e) => setSelectedJobProfile(e.target.value)}
            disabled={uploading}
          >
            <option value="">Select a job profile</option>
            {jobProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.title}
              </option>
            ))}
          </Select>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-blue-500 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {isDragActive
                ? 'Drop the PDF files here...'
                : 'Drag & drop PDF files here, or click to select'}
            </h3>
            <p className="text-gray-500">
              Supports PDF files up to 10MB each. You can upload multiple files at once.
            </p>
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Selected Files ({files.length})
              </h3>
              <div className="space-x-2">
                <Button variant="outline" onClick={clearFiles} disabled={uploading}>
                  Clear All
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={uploading || !selectedJobProfile}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload Resumes'}
                </Button>
              </div>
            </div>

            {uploading && (
              <div className="mb-4">
                <ProgressBar value={uploadProgress} showLabel />
                <p className="text-center text-sm text-gray-500 mt-2">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}

            <div className="space-y-3">
              {files.map((fileWithStatus, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(fileWithStatus.status)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          {fileWithStatus.file.name}
                        </span>
                        <Badge variant={getStatusVariant(fileWithStatus.status)} size="sm">
                          {fileWithStatus.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        Size: {formatFileSize(fileWithStatus.file.size)}
                        {fileWithStatus.error && (
                          <span className="text-red-600 ml-2">
                            Error: {fileWithStatus.error}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {!uploading && (
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            Upload Guidelines
          </h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Only PDF files are supported</li>
            <li>• Maximum file size: 10MB per file</li>
            <li>• You can upload up to 10,000 resumes in a single batch</li>
            <li>• Make sure to select a job profile before uploading</li>
            <li>• Processing will begin automatically after upload</li>
            <li>• You can track progress in the "Processing Status" tab</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResumeUploader;