# Interview Analysis Service

## Overview

The Interview Analysis Service provides AI-powered analysis of interview transcripts to evaluate candidates against job requirements. It analyzes communication skills, technical competency, and overall interview performance using multiple AI providers with fallback support.

## Features

- **Multi-Provider AI Analysis**: Uses Gemini, OpenAI GPT, and Claude with automatic fallback
- **Comprehensive Scoring**: Evaluates performance, communication, and technical skills
- **Transcript Quality Assessment**: Automatically assesses transcript quality and flags poor quality for manual review
- **Competency Mapping**: Scores candidates against specific job requirements and skills
- **Batch Processing**: Supports analyzing multiple interview transcripts simultaneously
- **Detailed Feedback**: Provides strengths, weaknesses, and hiring recommendations
- **Response Analysis**: Breaks down individual question-answer pairs with specific feedback

## API Endpoints

### Analyze Single Interview Transcript

```http
POST /api/interview-analysis/analyze
Content-Type: application/json

{
  "candidateId": "candidate-123",
  "interviewSession": {
    "candidateId": "candidate-123",
    "jobProfileId": "job-456",
    "vapiCallId": "vapi-call-789",
    "scheduledAt": "2024-01-15T10:00:00Z",
    "status": "completed",
    "transcript": "Interviewer: Tell me about your experience...\nCandidate: I have 5 years of experience...",
    "duration": 1200,
    "callQuality": "excellent",
    "retryCount": 0
  },
  "jobProfile": {
    "id": "job-456",
    "title": "Senior Software Engineer",
    "description": "Full-stack development role",
    "requiredSkills": ["JavaScript", "React", "Node.js", "MongoDB"],
    "experienceLevel": "senior",
    "scoringWeights": {
      "resumeAnalysis": 25,
      "linkedInAnalysis": 20,
      "githubAnalysis": 25,
      "interviewPerformance": 30
    },
    "interviewQuestions": [
      "Tell me about your experience with React",
      "How do you handle state management?"
    ],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "candidateId": "candidate-123",
    "interviewSessionId": "vapi-call-789",
    "provider": "gemini",
    "performanceScore": 85,
    "communicationScore": 90,
    "technicalScore": 88,
    "competencyScores": {
      "JavaScript": 90,
      "React": 95,
      "Node.js": 80,
      "MongoDB": 75
    },
    "transcriptQuality": "excellent",
    "needsManualReview": false,
    "detailedFeedback": {
      "strengths": [
        "Strong React knowledge with specific examples",
        "Excellent communication skills",
        "Real-world project experience"
      ],
      "weaknesses": [
        "Could elaborate more on MongoDB experience",
        "Limited discussion of testing practices"
      ],
      "recommendations": [
        "Strong hire - excellent technical skills and communication",
        "Consider for senior-level position",
        "Follow up on database optimization experience"
      ]
    },
    "responseAnalysis": [
      {
        "question": "Tell me about your experience with React",
        "response": "Demonstrated 5 years experience with specific examples",
        "score": 95,
        "feedback": "Excellent response with concrete examples and metrics"
      }
    ],
    "overallAssessment": "Strong candidate with excellent technical skills and communication. Demonstrates deep React knowledge and ability to work on complex projects.",
    "confidence": 90,
    "analysisTimestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Batch Analyze Multiple Transcripts

```http
POST /api/interview-analysis/batch-analyze
Content-Type: application/json

{
  "analysisRequests": [
    {
      "candidateId": "candidate-1",
      "interviewSession": { /* interview session object */ },
      "jobProfile": { /* job profile object */ }
    },
    {
      "candidateId": "candidate-2",
      "interviewSession": { /* interview session object */ },
      "jobProfile": { /* job profile object */ }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "candidateId": "candidate-1",
        "result": { /* analysis result object */ }
      },
      {
        "candidateId": "candidate-2",
        "error": "Analysis failed: No transcript available"
      }
    ],
    "summary": {
      "total": 2,
      "successful": 1,
      "failed": 1
    }
  }
}
```

### Validate Transcript Quality

```http
POST /api/interview-analysis/validate-transcript
Content-Type: application/json

{
  "transcript": "Interviewer: Hello, can you tell me about yourself?\nCandidate: Hi, I'm a software engineer with 5 years of experience..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "quality": "excellent",
    "metrics": {
      "wordCount": 245,
      "hasDialogue": true,
      "hasQuestionMarkers": true,
      "length": 1456
    },
    "recommendations": [
      "Transcript quality is excellent for automated analysis"
    ]
  }
}
```

### Test AI Provider Connectivity

```http
GET /api/interview-analysis/test-providers
```

**Response:**
```json
{
  "success": true,
  "data": {
    "providerStatus": {
      "gemini": true,
      "openai": true,
      "claude": false
    },
    "allProvidersWorking": true,
    "workingProviders": ["gemini", "openai"],
    "message": "Interview analysis service ready with providers: gemini, openai"
  }
}
```

## Data Models

### InterviewAnalysisResult

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

## Scoring Guidelines

### Performance Score (0-100)
- **90-100**: Exceptional performance, strong hire recommendation
- **80-89**: Good performance, hire recommendation  
- **70-79**: Adequate performance, maybe hire
- **60-69**: Below expectations, likely no hire
- **0-59**: Poor performance, no hire

### Communication Score (0-100)
- **90-100**: Excellent communication, clear and professional
- **80-89**: Good communication skills
- **70-79**: Adequate communication
- **60-69**: Some communication issues
- **0-59**: Poor communication skills

### Technical Score (0-100)
- **90-100**: Expert-level technical knowledge
- **80-89**: Strong technical skills
- **70-79**: Adequate technical knowledge
- **60-69**: Some technical gaps
- **0-59**: Insufficient technical skills

### Transcript Quality Assessment

The service automatically assesses transcript quality based on:

- **Excellent**: 500+ words, clear dialogue structure, question markers, high coherence
- **Good**: 200+ words, some structure, reasonable coherence
- **Poor**: <200 words, unclear structure, low coherence

Poor quality transcripts automatically trigger manual review flags and reduce confidence scores.

## AI Provider Fallback Strategy

1. **Primary Provider (Gemini)**: First attempt with 3 retries
2. **Secondary Provider (OpenAI)**: Fallback with 2 retries
3. **Tertiary Provider (Claude)**: Final fallback with 1 retry
4. **Failure Handling**: Create fallback result with manual review flag

## Configuration

The service requires API keys for AI providers in the configuration:

```typescript
config: {
  aiProviders: {
    gemini: { apiKey: 'your-gemini-api-key' },
    openai: { apiKey: 'your-openai-api-key' },
    claude: { apiKey: 'your-claude-api-key' },
  }
}
```

## Error Handling

### Common Error Scenarios

1. **No Transcript Available**: Returns 400 error
2. **Invalid Job Profile**: Returns 400 error with validation details
3. **All AI Providers Failed**: Returns 500 error with details
4. **Malformed AI Response**: Creates fallback result with manual review flag
5. **API Rate Limits**: Automatic retry with exponential backoff

### Manual Review Triggers

The service automatically flags interviews for manual review when:

- Transcript quality is assessed as "poor"
- AI analysis confidence is below 50%
- AI response parsing fails
- Interview duration is very short (<2 minutes)
- No clear dialogue structure detected

## Usage Examples

### Basic Analysis

```typescript
import { interviewAnalysisService } from '../services/interviewAnalysisService';

const result = await interviewAnalysisService.analyzeTranscript(
  candidateId,
  interviewSession,
  jobProfile
);

console.log(`Performance Score: ${result.performanceScore}`);
console.log(`Needs Manual Review: ${result.needsManualReview}`);
```

### Batch Processing

```typescript
const requests = candidates.map(candidate => ({
  candidateId: candidate.id,
  interviewSession: candidate.interviewSession,
  jobProfile: jobProfile
}));

const results = await interviewAnalysisService.batchAnalyzeTranscripts(requests);

const successful = results.filter(r => r.result);
const failed = results.filter(r => r.error);

console.log(`Processed: ${successful.length} successful, ${failed.length} failed`);
```

### Provider Testing

```typescript
const providerStatus = await interviewAnalysisService.testProviders();

if (!Object.values(providerStatus).some(status => status)) {
  console.error('No AI providers are working!');
}
```

## Performance Considerations

- **Timeout**: Each provider call has a 45-second timeout
- **Retry Logic**: Exponential backoff for failed requests
- **Batch Processing**: Processes multiple transcripts concurrently
- **Memory Usage**: Large transcripts may require significant memory
- **API Limits**: Respects rate limits of AI providers

## Security

- **Input Validation**: All inputs are validated and sanitized
- **API Key Protection**: API keys are stored securely in configuration
- **Data Privacy**: Transcripts are processed but not permanently stored by AI providers
- **Error Logging**: Sensitive information is excluded from logs

## Testing

The service includes comprehensive tests covering:

- Successful analysis with each AI provider
- Provider fallback scenarios
- Transcript quality assessment
- Score validation and normalization
- Batch processing
- Error handling and edge cases
- Malformed response handling

Run tests with:
```bash
npm test -- interviewAnalysisService.test.ts
```

## Integration

To integrate the interview analysis service:

1. **Add to Routes**: Include the routes in your Express app
2. **Configure AI Providers**: Set up API keys in configuration
3. **Database Integration**: Store analysis results in your database
4. **Queue Integration**: Use with job queues for background processing
5. **Monitoring**: Add logging and monitoring for production use

## Troubleshooting

### Common Issues

1. **"No transcript available"**: Ensure interview session has transcript field
2. **"All AI providers failed"**: Check API keys and network connectivity
3. **Low confidence scores**: May indicate poor transcript quality
4. **Manual review flags**: Review transcript quality and AI response parsing

### Debug Mode

Enable detailed logging by setting log level to debug in your configuration.