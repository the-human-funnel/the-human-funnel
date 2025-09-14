# The Human Funnel API Documentation

## Overview
The Human Funnel is a comprehensive candidate filtering and analysis system that processes resumes, conducts AI-powered analysis, and provides intelligent ranking of candidates.

## Base URL
```
http://localhost:3000/api
```

## Authentication
Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/logout` - User logout

### Job Profiles
- `GET /job-profiles` - Get all job profiles
- `POST /job-profiles` - Create a new job profile
- `GET /job-profiles/:id` - Get specific job profile
- `PUT /job-profiles/:id` - Update job profile
- `DELETE /job-profiles/:id` - Delete job profile

### Resume Processing
- `POST /resumes/upload` - Upload resume files
- `POST /resumes/batch-upload` - Upload multiple resumes
- `GET /resumes/:id` - Get resume data
- `POST /resumes/:id/reprocess` - Reprocess a resume

### Candidates
- `GET /candidates` - Get all candidates with filtering
- `GET /candidates/:id` - Get specific candidate
- `PUT /candidates/:id` - Update candidate information
- `DELETE /candidates/:id` - Delete candidate

### AI Analysis
- `POST /ai-analysis/analyze-resume` - Analyze resume with AI
- `GET /ai-analysis/:candidateId` - Get AI analysis results
- `POST /ai-analysis/batch-analyze` - Batch analyze multiple candidates

### LinkedIn Analysis
- `POST /linkedin/analyze-profile` - Analyze LinkedIn profile
- `GET /linkedin/:candidateId` - Get LinkedIn analysis results

### GitHub Analysis
- `POST /github-analysis/analyze-profile` - Analyze GitHub profile
- `GET /github-analysis/:candidateId` - Get GitHub analysis results

### Interview Management
- `POST /vapi/schedule-interview` - Schedule AI interview
- `GET /vapi/interview/:id/status` - Get interview status
- `POST /interview-analysis/analyze-transcript` - Analyze interview transcript

### Scoring & Ranking
- `POST /scoring/calculate-scores` - Calculate candidate scores
- `GET /scoring/rankings/:jobProfileId` - Get candidate rankings
- `POST /scoring/batch-score` - Batch score multiple candidates

### Reports
- `GET /reports/candidate-summary/:id` - Get candidate summary report
- `GET /reports/batch-analysis/:batchId` - Get batch analysis report
- `POST /reports/generate-comparison` - Generate candidate comparison report

### System & Health
- `GET /health` - System health check
- `GET /system/health` - Comprehensive system health
- `GET /system/validation/:jobProfileId` - Validate system requirements
- `GET /performance/metrics` - Get performance metrics
- `DELETE /performance/cache` - Clear system cache

### Queue Management
- `GET /queues/status` - Get queue status
- `POST /queues/process-batch` - Process candidate batch
- `GET /queues/jobs/:id` - Get specific job status

## Response Format
All API responses follow this format:
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Optional message",
  "timestamp": "2025-01-12T22:15:00.000Z"
}
```

## Error Format
Error responses follow this format:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-01-12T22:15:00.000Z"
}
```

## Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting
API requests are rate-limited based on the endpoint:
- Authentication: 5 requests per minute
- File uploads: 10 requests per minute
- General API: 100 requests per minute
- AI analysis: 50 requests per minute

## WebSocket Events
The system supports real-time updates via WebSocket:
- `batch-progress` - Batch processing updates
- `candidate-analyzed` - Individual candidate analysis completion
- `system-alert` - System health alerts

## Example Usage

### Upload and Process Resume
```bash
# 1. Upload resume
curl -X POST http://localhost:3000/api/resumes/upload \
  -H "Authorization: Bearer <token>" \
  -F "resume=@resume.pdf" \
  -F "jobProfileId=12345"

# 2. Analyze with AI
curl -X POST http://localhost:3000/api/ai-analysis/analyze-resume \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"candidateId": "67890", "jobProfileId": "12345"}'

# 3. Get results
curl -X GET http://localhost:3000/api/candidates/67890 \
  -H "Authorization: Bearer <token>"
```

### Batch Processing
```bash
# Start batch processing
curl -X POST http://localhost:3000/api/queues/process-batch \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "jobProfileId": "12345",
    "candidateIds": ["67890", "67891", "67892"],
    "analysisTypes": ["ai", "linkedin", "github"]
  }'
```

## Environment Variables
Required environment variables:
- `MONGODB_URI` - MongoDB connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `OPENAI_API_KEY` - OpenAI API key
- `CLAUDE_API_KEY` - Anthropic Claude API key
- `GEMINI_API_KEY` - Google Gemini API key
- `GITHUB_TOKEN` - GitHub API token
- `LINKEDIN_SCRAPER_API_KEY` - LinkedIn scraper API key
- `VAPI_API_KEY` - VAPI interview API key