import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
} from '@mui/material';
import { useDropzone } from 'react-dropzone';
import { CloudUpload, Delete, Description, CheckCircle, Error } from '@mui/icons-material';
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
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'uploading':
        return <LinearProgress />;
      default:
        return <Description />;
    }
  };

  const getStatusColor = (status: string) => {
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
    <Box>
      <Typography variant="h4" gutterBottom>
        Upload Resumes
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Select Job Profile</InputLabel>
            <Select
              value={selectedJobProfile}
              onChange={(e) => setSelectedJobProfile(e.target.value)}
              disabled={uploading}
            >
              {jobProfiles.map((profile) => (
                <MenuItem key={profile.id} value={profile.id}>
                  {profile.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box
            {...getRootProps()}
            sx={{
              border: '2px dashed',
              borderColor: isDragActive ? 'primary.main' : 'grey.300',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: 'action.hover',
              },
            }}
          >
            <input {...getInputProps()} />
            <CloudUpload sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {isDragActive
                ? 'Drop the PDF files here...'
                : 'Drag & drop PDF files here, or click to select'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Supports PDF files up to 10MB each. You can upload multiple files at once.
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Selected Files ({files.length})
              </Typography>
              <Box>
                <Button onClick={clearFiles} disabled={uploading} sx={{ mr: 1 }}>
                  Clear All
                </Button>
                <Button
                  variant="contained"
                  onClick={handleUpload}
                  disabled={uploading || !selectedJobProfile}
                  startIcon={<CloudUpload />}
                >
                  {uploading ? 'Uploading...' : 'Upload Resumes'}
                </Button>
              </Box>
            </Box>

            {uploading && (
              <Box sx={{ mb: 2 }}>
                <LinearProgress variant="determinate" value={uploadProgress} />
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                  Uploading... {uploadProgress}%
                </Typography>
              </Box>
            )}

            <List>
              {files.map((fileWithStatus, index) => (
                <ListItem
                  key={index}
                  secondaryAction={
                    !uploading && (
                      <IconButton onClick={() => removeFile(index)}>
                        <Delete />
                      </IconButton>
                    )
                  }
                >
                  <ListItemIcon>
                    {getStatusIcon(fileWithStatus.status)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body1">
                          {fileWithStatus.file.name}
                        </Typography>
                        <Chip
                          label={fileWithStatus.status}
                          size="small"
                          color={getStatusColor(fileWithStatus.status) as any}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Size: {formatFileSize(fileWithStatus.file.size)}
                        </Typography>
                        {fileWithStatus.error && (
                          <Typography variant="body2" color="error">
                            Error: {fileWithStatus.error}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Upload Guidelines
          </Typography>
          <Typography variant="body2" component="div">
            <ul>
              <li>Only PDF files are supported</li>
              <li>Maximum file size: 10MB per file</li>
              <li>You can upload up to 10,000 resumes in a single batch</li>
              <li>Make sure to select a job profile before uploading</li>
              <li>Processing will begin automatically after upload</li>
              <li>You can track progress in the "Processing Status" tab</li>
            </ul>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ResumeUploader;