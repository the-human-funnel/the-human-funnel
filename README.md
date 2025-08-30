# Job Candidate Filtering Funnel System

An AI-powered recruitment tool that automates the candidate screening process for companies. The system processes large volumes of resumes and filters candidates based on job requirements through comprehensive multi-stage analysis including resume processing, AI analysis, LinkedIn/GitHub profile evaluation, and automated phone interviews.

## Features

### Core Analysis Pipeline
- **Resume Processing**: PDF text extraction with contact information parsing
- **AI Analysis**: Multi-provider AI resume analysis (Gemini, OpenAI, Claude) with automatic fallback
- **LinkedIn Analysis**: Professional profile evaluation and credibility scoring
- **GitHub Analysis**: Technical skills assessment and project authenticity verification
- **VAPI Interviews**: Automated AI-powered phone interviews with transcript analysis
- **Interview Analysis**: AI-powered transcript evaluation with detailed scoring and feedback
- **Comprehensive Scoring**: Weighted scoring system combining all analysis stages with intelligent normalization
- **Candidate Ranking**: Advanced ranking algorithms with customizable thresholds and filtering
- **Report Generation**: Professional PDF reports and CSV exports for candidates and batch summaries

### Candidate Management System
- **Advanced Search & Filtering**: Multi-criteria candidate search with pagination and sorting
- **Processing Status Tracking**: Real-time monitoring of candidate progress through analysis stages
- **Batch Processing Management**: Track and monitor large-scale candidate processing operations
- **Data Export**: Flexible CSV and JSON export with customizable fields and filtering
- **Top Candidates Identification**: Automated ranking and selection of highest-scoring candidates

### Advanced Capabilities
- **Multi-Provider AI**: Automatic fallback between AI providers for reliability
- **Batch Processing**: Handle hundreds of candidates simultaneously with Redis-backed job queues
- **Real-time Progress**: Track processing status across all analysis stages
- **Quality Assessment**: Automatic quality validation for transcripts and profiles
- **Manual Review Flags**: Intelligent flagging of candidates requiring human review
- **Intelligent Scoring**: Weighted composite scoring with missing data normalization
- **Advanced Ranking**: Configurable thresholds and stage-specific filtering
- **Professional Reports**: PDF generation with comprehensive candidate assessments
- **Data Export**: CSV export capabilities for external analysis and record keeping
- **Caching Layer**: Redis-powered caching for improved performance and reduced API calls

## Project Structure

```
src/
├── index.ts              # Main application entry point
├── models/               # Data models and TypeScript interfaces
│   ├── interfaces.ts     # Core data interfaces
│   └── schemas.ts        # MongoDB schemas
├── services/             # Business logic services
│   ├── aiAnalysisService.ts        # Multi-provider AI resume analysis
│   ├── githubAnalysisService.ts    # GitHub profile and project analysis
│   ├── linkedInAnalysisService.ts  # LinkedIn professional analysis
│   ├── vapiInterviewService.ts     # VAPI phone interview integration
│   ├── interviewAnalysisService.ts # AI transcript analysis
│   ├── scoringService.ts           # Comprehensive scoring and ranking system
│   ├── reportGenerationService.ts  # PDF and CSV report generation
│   ├── candidateService.ts         # Candidate management and search
│   ├── resumeProcessingService.ts  # PDF processing and text extraction
│   └── jobProfileService.ts        # Job profile management
├── routes/               # API route definitions
│   ├── aiAnalysisRoutes.ts         # AI analysis endpoints
│   ├── githubAnalysisRoutes.ts     # GitHub analysis endpoints
│   ├── linkedInAnalysisRoutes.ts   # LinkedIn analysis endpoints
│   ├── vapiInterviewRoutes.ts      # Interview scheduling endpoints
│   ├── interviewAnalysisRoutes.ts  # Transcript analysis endpoints
│   ├── scoringRoutes.ts            # Scoring and ranking endpoints
│   ├── reportRoutes.ts             # Report generation endpoints
│   └── jobProfileRoutes.ts         # Job profile management endpoints
├── middleware/           # Express middleware
├── queues/               # Job queue definitions and processors
├── test/                 # Comprehensive test suites
└── utils/                # Utility functions and helpers
    ├── config.ts         # Configuration management
    ├── database.ts       # Database connection utilities
    ├── redis.ts          # Redis connection and client management
    ├── logger.ts         # Logging utilities
    └── validation.ts     # Validation utilities

reports/                  # Generated reports directory (auto-created)
├── candidate_*.pdf       # Individual candidate assessment reports
├── batch_summary_*.pdf   # Batch processing summary reports
└── candidates_export_*.csv # CSV data exports
```

## Quick Start

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd job-candidate-filtering-funnel
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual configuration values
   ```

3. **Set up required services:**
   - MongoDB database
   - Redis server (for caching and job queues)
   - AI provider API keys (at least one: Gemini, OpenAI, or Claude)
   - Optional: GitHub token, LinkedIn scraper API, VAPI API key

4. **Build and start:**
   ```bash
   npm run build
   npm start
   ```

6. **Development mode:**
   ```bash
   npm run dev
   ```

## Setup

### Prerequisites
- Node.js 18+ and npm
- MongoDB 4.4+
- Redis 6.0+ (for caching and job queues)
- At least one AI provider API key
- Chrome/Chromium browser (for PDF generation via Puppeteer)

### Installation Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual configuration values
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Start Redis server:**
   ```bash
   # On macOS with Homebrew
   brew services start redis
   
   # On Ubuntu/Debian
   sudo systemctl start redis-server
   
   # Using Docker
   docker run -d -p 6379:6379 redis:latest
   ```

5. **Start the application:**
   ```bash
   npm start
   ```

## Development

- **Development mode with auto-reload:**
  ```bash
  npm run dev
  ```

- **Build project:**
  ```bash
  npm run build
  ```

- **Clean build artifacts:**
  ```bash
  npm run clean
  ```

## Core Dependencies

### Backend Framework
- **Express.js** - Web framework and API server
- **TypeScript** - Type safety and development experience
- **MongoDB** - Database for document storage with comprehensive error handling
- **Mongoose** - MongoDB object modeling with transaction support
- **Redis** - Caching and job queues with connection management
- **Bull Queue** - Job queue system for background processing

### AI and Analysis
- **@google/generative-ai** - Gemini AI integration
- **openai** - OpenAI GPT API integration
- **@anthropic-ai/sdk** - Claude AI integration
- **axios** - HTTP client for external API calls

### Document Processing
- **pdf-parse** - PDF text extraction
- **multer** - File upload handling
- **puppeteer** - PDF report generation via headless Chrome

### Caching and Queues
- **Redis** - In-memory data structure store for caching and job queues
- **Connection Management** - Singleton Redis client with health monitoring and error handling

### Testing
- **Jest** - Testing framework
- **ts-jest** - TypeScript support for Jest

## Environment Variables

See `.env.example` for all required environment variables including:

### Database Connections
- `MONGODB_URI` - MongoDB connection string
- `MONGODB_DB_NAME` - MongoDB database name
- `REDIS_HOST` - Redis server host (default: localhost)
- `REDIS_PORT` - Redis server port (default: 6379)
- `REDIS_PASSWORD` - Redis server password (optional)

### AI Provider API Keys
- `GEMINI_API_KEY` - Google Gemini API key
- `OPENAI_API_KEY` - OpenAI API key
- `CLAUDE_API_KEY` - Anthropic Claude API key

### External Service Configurations
- `GITHUB_TOKEN` - GitHub API token for profile analysis
- `LINKEDIN_SCRAPER_API_KEY` - Third-party LinkedIn scraper API key
- `LINKEDIN_SCRAPER_BASE_URL` - LinkedIn scraper service URL
- `VAPI_API_KEY` - VAPI service API key for phone interviews
- `VAPI_BASE_URL` - VAPI service base URL

### Processing Settings
- `MAX_RETRIES` - Maximum retry attempts for failed operations
- `PROCESSING_TIMEOUT` - Timeout for long-running operations
- `API_RATE_LIMIT` - Rate limiting for API endpoints

## API Services

### Candidate Management API
- **GET** `/api/candidates/:candidateId` - Get candidate by ID with full details
- **POST** `/api/candidates/search` - Advanced candidate search with filters and pagination
- **GET** `/api/candidates/:candidateId/status` - Get detailed processing status for candidate
- **GET** `/api/candidates/batch/:batchId/progress` - Get batch processing progress
- **POST** `/api/candidates/export` - Export candidates data with flexible formatting
- **GET** `/api/candidates/count` - Get candidates count by filters
- **GET** `/api/candidates/top/:jobProfileId` - Get top-scoring candidates for job

### Report Generation API
- **POST** `/api/reports/candidate/:candidateId/pdf` - Generate PDF report for individual candidate
- **POST** `/api/reports/candidate/:candidateId/data` - Get structured candidate report data
- **POST** `/api/reports/batch/:batchId/pdf` - Generate batch summary PDF report
- **POST** `/api/reports/batch/:batchId/data` - Get structured batch summary data
- **POST** `/api/reports/candidates/csv` - Export candidates data to CSV format
- **GET** `/api/reports/download/:filename` - Download generated report files

### Scoring and Ranking API
- **POST** `/api/scoring/candidate/:candidateId` - Calculate comprehensive candidate score
- **GET** `/api/scoring/breakdown/:candidateId/:jobProfileId` - Get detailed scoring breakdown
- **POST** `/api/scoring/rank` - Rank multiple candidates with filtering options
- **POST** `/api/scoring/filter/threshold` - Filter candidates by minimum score
- **POST** `/api/scoring/filter/recommendation` - Filter by recommendation level
- **POST** `/api/scoring/batch` - Batch scoring for multiple candidates

### Resume Processing API
- **POST** `/api/resume-processing/upload` - Upload and process resume files
- **POST** `/api/resume-processing/batch` - Batch process multiple resumes
- **GET** `/api/resume-processing/status/:id` - Check processing status

### AI Analysis API
- **POST** `/api/ai-analysis/analyze` - Analyze resume against job profile
- **GET** `/api/ai-analysis/test-providers` - Test AI provider connectivity
- **POST** `/api/ai-analysis/demo` - Run demo analysis with sample data

### LinkedIn Analysis API
- **POST** `/api/linkedin/analyze` - Analyze LinkedIn profile
- **POST** `/api/linkedin/batch-analyze` - Batch analyze multiple profiles
- **GET** `/api/linkedin/test-connection` - Test LinkedIn scraper API

### GitHub Analysis API
- **POST** `/api/github-analysis/analyze` - Analyze GitHub profile and repositories
- **POST** `/api/github-analysis/batch` - Batch analyze multiple GitHub profiles
- **GET** `/api/github-analysis/test-connection` - Test GitHub API connectivity

### VAPI Interview API
- **POST** `/api/vapi/schedule-interview` - Schedule AI phone interview
- **GET** `/api/vapi/interview/:sessionId/status` - Get interview status
- **POST** `/api/vapi/interview/:sessionId/retry` - Retry failed interview
- **POST** `/api/vapi/webhook` - Handle VAPI webhooks

### Interview Analysis API
- **POST** `/api/interview-analysis/analyze` - Analyze interview transcript
- **POST** `/api/interview-analysis/batch-analyze` - Batch analyze transcripts
- **POST** `/api/interview-analysis/validate-transcript` - Validate transcript quality
- **GET** `/api/interview-analysis/test-providers` - Test AI provider connectivity

## Data Models

### Core Interfaces

#### CandidateScore
```typescript
interface CandidateScore {
  candidateId: string;
  jobProfileId: string;
  compositeScore: number; // 0-100 overall score
  stageScores: {
    resumeAnalysis: number;
    linkedInAnalysis: number;
    githubAnalysis: number;
    interviewPerformance: number;
  };
  appliedWeights: {
    resumeAnalysis: number;
    linkedInAnalysis: number;
    githubAnalysis: number;
    interviewPerformance: number;
  };
  rank: number; // Position in candidate ranking
  recommendation: 'strong-hire' | 'hire' | 'maybe' | 'no-hire';
  reasoning: string; // Detailed explanation of score and recommendation
}
```

#### InterviewAnalysisResult
```typescript
interface InterviewAnalysisResult {
  candidateId: string;
  interviewSessionId: string;
  provider: 'gemini' | 'openai' | 'claude';
  performanceScore: number; // 0-100
  communicationScore: number; // 0-100
  technicalScore: number; // 0-100
  competencyScores: {
    [competency: string]: number; // 0-100 for each job competency
  };
  transcriptQuality: 'excellent' | 'good' | 'poor';
  needsManualReview: boolean;
  detailedFeedback: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
  responseAnalysis: Array<{
    question: string;
    response: string;
    score: number; // 0-100
    feedback: string;
  }>;
  overallAssessment: string;
  confidence: number; // 0-100
  analysisTimestamp: Date;
}
```

#### CandidateReport
```typescript
interface CandidateReport {
  candidate: Candidate;
  jobProfile: JobProfile;
  completionStatus: {
    resumeProcessed: boolean;
    aiAnalysisCompleted: boolean;
    linkedInAnalysisCompleted: boolean;
    githubAnalysisCompleted: boolean;
    interviewCompleted: boolean;
    scoringCompleted: boolean;
  };
  reportGeneratedAt: Date;
}
```

#### BatchSummaryReport
```typescript
interface BatchSummaryReport {
  batch: ProcessingBatch;
  jobProfile: JobProfile;
  candidateReports: CandidateReport[];
  summary: {
    totalCandidates: number;
    completedCandidates: number;
    failedCandidates: number;
    averageScore: number;
    topCandidates: Candidate[];
    processingTime: number;
  };
  reportGeneratedAt: Date;
}
```

#### AIAnalysisResult
```typescript
interface AIAnalysisResult {
  candidateId: string;
  provider: 'gemini' | 'openai' | 'claude';
  relevanceScore: number; // 0-100
  skillsMatch: {
    matched: string[];
    missing: string[];
  };
  experienceAssessment: string;
  reasoning: string;
  confidence: number;
}
```

#### GitHubAnalysis
```typescript
interface GitHubAnalysis {
  candidateId: string;
  profileStats: {
    publicRepos: number;
    followers: number;
    contributionStreak: number;
    totalCommits: number;
  };
  technicalScore: number; // 0-100
  projectAuthenticity: {
    resumeProjects: Array<{
      url: string;
      isAuthentic: boolean;
      commitHistory: number;
      branchingPattern: string;
      codeQuality: string;
    }>;
  };
  skillsEvidence: string[];
}
```

## Key Features Deep Dive

### Candidate Management Service

The Candidate Management Service provides comprehensive candidate lifecycle management with advanced search, filtering, and export capabilities.

#### Advanced Search and Filtering
- **Multi-Criteria Filtering**: Filter by job profile, processing stage, score ranges, recommendations, and more
- **Date Range Filtering**: Search candidates by creation date ranges
- **Profile Completeness**: Filter by LinkedIn/GitHub profile availability
- **Interview Status**: Filter by interview completion status
- **Flexible Pagination**: Configurable page size and navigation
- **Multi-Field Sorting**: Sort by score, creation date, or candidate name

#### Processing Status Tracking
- **Real-Time Progress**: Track candidates through all processing stages
- **Stage Completion Status**: Monitor resume processing, AI analysis, LinkedIn/GitHub analysis, interviews, and scoring
- **Error Detection**: Identify and report processing failures at each stage
- **Batch Progress Monitoring**: Track progress of large-scale batch processing operations

#### Data Export Capabilities
- **Multiple Formats**: Export to CSV or JSON formats
- **Flexible Field Selection**: Choose specific fields for export
- **Detailed Reports**: Include comprehensive analysis details in exports
- **Large Dataset Support**: Handle exports of up to 10,000 candidates
- **Custom Filtering**: Apply any search filters to export subsets

#### Top Candidate Identification
- **Automatic Ranking**: Identify highest-scoring candidates for specific jobs
- **Configurable Limits**: Specify number of top candidates to retrieve
- **Completion Filtering**: Only include fully processed candidates
- **Score-Based Sorting**: Automatic sorting by composite scores

#### API Endpoints
- **GET** `/api/candidates/:candidateId` - Retrieve individual candidate details
- **POST** `/api/candidates/search` - Advanced search with filters and pagination
- **GET** `/api/candidates/:candidateId/status` - Get processing status and progress
- **GET** `/api/candidates/batch/:batchId/progress` - Monitor batch processing
- **POST** `/api/candidates/export` - Export candidates with flexible options
- **GET** `/api/candidates/count` - Get candidate counts by filters
- **GET** `/api/candidates/top/:jobProfileId` - Retrieve top-scoring candidates

### Comprehensive Scoring Service

The Scoring Service provides intelligent candidate evaluation and ranking with the following capabilities:

#### Multi-Stage Score Integration
- **Resume Analysis**: AI-powered resume evaluation (0-100 score)
- **LinkedIn Analysis**: Professional credibility assessment (0-100 score)
- **GitHub Analysis**: Technical skills and project authenticity (0-100 score)
- **Interview Performance**: AI transcript analysis and evaluation (0-100 score)

#### Weighted Scoring Algorithm
- **Configurable Weights**: Customizable weight distribution across analysis stages
- **Intelligent Normalization**: Automatic adjustment for missing analysis stages
- **Composite Score Calculation**: Weighted average with normalization (0-100 final score)

#### Advanced Ranking Features
- **Threshold-Based Recommendations**: Configurable thresholds for hire/no-hire decisions
- **Stage-Specific Filtering**: Minimum score requirements for individual analysis stages
- **Detailed Reasoning**: AI-generated explanations for scores and recommendations
- **Missing Stage Handling**: Graceful handling of incomplete candidate profiles

#### Recommendation Categories
- **Strong Hire (85+)**: Exceptional candidates with outstanding performance
- **Hire (70-84)**: Good candidates who meet most requirements
- **Maybe (50-69)**: Candidates with potential but some concerns
- **No Hire (<50)**: Candidates who don't meet minimum requirements

### Report Generation Service

The Report Generation Service provides comprehensive reporting capabilities for individual candidates and batch processing with the following features:

#### Professional PDF Reports
- **Individual Candidate Reports**: Detailed assessment reports with all analysis results
- **Batch Summary Reports**: Executive summaries with processing statistics and top candidates
- **Professional Formatting**: Clean, print-ready PDF layout with visual score indicators
- **Incomplete Data Handling**: Graceful handling of partial analysis results

#### Data Export Capabilities
- **CSV Export**: Structured data export for spreadsheet analysis
- **Configurable Fields**: Comprehensive candidate data including scores, recommendations, and contact info
- **Batch Processing**: Export multiple candidates simultaneously

#### Report Sections
- **Candidate Information**: Contact details, resume file, processing status
- **Final Scores**: Composite scores with visual indicators and stage breakdowns
- **AI Analysis Results**: Skills matching, experience assessment, and reasoning
- **LinkedIn Analysis**: Professional credibility and network metrics
- **GitHub Analysis**: Technical skills evidence and project authenticity
- **Interview Analysis**: Performance scores, communication assessment, and detailed feedback
- **Recommendations**: Final hiring recommendations with detailed reasoning

#### File Management
- **Automatic Directory Creation**: Reports stored in dedicated `reports/` directory
- **Unique File Naming**: Timestamp-based naming prevents conflicts
- **Multiple Formats**: PDF for presentation, CSV for data analysis
- **Download Support**: Direct file download via API endpoints

### Interview Analysis Service

The Interview Analysis Service provides comprehensive AI-powered evaluation of interview transcripts with the following capabilities:

#### Multi-Dimensional Scoring
- **Performance Score (0-100)**: Overall interview performance evaluation
- **Communication Score (0-100)**: Assessment of communication skills and clarity
- **Technical Score (0-100)**: Evaluation of technical knowledge and competency
- **Competency Scores**: Individual scoring for each required job skill

#### Quality Assessment
- **Transcript Quality**: Automatic assessment (excellent/good/poor)
- **Manual Review Flags**: Intelligent flagging for human review when needed
- **Confidence Scoring**: AI confidence level in the analysis (0-100)

#### Detailed Feedback
- **Strengths**: Identified candidate strengths
- **Weaknesses**: Areas for improvement
- **Recommendations**: Hiring recommendations and next steps
- **Response Analysis**: Question-by-question breakdown with specific feedback

#### AI Provider Fallback
- **Primary**: Gemini API (3 retries)
- **Secondary**: OpenAI GPT (2 retries)
- **Tertiary**: Claude API (1 retry)
- **Automatic Fallback**: Seamless provider switching on failures

### Multi-Provider AI Architecture

All AI-powered services (resume analysis, interview analysis) use a robust multi-provider architecture:

1. **Reliability**: Automatic fallback ensures high availability
2. **Quality**: Different AI models provide diverse perspectives
3. **Cost Optimization**: Primary provider selection based on cost/performance
4. **Scalability**: Load distribution across multiple providers

## Usage Examples

### Candidate Management
```typescript
import { candidateService } from './services/candidateService';

// Search candidates with filters
const results = await candidateService.searchCandidates({
  jobProfileId: 'job-123',
  minScore: 70,
  recommendation: 'hire',
  hasLinkedIn: true
}, {
  page: 1,
  limit: 20,
  sortBy: 'score',
  sortOrder: 'desc'
});

// Get candidate processing status
const status = await candidateService.getCandidateStatus('candidate-123');
console.log(`Processing stage: ${status.candidate.processingStage}`);

// Export candidates to CSV
const csvData = await candidateService.exportCandidates({
  jobProfileId: 'job-123',
  minScore: 80
}, {
  format: 'csv',
  includeDetails: true
});

// Get top candidates
const topCandidates = await candidateService.getTopCandidates('job-123', 10);
```

### Generate Candidate Report
```typescript
import { reportGenerationService } from './services/reportGenerationService';

// Generate PDF report for a candidate
const pdfPath = await reportGenerationService.generateCandidatePDF(
  candidate,
  jobProfile,
  interviewAnalysis
);

// Generate structured report data
const reportData = await reportGenerationService.generateCandidateReport(
  candidate,
  jobProfile,
  interviewAnalysis
);
```

### Generate Batch Summary
```typescript
// Generate batch summary PDF
const batchPdfPath = await reportGenerationService.generateBatchSummaryPDF(
  batch,
  candidates,
  jobProfile,
  interviewAnalyses
);

// Export candidates to CSV
const csvPath = await reportGenerationService.exportCandidatesCSV(
  candidates,
  jobProfile,
  interviewAnalyses
);
```

### API Usage
```bash
# Search candidates with filters
curl -X POST http://localhost:3000/api/candidates/search \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {
      "jobProfileId": "job-123",
      "minScore": 70,
      "recommendation": "hire"
    },
    "options": {
      "page": 1,
      "limit": 20,
      "sortBy": "score",
      "sortOrder": "desc"
    }
  }'

# Get candidate processing status
curl -X GET http://localhost:3000/api/candidates/candidate-123/status

# Export candidates data
curl -X POST http://localhost:3000/api/candidates/export \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {"jobProfileId": "job-123", "minScore": 80},
    "options": {"format": "csv", "includeDetails": true}
  }'

# Get top candidates for a job
curl -X GET http://localhost:3000/api/candidates/top/job-123?limit=10

# Generate candidate PDF report
curl -X POST http://localhost:3000/api/reports/candidate/candidate-123/pdf \
  -H "Content-Type: application/json" \
  -d '{"candidate": {...}, "jobProfile": {...}}'

# Download generated report
curl -X GET http://localhost:3000/api/reports/download/candidate_123_1642234567890.pdf
```

## Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific service tests
npm test -- aiAnalysisService.test.ts
npm test -- githubAnalysisService.test.ts
npm test -- linkedInAnalysisService.test.ts
npm test -- vapiInterviewService.test.ts
npm test -- interviewAnalysisService.test.ts
npm test -- reportGenerationService.test.ts
```

## Implementation Status

### ✅ Completed Features
- [x] Project structure and core dependencies
- [x] Core data models and database schemas
- [x] Redis connection utilities with health monitoring
- [x] Job profile management service
- [x] Resume processing and text extraction service
- [x] AI analysis service with multi-provider support
- [x] LinkedIn analysis service
- [x] GitHub analysis service
- [x] VAPI interview service integration
- [x] Interview transcript analysis service
- [x] Comprehensive scoring and ranking service
- [x] Report generation service with PDF and CSV export
- [x] Candidate management service with advanced search and filtering

### 🚧 In Progress
- [ ] Job queue system for batch processing
- [ ] REST API endpoints and request handling

### 📋 Planned Features
- [ ] Basic authentication and security measures
- [ ] Frontend interface for system management
- [ ] Comprehensive error handling and monitoring
- [ ] Configuration management and deployment setup
- [ ] Performance optimization and caching
- [ ] Documentation and testing completion

## Documentation

Detailed service documentation is available in the `docs/` directory:

- **[AI Analysis Service](docs/ai-analysis-service.md)** - Multi-provider AI resume analysis
- **[GitHub Analysis Service](docs/github-analysis-service.md)** - GitHub profile and repository analysis
- **[LinkedIn Analysis Service](docs/linkedin-analysis-service.md)** - LinkedIn professional profile analysis
- **[VAPI Interview Service](docs/vapi-interview-service.md)** - Automated phone interview integration
- **[Interview Analysis Service](docs/interview-analysis-service.md)** - AI-powered transcript analysis
- **[Scoring Service](docs/scoring-service.md)** - Comprehensive scoring and ranking system
- **[Report Generation Service](docs/report-generation-service.md)** - PDF and CSV report generation
- **[Resume Processing API](docs/resume-processing-api.md)** - PDF processing and text extraction
- **[Job Profile API](docs/job-profile-api.md)** - Job profile management

**Note**: The Candidate Management Service is documented inline in this README. Additional detailed documentation will be added to the `docs/` directory as the service evolves.

Each service documentation includes:
- API endpoint specifications
- Configuration requirements
- Usage examples
- Error handling
- Testing guidelines
- Troubleshooting guides

## Troubleshooting

### Common Issues

#### Redis Connection Issues
- **"Redis client is not connected"**: Ensure Redis server is running and accessible
- **Connection timeout**: Check Redis host and port configuration in `.env`
- **Authentication failed**: Verify `REDIS_PASSWORD` if Redis requires authentication

#### Database Connection Issues
- **MongoDB connection failed**: Verify `MONGODB_URI` and ensure MongoDB is running
- **Database not found**: Check `MONGODB_DB_NAME` configuration

#### API Provider Issues
- **AI analysis fails**: Ensure at least one AI provider API key is configured
- **Rate limiting**: Monitor API usage and implement delays between requests
- **Invalid API keys**: Test provider connectivity using test endpoints

### Health Checks

The application provides health check endpoints for monitoring:
- Redis: Use `redisClient.healthCheck()` method
- Database: Check MongoDB connection status
- AI Providers: Use `/api/ai-analysis/test-providers` endpoint

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the LICENSE file for details.