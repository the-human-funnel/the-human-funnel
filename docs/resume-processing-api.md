# Resume Processing API Documentation

## Overview

The Resume Processing Service provides functionality to extract text and contact information from PDF resumes, with support for both single file and batch processing operations.

## Features

- **PDF Text Extraction**: Extract text content from PDF files using pdf-parse library
- **Contact Information Parsing**: Automatically extract emails, phone numbers, LinkedIn URLs, GitHub URLs, and project URLs
- **Batch Processing**: Process up to 10,000 resumes simultaneously with progress tracking
- **Error Handling**: Graceful handling of invalid files with detailed error reporting
- **Progress Tracking**: Real-time progress updates for batch operations

## API Endpoints

### Upload Single Resume

**POST** `/api/resumes/upload-single`

Upload and process a single PDF resume.

**Request:**
- Content-Type: `multipart/form-data`
- Body: Form data with `resume` field containing PDF file

**Response:**
```json
{
  "message": "Resume processed successfully",
  "resumeData": {
    "id": "uuid",
    "fileName": "resume.pdf",
    "extractedText": "Full text content...",
    "contactInfo": {
      "email": "user@example.com",
      "phone": "(555) 123-4567",
      "linkedInUrl": "https://linkedin.com/in/profile",
      "githubUrl": "https://github.com/username",
      "projectUrls": ["https://portfolio.com", "https://project.dev"]
    },
    "processingStatus": "completed",
    "extractionErrors": []
  }
}
```

### Upload Batch of Resumes

**POST** `/api/resumes/upload-batch`

Upload and process multiple PDF resumes (up to 10,000 files).

**Request:**
- Content-Type: `multipart/form-data`
- Body: 
  - `resumes`: Array of PDF files
  - `jobProfileId`: String - ID of the job profile for processing

**Response:**
```json
{
  "message": "Batch processing started",
  "batchId": "uuid",
  "totalFiles": 150,
  "status": "processing"
}
```

### Get Batch Progress

**GET** `/api/resumes/batch/:batchId/progress`

Get real-time progress for a batch processing operation.

**Response:**
```json
{
  "batchId": "uuid",
  "totalFiles": 150,
  "processedFiles": 75,
  "failedFiles": 2,
  "currentFile": "resume_073.pdf",
  "progress": 50,
  "status": "processing"
}
```

### Get Active Batches

**GET** `/api/resumes/batches/active`

Get all currently active batch processing operations.

**Response:**
```json
{
  "activeBatches": [
    {
      "batchId": "uuid1",
      "totalFiles": 100,
      "processedFiles": 45,
      "failedFiles": 1,
      "progress": 45,
      "status": "processing"
    }
  ],
  "count": 1
}
```

### Cancel Batch Processing

**DELETE** `/api/resumes/batch/:batchId`

Cancel an active batch processing operation.

**Response:**
```json
{
  "message": "Batch cancelled successfully",
  "batchId": "uuid"
}
```

## Contact Information Extraction

The service automatically extracts the following contact information from resume text:

### Email Addresses
- Supports standard email formats
- Returns the first email found in the document

### Phone Numbers
- Supports multiple formats:
  - `(555) 123-4567`
  - `555-123-4567`
  - `555.123.4567`
  - `555 123 4567`
  - `+1 555 123 4567`

### LinkedIn URLs
- Matches various LinkedIn profile URL formats:
  - `https://www.linkedin.com/in/profile`
  - `http://linkedin.com/in/profile`
  - `linkedin.com/in/profile`

### GitHub URLs
- Matches GitHub profile URLs:
  - `https://github.com/username`
  - `http://www.github.com/username`
  - `github.com/username`

### Project URLs
- Extracts all HTTP/HTTPS URLs except LinkedIn and GitHub
- Filters out mailto links
- Returns array of unique project URLs

## Error Handling

### File Upload Errors
- **400 Bad Request**: No files uploaded or missing job profile ID
- **413 Payload Too Large**: File size exceeds 10MB limit
- **415 Unsupported Media Type**: Non-PDF files uploaded

### Processing Errors
- **500 Internal Server Error**: PDF parsing failures or system errors
- **404 Not Found**: Batch not found for progress/cancel requests

### Batch Processing Errors
- Individual file failures don't stop batch processing
- Failed files are tracked with error details
- Batch continues processing remaining files

## Usage Examples

### Single Resume Upload (JavaScript)

```javascript
const formData = new FormData();
formData.append('resume', pdfFile);

const response = await fetch('/api/resumes/upload-single', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Extracted contact info:', result.resumeData.contactInfo);
```

### Batch Upload with Progress Tracking

```javascript
// Start batch upload
const formData = new FormData();
files.forEach(file => formData.append('resumes', file));
formData.append('jobProfileId', 'job-123');

const uploadResponse = await fetch('/api/resumes/upload-batch', {
  method: 'POST',
  body: formData
});

const { batchId } = await uploadResponse.json();

// Track progress
const progressInterval = setInterval(async () => {
  const progressResponse = await fetch(`/api/resumes/batch/${batchId}/progress`);
  const progress = await progressResponse.json();
  
  console.log(`Progress: ${progress.progress}%`);
  
  if (progress.status === 'completed') {
    clearInterval(progressInterval);
    console.log('Batch processing completed!');
  }
}, 1000);
```

## Performance Considerations

- **File Size Limit**: 10MB per PDF file
- **Batch Size Limit**: Maximum 10,000 files per batch
- **Processing Speed**: Approximately 1-2 seconds per resume
- **Memory Usage**: Processes files sequentially to manage memory
- **Concurrent Batches**: Multiple batches can run simultaneously

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **Requirement 2.1**: Bulk resume processing up to 10,000 files
- **Requirement 2.2**: Text extraction from PDF files
- **Requirement 2.3**: Contact information parsing (phone, email, URLs)
- **Requirement 2.4**: Batch processing with progress tracking and error handling