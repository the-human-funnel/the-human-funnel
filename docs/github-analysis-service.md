# GitHub Analysis Service

## Overview

The GitHub Analysis Service provides comprehensive analysis of candidate GitHub profiles to assess technical credibility, project authenticity, and coding skills. It integrates with the GitHub REST API to gather profile statistics, repository data, and commit history for thorough evaluation.

## Features

### Core Analysis Capabilities

1. **Profile Statistics Analysis**
   - Public repository count
   - Follower/following metrics
   - Contribution streak calculation
   - Total commit estimation

2. **Repository Quality Assessment**
   - Programming language diversity
   - Repository popularity (stars/forks)
   - Code quality indicators
   - Recent activity tracking

3. **Project Authenticity Verification**
   - Commit history analysis
   - Branching pattern evaluation
   - Clone detection through commit patterns
   - Author diversity assessment

4. **Skills Evidence Extraction**
   - Technology stack identification
   - Framework usage detection
   - Required skills matching
   - Community engagement metrics

5. **Technical Credibility Scoring**
   - Weighted scoring algorithm (0-100)
   - Multiple factor consideration
   - Authenticity impact assessment
   - Quality-based adjustments

## API Endpoints

### Analyze Single Profile

```http
POST /api/github-analysis/analyze
Content-Type: application/json

{
  "candidateId": "candidate-123",
  "githubUrl": "https://github.com/username",
  "jobProfile": {
    "title": "Senior Software Engineer",
    "requiredSkills": ["JavaScript", "React", "Node.js"]
  },
  "resumeProjectUrls": [
    "https://github.com/username/project1",
    "https://github.com/username/project2"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "candidateId": "candidate-123",
    "profileStats": {
      "publicRepos": 25,
      "followers": 150,
      "contributionStreak": 45,
      "totalCommits": 1250
    },
    "technicalScore": 78,
    "projectAuthenticity": {
      "resumeProjects": [
        {
          "url": "https://github.com/username/project1",
          "isAuthentic": true,
          "commitHistory": 35,
          "branchingPattern": "git-flow",
          "codeQuality": "excellent"
        }
      ]
    },
    "skillsEvidence": [
      "8 repositories using javascript",
      "5 repositories using react",
      "3 projects using node.js",
      "15 repositories with community engagement"
    ]
  }
}
```

### Batch Analysis

```http
POST /api/github-analysis/batch
Content-Type: application/json

{
  "candidates": [
    {
      "candidateId": "candidate-1",
      "githubUrl": "https://github.com/user1",
      "resumeProjectUrls": ["https://github.com/user1/project"]
    },
    {
      "candidateId": "candidate-2",
      "githubUrl": "https://github.com/user2"
    }
  ],
  "jobProfile": {
    "title": "Frontend Developer",
    "requiredSkills": ["React", "TypeScript", "CSS"]
  }
}
```

### Test Connection

```http
GET /api/github-analysis/test-connection
```

**Response:**
```json
{
  "success": true,
  "connected": true,
  "message": "GitHub API connection successful",
  "rateLimit": {
    "remaining": 4850,
    "reset": "2024-01-01T12:00:00Z"
  }
}
```

### Rate Limit Status

```http
GET /api/github-analysis/rate-limit
```

### URL Validation

```http
POST /api/github-analysis/validate-url
Content-Type: application/json

{
  "githubUrl": "https://github.com/username/repository"
}
```

## Configuration

### Environment Variables

```bash
# GitHub API Configuration
GITHUB_TOKEN=your_github_personal_access_token

# Optional: API Rate Limiting
API_RATE_LIMIT=100
MAX_RETRIES=3
PROCESSING_TIMEOUT=300000
```

### GitHub Token Setup

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate a new token with the following scopes:
   - `public_repo` (for public repository access)
   - `read:user` (for user profile information)
   - `read:org` (optional, for organization information)
3. Add the token to your environment variables

## Analysis Algorithm

### Technical Score Calculation (0-100)

The technical score is calculated using a weighted algorithm:

#### Profile Activity (30%)
- **Repository Count** (15%): Up to 15 points for 20+ public repositories
- **Followers** (5%): Up to 5 points for 50+ followers
- **Contribution Streak** (10%): Up to 10 points for 30+ day streak

#### Skills Evidence (25%)
- **Technology Match**: 3 points per skill evidence, max 25 points
- **Language Diversity**: Bonus for multiple programming languages
- **Framework Usage**: Detection of popular frameworks and tools

#### Project Authenticity (25%)
- **Resume Project Verification**: Analysis of claimed projects
- **Commit History**: Evaluation of development patterns
- **Branching Strategy**: Assessment of Git workflow sophistication
- **Code Quality**: Repository quality indicators

#### Code Quality & Engagement (20%)
- **Popular Repositories** (10%): Repositories with stars/forks
- **Language Diversity** (10%): Variety of programming languages used

### Authenticity Detection

Projects are evaluated for authenticity using multiple indicators:

1. **Commit History Analysis**
   - Multiple commits over time
   - Consistent commit messages
   - Realistic development timeline

2. **Author Verification**
   - Commit author matches profile
   - Multiple contributors (for collaborative projects)
   - Consistent email addresses

3. **Branching Patterns**
   - Professional Git workflows (Git Flow, GitHub Flow)
   - Feature branches and pull requests
   - Merge commit patterns

4. **Code Quality Indicators**
   - Repository documentation (README)
   - Project descriptions
   - Community engagement (stars, forks, issues)

### Clone Detection

The service identifies potential project clones through:

- **Commit Pattern Analysis**: Unusual commit timing or bulk commits
- **Author Diversity**: Single author with many simultaneous commits
- **Repository Similarity**: Similar structure to popular repositories
- **Commit Message Patterns**: Generic or copied commit messages

## Error Handling

### Common Error Scenarios

1. **Rate Limiting**
   - Automatic retry with exponential backoff
   - Rate limit status monitoring
   - Graceful degradation when limits exceeded

2. **Private Repositories**
   - Handles inaccessible repositories gracefully
   - Provides partial analysis based on available data
   - Clear indication of limited visibility

3. **Invalid URLs**
   - URL format validation
   - Username extraction and verification
   - Repository existence checking

4. **API Failures**
   - Network error retry logic
   - Timeout handling
   - Fallback to cached data when available

### Error Response Format

```json
{
  "success": false,
  "error": "GitHub profile not found or is private",
  "candidateId": "candidate-123"
}
```

## Performance Considerations

### Rate Limiting

- GitHub API allows 5,000 requests per hour for authenticated requests
- Service implements intelligent request batching
- Automatic retry with exponential backoff
- Rate limit monitoring and alerting

### Optimization Strategies

1. **Request Batching**: Combine multiple API calls where possible
2. **Caching**: Cache repository data for repeated analyses
3. **Parallel Processing**: Analyze multiple candidates concurrently
4. **Selective Analysis**: Focus on most relevant repositories first

### Batch Processing Guidelines

- Maximum 100 candidates per batch request
- 100ms delay between individual analyses to prevent rate limiting
- Progress tracking for long-running batch operations
- Error isolation (one failure doesn't stop the batch)

## Integration Examples

### Basic Integration

```typescript
import { githubAnalysisService } from './services/githubAnalysisService';

const analysis = await githubAnalysisService.analyzeGitHubProfile(
  'candidate-123',
  'https://github.com/username',
  jobProfile,
  ['https://github.com/username/project1']
);

console.log(`Technical Score: ${analysis.technicalScore}`);
console.log(`Skills Evidence: ${analysis.skillsEvidence.join(', ')}`);
```

### With Error Handling

```typescript
try {
  const analysis = await githubAnalysisService.analyzeGitHubProfile(
    candidateId,
    githubUrl,
    jobProfile,
    resumeProjectUrls
  );
  
  if (analysis.technicalScore > 70) {
    console.log('Strong technical candidate');
  }
} catch (error) {
  console.error('GitHub analysis failed:', error.message);
  // Handle error appropriately
}
```

### Batch Processing

```typescript
const candidates = [
  { candidateId: '1', githubUrl: 'https://github.com/user1' },
  { candidateId: '2', githubUrl: 'https://github.com/user2' },
];

const results = [];
for (const candidate of candidates) {
  try {
    const analysis = await githubAnalysisService.analyzeGitHubProfile(
      candidate.candidateId,
      candidate.githubUrl,
      jobProfile
    );
    results.push(analysis);
    
    // Rate limiting delay
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch (error) {
    console.error(`Failed to analyze ${candidate.candidateId}:`, error);
  }
}
```

## Testing

### Unit Tests

The service includes comprehensive unit tests covering:

- Profile analysis functionality
- Error handling scenarios
- Rate limiting behavior
- URL validation
- Scoring calculations
- Authenticity detection

### Running Tests

```bash
# Run all GitHub analysis tests
npm test -- githubAnalysisService.test.ts

# Run with coverage
npm run test:coverage -- githubAnalysisService.test.ts

# Watch mode for development
npm run test:watch -- githubAnalysisService.test.ts
```

### Test Coverage

- Service initialization and configuration
- API request handling and retries
- Profile data analysis and scoring
- Project authenticity verification
- Error scenarios and edge cases
- URL validation and extraction utilities

## Monitoring and Logging

### Key Metrics

- Analysis success/failure rates
- API response times
- Rate limit utilization
- Technical score distributions
- Authenticity detection accuracy

### Logging

The service provides structured logging for:

- Analysis start/completion events
- API request/response cycles
- Error conditions and retries
- Rate limit warnings
- Performance metrics

### Health Checks

```typescript
// Check service health
const isHealthy = await githubAnalysisService.testConnection();

// Get rate limit status
const rateLimit = await githubAnalysisService.getRateLimitStatus();
```

## Security Considerations

### Token Security

- Store GitHub tokens securely using environment variables
- Rotate tokens regularly
- Use tokens with minimal required permissions
- Monitor token usage for suspicious activity

### Data Privacy

- No persistent storage of GitHub data
- Respect GitHub's terms of service
- Handle private repository information appropriately
- Implement proper access controls

### Rate Limiting Compliance

- Respect GitHub's rate limits
- Implement proper backoff strategies
- Monitor and alert on rate limit violations
- Use authenticated requests for higher limits

## Troubleshooting

### Common Issues

1. **"GitHub token not configured"**
   - Ensure GITHUB_TOKEN environment variable is set
   - Verify token has correct permissions

2. **"Rate limit exceeded"**
   - Wait for rate limit reset
   - Implement request batching
   - Consider using multiple tokens for higher throughput

3. **"Profile not found or is private"**
   - Verify GitHub URL is correct
   - Check if profile is public
   - Handle private profiles gracefully

4. **Low technical scores**
   - Review scoring algorithm weights
   - Check for missing repository data
   - Verify skill matching logic

### Debug Mode

Enable debug logging by setting:

```bash
NODE_ENV=development
DEBUG=github-analysis:*
```

This will provide detailed logging of API requests, analysis steps, and scoring calculations.