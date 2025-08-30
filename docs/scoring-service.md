# Scoring and Ranking Service

## Overview

The Scoring and Ranking Service is responsible for calculating comprehensive candidate scores based on multiple analysis stages and providing ranking and filtering capabilities. It implements weighted scoring using dynamic job profile weights and generates detailed recommendations for hiring decisions.

## Features

- **Weighted Scoring**: Calculates composite scores using configurable weights from job profiles
- **Multi-Stage Analysis**: Combines results from resume analysis, LinkedIn analysis, GitHub analysis, and interview performance
- **Dynamic Recommendations**: Generates hire/no-hire recommendations based on configurable thresholds
- **Ranking Algorithms**: Sorts candidates by composite scores with tie-breaking logic
- **Threshold Filtering**: Filters candidates based on minimum score requirements
- **Missing Data Handling**: Gracefully handles incomplete analysis stages
- **Detailed Breakdowns**: Provides transparent scoring breakdowns for audit purposes

## Architecture

### Core Components

1. **ScoringService**: Main service class handling all scoring operations
2. **Scoring Routes**: REST API endpoints for scoring operations
3. **Ranking Options**: Configurable parameters for ranking and filtering
4. **Scoring Breakdown**: Detailed analysis of score calculations

### Scoring Algorithm

The composite score is calculated using the following formula:

```
Composite Score = (Resume Score × Resume Weight + 
                  LinkedIn Score × LinkedIn Weight + 
                  GitHub Score × GitHub Weight + 
                  Interview Score × Interview Weight) / Total Available Weight
```

Where weights are normalized percentages from the job profile configuration.

## API Endpoints

### Calculate Single Candidate Score

```http
POST /api/scoring/candidate/:candidateId
```

**Request Body:**
```json
{
  "jobProfileId": "job-profile-123",
  "candidate": {
    "id": "candidate-456",
    "aiAnalysis": { "relevanceScore": 85 },
    "linkedInAnalysis": { "professionalScore": 78 },
    "githubAnalysis": { "technicalScore": 82 },
    "interviewSession": { "analysisResult": { "performanceScore": 88 } }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "candidateId": "candidate-456",
    "jobProfileId": "job-profile-123",
    "compositeScore": 83,
    "stageScores": {
      "resumeAnalysis": 85,
      "linkedInAnalysis": 78,
      "githubAnalysis": 82,
      "interviewPerformance": 88
    },
    "appliedWeights": {
      "resumeAnalysis": 25,
      "linkedInAnalysis": 20,
      "githubAnalysis": 25,
      "interviewPerformance": 30
    },
    "rank": 0,
    "recommendation": "hire",
    "reasoning": "Composite score: 83/100. Strongest area: Interview Performance (88/100). Good candidate who meets most requirements."
  }
}
```

### Get Detailed Scoring Breakdown

```http
GET /api/scoring/breakdown/:candidateId/:jobProfileId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "candidateId": "candidate-456",
    "stageContributions": {
      "resumeAnalysis": {
        "rawScore": 85,
        "weight": 25,
        "weightedScore": 21.25
      },
      "linkedInAnalysis": {
        "rawScore": 78,
        "weight": 20,
        "weightedScore": 15.6
      },
      "githubAnalysis": {
        "rawScore": 82,
        "weight": 25,
        "weightedScore": 20.5
      },
      "interviewPerformance": {
        "rawScore": 88,
        "weight": 30,
        "weightedScore": 26.4
      }
    },
    "compositeScore": 83,
    "missingStages": []
  }
}
```

### Rank Multiple Candidates

```http
POST /api/scoring/rank
```

**Request Body:**
```json
{
  "candidates": [
    { "id": "candidate-1", "aiAnalysis": { "relevanceScore": 85 } },
    { "id": "candidate-2", "aiAnalysis": { "relevanceScore": 75 } }
  ],
  "jobProfileId": "job-profile-123",
  "options": {
    "thresholds": {
      "strongHire": 85,
      "hire": 70,
      "maybe": 50
    },
    "minStageScores": {
      "resumeAnalysis": 60,
      "interviewPerformance": 65
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCandidates": 2,
    "rankedCandidates": 2,
    "candidates": [
      {
        "candidateId": "candidate-1",
        "compositeScore": 83,
        "rank": 1,
        "recommendation": "hire"
      },
      {
        "candidateId": "candidate-2",
        "compositeScore": 72,
        "rank": 2,
        "recommendation": "hire"
      }
    ]
  }
}
```

### Filter by Score Threshold

```http
POST /api/scoring/filter/threshold
```

**Request Body:**
```json
{
  "candidateScores": [
    { "candidateId": "c1", "compositeScore": 85 },
    { "candidateId": "c2", "compositeScore": 65 }
  ],
  "minScore": 70
}
```

### Filter by Recommendation Level

```http
POST /api/scoring/filter/recommendation
```

**Request Body:**
```json
{
  "candidateScores": [
    { "candidateId": "c1", "recommendation": "strong-hire" },
    { "candidateId": "c2", "recommendation": "hire" }
  ],
  "recommendation": "strong-hire"
}
```

### Batch Scoring

```http
POST /api/scoring/batch
```

**Request Body:**
```json
{
  "scoringRequests": [
    {
      "candidate": { "id": "candidate-1" },
      "jobProfileId": "job-profile-123"
    },
    {
      "candidate": { "id": "candidate-2" },
      "jobProfileId": "job-profile-456"
    }
  ]
}
```

## Configuration

### Scoring Weights

Job profiles define scoring weights that must sum to 100%:

```typescript
interface ScoringWeights {
  resumeAnalysis: number;      // e.g., 25%
  linkedInAnalysis: number;    // e.g., 20%
  githubAnalysis: number;      // e.g., 25%
  interviewPerformance: number; // e.g., 30%
}
```

### Recommendation Thresholds

Default thresholds for recommendations:

```typescript
interface ScoringThresholds {
  strongHire: 85;  // 85-100: Strong hire recommendation
  hire: 70;        // 70-84: Hire recommendation
  maybe: 50;       // 50-69: Maybe/conditional hire
  // 0-49: No hire recommendation
}
```

## Scoring Logic

### Individual Stage Scores

1. **Resume Analysis**: Uses AI analysis relevance score (0-100)
2. **LinkedIn Analysis**: Uses professional credibility score (0-100)
3. **GitHub Analysis**: Uses technical credibility score (0-100)
4. **Interview Performance**: Uses interview analysis performance score (0-100)

### Missing Data Handling

When analysis stages are missing:
- The stage receives a score of 0
- The weight is excluded from the total available weight
- The composite score is normalized based on available stages
- Missing stages are tracked and reported in the reasoning

### Recommendation Generation

Recommendations are generated based on composite scores:
- **Strong Hire** (85-100): Exceptional candidate, immediate hire
- **Hire** (70-84): Good candidate, recommended for hire
- **Maybe** (50-69): Conditional hire, needs further evaluation
- **No Hire** (0-49): Does not meet minimum requirements

## Error Handling

### Common Error Scenarios

1. **Missing Job Profile**: Returns 404 error
2. **Invalid Scoring Weights**: Returns 400 validation error
3. **Missing Candidate Data**: Returns 400 error
4. **Calculation Errors**: Returns 500 with detailed error message

### Error Response Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "statusCode": 400
}
```

## Performance Considerations

### Optimization Strategies

1. **Batch Processing**: Use batch scoring endpoint for multiple candidates
2. **Caching**: Cache job profile data to avoid repeated database queries
3. **Parallel Processing**: Calculate scores for multiple candidates concurrently
4. **Memory Management**: Stream large candidate datasets to avoid memory issues

### Scalability

- Supports processing of 100+ candidates simultaneously
- Configurable timeout settings for large batch operations
- Memory-efficient algorithms for large-scale ranking operations

## Testing

### Unit Tests

The service includes comprehensive unit tests covering:
- Score calculation accuracy
- Missing data handling
- Ranking algorithm correctness
- Threshold filtering logic
- Edge cases and error scenarios

### Test Coverage

- ✅ Composite score calculation
- ✅ Individual stage score extraction
- ✅ Weight normalization for missing stages
- ✅ Recommendation generation
- ✅ Ranking and sorting algorithms
- ✅ Threshold-based filtering
- ✅ Error handling and validation

## Integration

### Database Integration

The service integrates with:
- Job Profile Service for weight configuration
- Candidate data models for analysis results
- Batch processing service for large-scale operations

### External Dependencies

- Job Profile Service: For scoring weight configuration
- Analysis Services: For individual stage scores
- Database: For candidate and job profile data persistence

## Usage Examples

### Basic Scoring

```typescript
import { ScoringService } from '../services/scoringService';

const scoringService = new ScoringService();

// Calculate single candidate score
const score = await scoringService.calculateCandidateScore(candidate, jobProfile);

// Rank multiple candidates
const rankedCandidates = await scoringService.rankCandidates(candidates, jobProfile);
```

### Advanced Filtering

```typescript
// Filter by minimum scores
const options = {
  minStageScores: {
    resumeAnalysis: 70,
    interviewPerformance: 75
  },
  thresholds: {
    strongHire: 90,
    hire: 75,
    maybe: 55
  }
};

const filteredCandidates = await scoringService.rankCandidates(
  candidates, 
  jobProfile, 
  options
);
```

## Best Practices

1. **Weight Configuration**: Ensure scoring weights reflect job requirements
2. **Threshold Tuning**: Adjust thresholds based on hiring standards
3. **Missing Data**: Always check for missing analysis stages
4. **Batch Processing**: Use batch operations for large candidate pools
5. **Error Handling**: Implement proper error handling for production use
6. **Performance Monitoring**: Monitor scoring performance for large datasets