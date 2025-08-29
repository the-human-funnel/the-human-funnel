# LinkedIn Analysis Service

## Overview

The LinkedIn Analysis Service integrates with third-party LinkedIn scraper APIs to extract and analyze professional profile data for candidate evaluation. It provides comprehensive professional credibility scoring based on experience, network metrics, and profile completeness.

## Features

### Core Functionality
- **Profile Data Extraction**: Scrapes LinkedIn profiles using third-party APIs
- **Professional Scoring**: Calculates 0-100 professional credibility scores
- **Experience Analysis**: Evaluates work history relevance and quality
- **Network Assessment**: Analyzes professional connections and endorsements
- **Error Handling**: Robust handling of private profiles and API failures

### Scoring Algorithm

The professional score (0-100) is calculated using:

1. **Experience (40% weight)**
   - Total years of experience (up to 20 points)
   - Number of relevant roles (5 points each)

2. **Network (20% weight)**
   - Professional connections (up to 10 points, scaled by 500 connections)
   - Skill endorsements (up to 10 points, scaled by 50 endorsements)

3. **Profile Completeness (25% weight)**
   - Professional headline, summary, detailed descriptions
   - Educational background, skills listing
   - Recommendations and endorsements (3 points per indicator)

4. **Company Quality (15% weight)**
   - Top-tier companies (Google, Microsoft, etc.): 15 points
   - Tech-focused companies: 10 points
   - Standard companies: 5 points

## API Integration

### Third-Party LinkedIn Scraper

The service integrates with external LinkedIn scraper APIs that provide:
- Profile information (name, headline, summary, connections)
- Work experience with detailed descriptions
- Education history
- Skills and endorsements
- Professional recommendations

### Configuration

Required environment variables:
```bash
LINKEDIN_SCRAPER_API_KEY=your_api_key_here
LINKEDIN_SCRAPER_BASE_URL=https://api.linkedin-scraper.com
```

## API Endpoints

### Analyze Single Profile
```http
POST /api/linkedin/analyze
Content-Type: application/json

{
  "candidateId": "candidate-123",
  "linkedInUrl": "https://www.linkedin.com/in/john-doe",
  "jobProfileId": "job-456"
}
```

### Batch Analysis
```http
POST /api/linkedin/batch-analyze
Content-Type: application/json

{
  "candidateIds": ["candidate-1", "candidate-2"],
  "jobProfileId": "job-456"
}
```

### Get Analysis Results
```http
GET /api/linkedin/candidate/{candidateId}
```

### Test API Connection
```http
GET /api/linkedin/test-connection
```

### Check API Usage
```http
GET /api/linkedin/usage
```

## Data Models

### LinkedIn Analysis Result
```typescript
interface LinkedInAnalysis {
  candidateId: string;
  profileAccessible: boolean;
  professionalScore: number; // 0-100
  experience: {
    totalYears: number;
    relevantRoles: number;
    companyQuality: 'top-tier' | 'tech-focused' | 'standard' | 'unknown';
  };
  network: {
    connections: number;
    endorsements: number;
  };
  credibilityIndicators: string[];
}
```

### Profile Data Structure
```typescript
interface LinkedInProfileData {
  profile: {
    firstName?: string;
    lastName?: string;
    headline?: string;
    summary?: string;
    connections?: number;
    followers?: number;
  };
  experience?: Array<{
    title: string;
    company: string;
    duration: string;
    description?: string;
  }>;
  skills?: Array<{
    name: string;
    endorsements?: number;
  }>;
  // ... additional fields
}
```

## Error Handling

### Common Error Scenarios

1. **Private Profiles**: Returns analysis with `profileAccessible: false`
2. **Profile Not Found**: Handles 404 responses gracefully
3. **Rate Limiting**: Implements exponential backoff retry logic
4. **API Failures**: Falls back to failed analysis with error details
5. **Invalid URLs**: Validates LinkedIn URL format before processing

### Retry Logic

- **Maximum Retries**: 3 attempts per profile
- **Backoff Strategy**: Exponential (2s, 4s, 8s delays)
- **Rate Limit Handling**: Special handling for 429 responses
- **Timeout**: 30-second timeout per request

## Performance Considerations

### Rate Limiting
- Sequential processing for batch requests
- 1-second delay between batch requests
- Monitors API rate limit headers
- Warns when rate limits are low

### Caching
- No caching implemented (profiles change frequently)
- Consider implementing short-term caching for repeated requests

### Scalability
- Designed for 100 candidates per batch
- Can be extended with job queues for larger batches
- Supports concurrent processing with rate limit management

## Security

### Data Privacy
- No storage of scraped LinkedIn data beyond analysis results
- Respects LinkedIn's terms of service through third-party APIs
- Handles private profiles appropriately

### API Security
- Secure API key management through environment variables
- HTTPS-only communication with external APIs
- Input validation for LinkedIn URLs

## Testing

### Unit Tests
- Profile data analysis algorithms
- Error handling scenarios
- Scoring calculation accuracy
- API response parsing

### Integration Tests
- Third-party API connectivity
- End-to-end analysis workflow
- Batch processing functionality

### Test Coverage
- Comprehensive test suite with mocked external APIs
- Edge case handling (empty profiles, malformed data)
- Performance testing with large batches

## Usage Examples

### Basic Analysis
```typescript
import { linkedInAnalysisService } from '../services/linkedInAnalysisService';

const analysis = await linkedInAnalysisService.analyzeLinkedInProfile(
  'candidate-123',
  'https://www.linkedin.com/in/john-doe',
  jobProfile
);

console.log(`Professional Score: ${analysis.professionalScore}`);
console.log(`Years of Experience: ${analysis.experience.totalYears}`);
```

### Connection Testing
```typescript
const isConnected = await linkedInAnalysisService.testConnection();
if (!isConnected) {
  console.warn('LinkedIn scraper API is not accessible');
}
```

## Troubleshooting

### Common Issues

1. **API Key Not Working**
   - Verify `LINKEDIN_SCRAPER_API_KEY` environment variable
   - Check API key validity with provider
   - Test connection using `/api/linkedin/test-connection`

2. **Rate Limit Exceeded**
   - Monitor usage with `/api/linkedin/usage`
   - Implement delays between requests
   - Consider upgrading API plan

3. **Profile Not Accessible**
   - Many LinkedIn profiles are private
   - Service handles this gracefully with `profileAccessible: false`
   - No action needed, this is expected behavior

4. **Low Professional Scores**
   - Scores reflect actual profile quality and relevance
   - Consider adjusting scoring weights for specific roles
   - Review credibility indicators for detailed breakdown

### Monitoring

- Monitor API usage and rate limits
- Track success/failure rates for profile analysis
- Alert on consecutive API failures
- Log performance metrics for optimization

## Future Enhancements

### Planned Features
- Enhanced company quality detection
- Industry-specific scoring adjustments
- Profile change detection and re-analysis
- Advanced skill matching algorithms

### Scalability Improvements
- Job queue integration for large batches
- Parallel processing with rate limit management
- Caching layer for frequently accessed profiles
- Multiple API provider support for redundancy