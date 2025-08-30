# Report Generation Service

## Overview

The Report Generation Service provides comprehensive reporting capabilities for the Job Candidate Filtering Funnel System. It generates detailed reports for individual candidates and batch processing summaries in both PDF and CSV formats.

## Features

### Individual Candidate Reports
- Comprehensive candidate assessment reports
- PDF generation with professional formatting
- Handles incomplete analysis sections gracefully
- Includes all analysis results, scores, and recommendations

### Batch Summary Reports
- Processing statistics and performance metrics
- Top candidates ranking
- Batch completion status
- PDF export for executive summaries

### CSV Export
- Structured data export for further analysis
- Configurable field selection
- Handles missing data gracefully
- Compatible with spreadsheet applications

## API Endpoints

### Generate Candidate PDF Report
```
POST /api/reports/candidate/:candidateId/pdf
```

**Request Body:**
```json
{
  "candidate": {
    "id": "candidate-1",
    "resumeData": { ... },
    "aiAnalysis": { ... },
    "linkedInAnalysis": { ... },
    "githubAnalysis": { ... },
    "interviewSession": { ... },
    "finalScore": { ... },
    "processingStage": "completed",
    "createdAt": "2024-01-10T09:00:00Z",
    "updatedAt": "2024-01-15T15:00:00Z"
  },
  "jobProfile": {
    "id": "job-1",
    "title": "Senior Software Engineer",
    "description": "Looking for experienced software engineer",
    "requiredSkills": ["JavaScript", "React", "Node.js"],
    "experienceLevel": "Senior",
    "scoringWeights": { ... },
    "interviewQuestions": [ ... ]
  },
  "interviewAnalysis": {
    "candidateId": "candidate-1",
    "performanceScore": 80,
    "communicationScore": 85,
    "technicalScore": 75,
    "detailedFeedback": { ... }
  }
}
```

**Response:**
```json
{
  "success": true,
  "filePath": "reports/candidate_candidate-1_1642234567890.pdf",
  "message": "Candidate PDF report generated successfully"
}
```

### Generate Batch Summary PDF
```
POST /api/reports/batch/:batchId/pdf
```

**Request Body:**
```json
{
  "batch": {
    "id": "batch-1",
    "jobProfileId": "job-1",
    "totalCandidates": 100,
    "processedCandidates": 95,
    "failedCandidates": 5,
    "status": "completed",
    "startedAt": "2024-01-10T08:00:00Z",
    "completedAt": "2024-01-15T16:00:00Z"
  },
  "candidates": [ ... ],
  "jobProfile": { ... },
  "interviewAnalyses": [ ... ]
}
```

### Export Candidates to CSV
```
POST /api/reports/candidates/csv
```

**Request Body:**
```json
{
  "candidates": [ ... ],
  "jobProfile": { ... },
  "interviewAnalyses": [ ... ]
}
```

### Get Candidate Report Data
```
POST /api/reports/candidate/:candidateId/data
```

Returns structured report data without generating PDF.

### Get Batch Summary Data
```
POST /api/reports/batch/:batchId/data
```

Returns structured batch summary data without generating PDF.

### Download Report File
```
GET /api/reports/download/:filename
```

Downloads a previously generated report file.

## Report Sections

### Candidate Report Sections

1. **Header Information**
   - Candidate identification
   - Job position details
   - Report generation timestamp

2. **Contact Information**
   - Resume file name
   - Email and phone
   - LinkedIn and GitHub URLs
   - Project links

3. **Processing Status**
   - Resume processing status
   - AI analysis completion
   - LinkedIn analysis status
   - GitHub analysis status
   - Interview completion
   - Final scoring status

4. **Final Scores**
   - Composite score with visual indicators
   - Individual stage scores
   - Applied weights
   - Final recommendation

5. **AI Resume Analysis**
   - AI provider used
   - Relevance score
   - Skills match/missing analysis
   - Experience assessment
   - Analysis reasoning

6. **LinkedIn Analysis**
   - Profile accessibility
   - Professional score
   - Experience details
   - Network statistics
   - Credibility indicators

7. **GitHub Analysis**
   - Technical score
   - Profile statistics
   - Project authenticity verification
   - Skills evidence

8. **Interview Analysis**
   - Interview session details
   - Performance scores
   - Communication assessment
   - Technical evaluation
   - Detailed feedback

9. **Final Recommendation**
   - Hiring recommendation
   - Reasoning
   - Candidate ranking

### Batch Summary Sections

1. **Processing Statistics**
   - Total candidates processed
   - Success/failure rates
   - Average scores
   - Processing time

2. **Top Candidates Table**
   - Ranked candidate list
   - Key metrics summary
   - Contact information

3. **Job Profile Details**
   - Position requirements
   - Scoring weights used
   - Interview questions

## Data Handling

### Incomplete Analysis Handling

The service gracefully handles incomplete candidate data:

- **Missing AI Analysis**: Shows "Analysis not yet completed" message
- **Missing LinkedIn Data**: Indicates "LinkedIn analysis not available"
- **Missing GitHub Data**: Shows "GitHub analysis not completed"
- **Missing Interview**: Displays "Interview not scheduled/completed"
- **Missing Scores**: Shows "Scoring not yet available"

### Error Handling

- **PDF Generation Errors**: Returns detailed error messages
- **File System Errors**: Handles directory creation and file access issues
- **Data Validation**: Validates required fields before processing
- **Browser Launch Failures**: Handles Puppeteer initialization errors

## File Management

### Report Storage
- Reports are stored in the `reports/` directory
- Files are named with timestamps for uniqueness
- Automatic directory creation if not exists

### File Naming Conventions
- Candidate PDFs: `candidate_{candidateId}_{timestamp}.pdf`
- Batch PDFs: `batch_summary_{batchId}_{timestamp}.pdf`
- CSV exports: `candidates_export_{timestamp}.csv`

## Performance Considerations

### PDF Generation
- Uses headless Chromium via Puppeteer
- Optimized for A4 format with proper margins
- Includes print-friendly CSS styling
- Timeout handling for large reports

### Memory Management
- Proper browser cleanup after PDF generation
- Streaming for large CSV exports
- Efficient HTML template generation

### Concurrent Processing
- Service supports multiple simultaneous report generations
- File naming prevents conflicts
- Thread-safe operations

## Usage Examples

### Generate Individual Report
```typescript
import { ReportGenerationService } from '../services/reportGenerationService';

const reportService = new ReportGenerationService();

// Generate PDF report
const pdfPath = await reportService.generateCandidatePDF(
  candidate,
  jobProfile,
  interviewAnalysis
);

// Generate report data only
const reportData = await reportService.generateCandidateReport(
  candidate,
  jobProfile,
  interviewAnalysis
);
```

### Generate Batch Summary
```typescript
// Generate batch PDF
const batchPdfPath = await reportService.generateBatchSummaryPDF(
  batch,
  candidates,
  jobProfile,
  interviewAnalyses
);

// Export to CSV
const csvPath = await reportService.exportCandidatesCSV(
  candidates,
  jobProfile,
  interviewAnalyses
);
```

## Dependencies

- **puppeteer**: PDF generation via headless Chrome
- **csv-writer**: CSV file generation
- **fs/promises**: File system operations
- **path**: File path management

## Configuration

### PDF Settings
- Format: A4
- Margins: 20mm top/bottom, 15mm left/right
- Print background: Enabled
- Wait for network idle before generation

### CSV Settings
- UTF-8 encoding
- Standard comma separation
- Header row included
- Proper escaping for special characters

## Error Codes

- **400**: Missing required data (candidate, job profile)
- **404**: Report file not found for download
- **500**: PDF generation failure, file system errors, service errors

## Testing

The service includes comprehensive test coverage:

- Unit tests for all public methods
- PDF generation validation
- CSV export verification
- Error handling scenarios
- Incomplete data handling
- File cleanup procedures

Run tests with:
```bash
npm test -- reportGenerationService.test.ts
```