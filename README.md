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

### Advanced Capabilities
- **Multi-Provider AI**: Automatic fallback between AI providers for reliability
- **Batch Processing**: Handle hundreds of candidates simultaneously
- **Real-time Progress**: Track processing status across all analysis stages
- **Quality Assessment**: Automatic quality validation for transcripts and profiles
- **Manual Review Flags**: Intelligent flagging of candidates requiring human review
- **Intelligent Scoring**: Weighted composite scoring with missing data normalization
- **Advanced Ranking**: Configurable thresholds and stage-specific filtering
- **Professional Reports**: PDF generation with comprehensive candidate assessments
- **Data Export**: CSV export capabilities for external analysis and record keeping

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
    ├── redis.ts          # Redis connection utilities
    ├── logger.ts         # Logging utilities
    └── validation.ts     # Validation utilities
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
   - Redis server
   - AI provider API keys (at least one: Gemini, OpenAI, or Claude)
   - Optional: GitHub token, LinkedIn scraper API, VAPI API key

4. **Build and start:**
   ```bash
   npm run build
   npm start
   ```

5. **Development mode:**
   ```bash
   npm run dev
   ```

## Setup

### Prerequisites
- Node.js 18+ and npm
- MongoDB 4.4+
- Redis 6.0+
- At least one AI provider API key

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

4. **Start the application:**
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
- **Redis** - Caching and job queues
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

### Testing
- **Jest** - Testing framework
- **ts-jest** - TypeScript support for Jest

## Environment Variables

See `.env.example` for all required environment variables including:

### Database Connections
- `MONGODB_URI` - MongoDB connection string
- `REDIS_URL` - Redis connection string

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
```

## Implementation Status

### ✅ Completed Features
- [x] Project structure and core dependencies
- [x] Core data models and database schemas
- [x] Job profile management service
- [x] Resume processing and text extraction service
- [x] AI analysis service with multi-provider support
- [x] LinkedIn analysis service
- [x] GitHub analysis service
- [x] VAPI interview service integration
- [x] Interview transcript analysis service
- [x] Comprehensive scoring and ranking service
- [x] Report generation service with PDF and CSV export

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
- **[Resume Processing API](docs/resume-processing-api.md)** - PDF processing and text extraction
- **[Job Profile API](docs/job-profile-api.md)** - Job profile management

Each service documentation includes:
- API endpoint specifications
- Configuration requirements
- Usage examples
- Error handling
- Testing guidelines
- Troubleshooting guides

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the LICENSE file for details.