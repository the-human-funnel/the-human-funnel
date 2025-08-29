# AI Analysis Service Documentation

## Overview

The AI Analysis Service provides multi-provider AI-powered resume analysis with automatic fallback support. It integrates with Gemini, OpenAI GPT, and Claude APIs to analyze candidate resumes against job requirements.

## Features

### Multi-Provider Support
- **Primary Provider**: Gemini API (3 retries)
- **Secondary Provider**: OpenAI GPT API (2 retries)
- **Tertiary Provider**: Claude API (1 retry)
- **Automatic Fallback**: Seamlessly switches between providers on failure

### Structured Analysis
- **Relevance Score**: 0-100 score indicating job match
- **Skills Matching**: Identifies matched and missing skills
- **Experience Assessment**: Evaluates candidate experience relevance
- **Confidence Rating**: AI confidence in the analysis (0-100)
- **Detailed Reasoning**: Explanation of scores and recommendations

### Robust Error Handling
- **Retry Logic**: Exponential backoff for failed requests
- **Timeout Protection**: 30-second timeout per provider call
- **Graceful Degradation**: Returns fallback results on parsing errors
- **Comprehensive Logging**: Detailed logs for debugging and monitoring

## API Endpoints

### POST /api/ai-analysis/analyze
Analyze a resume against a job profile.

**Request Body:**
```json
{
  "candidateId": "candidate-123",
  "resumeData": {
    "id": "resume-123",
    "fileName": "john_doe_resume.pdf",
    "extractedText": "Resume content here...",
    "contactInfo": {
      "email": "john@example.com",
      "phone": "(555) 123-4567"
    },
    "processingStatus": "completed"
  },
  "jobProfile": {
    "id": "job-123",
    "title": "Senior Software Engineer",
    "description": "Job description...",
    "requiredSkills": ["JavaScript", "Node.js", "MongoDB"],
    "experienceLevel": "Senior (5+ years)"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "candidateId": "candidate-123",
    "provider": "gemini",
    "relevanceScore": 85,
    "skillsMatch": {
      "matched": ["JavaScript", "Node.js", "MongoDB"],
      "missing": []
    },
    "experienceAssessment": "Candidate has 6 years of relevant experience...",
    "reasoning": "Strong match with all required skills demonstrated...",
    "confidence": 90
  }
}
```

### GET /api/ai-analysis/test-providers
Test connectivity to all AI providers.

**Response:**
```json
{
  "success": true,
  "data": {
    "providerStatus": {
      "gemini": true,
      "openai": false,
      "claude": true
    },
    "availableProviders": ["gemini", "claude"],
    "totalAvailable": 2
  }
}
```

### POST /api/ai-analysis/demo
Run a demo analysis with sample data.

**Response:**
```json
{
  "success": true,
  "message": "Demo analysis completed successfully",
  "data": {
    "jobProfile": { /* sample job profile */ },
    "resumeData": { /* sample resume data */ },
    "analysisResult": { /* AI analysis result */ }
  }
}
```

## Configuration

### Environment Variables
```bash
# AI Provider API Keys
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here

# Processing Configuration
MAX_RETRIES=3
PROCESSING_TIMEOUT=300000
```

### Provider Configuration
The service is configured with the following retry and timeout settings:

- **Gemini**: 3 retries, 30s timeout
- **OpenAI**: 2 retries, 30s timeout  
- **Claude**: 1 retry, 30s timeout

## Usage Examples

### Basic Usage
```typescript
import { aiAnalysisService } from './services/aiAnalysisService';

const result = await aiAnalysisService.analyzeResume(
  candidateId,
  resumeData,
  jobProfile
);

console.log(`Analysis completed using ${result.provider}`);
console.log(`Relevance score: ${result.relevanceScore}/100`);
```

### Provider Testing
```typescript
const providerStatus = await aiAnalysisService.testProviders();
console.log('Available providers:', 
  Object.entries(providerStatus)
    .filter(([_, available]) => available)
    .map(([provider, _]) => provider)
);
```

## Structured Prompts

The service uses carefully crafted prompts to ensure consistent analysis across providers:

1. **Job Context**: Includes job title, description, required skills, and experience level
2. **Resume Content**: Full extracted text from the candidate's resume
3. **Analysis Guidelines**: Specific instructions for scoring and evaluation
4. **Output Format**: Structured JSON format for consistent parsing

## Error Handling

### Provider Failures
- **API Errors**: Automatic retry with exponential backoff
- **Rate Limits**: Switches to next provider immediately
- **Authentication**: Logs error and tries next provider
- **Timeouts**: Cancels request and tries next provider

### Response Parsing
- **Invalid JSON**: Returns fallback result with low confidence
- **Missing Fields**: Validates required fields and provides defaults
- **Score Validation**: Clamps scores to valid ranges (0-100)

## Testing

The service includes comprehensive tests covering:

- **Unit Tests**: Individual method testing with mocked dependencies
- **Integration Tests**: End-to-end testing with real API calls (when keys available)
- **Error Scenarios**: Testing various failure conditions and edge cases
- **Response Parsing**: Validation of AI response parsing logic

Run tests with:
```bash
npm test -- --testPathPatterns=aiAnalysisService.test.ts
```

## Performance Considerations

- **Concurrent Processing**: Service supports multiple simultaneous analyses
- **Memory Management**: Efficient handling of large resume texts
- **Connection Pooling**: Reuses HTTP connections for better performance
- **Caching**: Consider implementing Redis caching for repeated analyses

## Security

- **API Key Management**: Secure storage of provider credentials
- **Input Validation**: Sanitization of all user inputs
- **Rate Limiting**: Respects provider rate limits and implements backoff
- **Audit Logging**: Comprehensive logging for security monitoring

## Monitoring and Observability

The service provides detailed logging for:
- Provider selection and fallback events
- Analysis performance metrics
- Error rates and failure patterns
- API usage and rate limit tracking

## Future Enhancements

- **Custom Prompts**: Job-specific prompt templates
- **Batch Processing**: Analyze multiple resumes simultaneously
- **Result Caching**: Cache analysis results to reduce API costs
- **Provider Weights**: Configurable provider preference ordering
- **Quality Metrics**: Track and compare provider analysis quality