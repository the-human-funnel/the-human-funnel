# Job Queue System Documentation

## Overview

The Job Queue System is a comprehensive background processing solution built with Bull Queue and Redis. It handles the multi-stage candidate processing pipeline, including resume processing, AI analysis, LinkedIn analysis, GitHub analysis, interview processing, and scoring.

## Architecture

### Components

1. **QueueManager**: Core queue management and job processing
2. **QueueOrchestrator**: High-level orchestration of candidate processing workflows
3. **QueueMonitor**: Health monitoring and metrics collection
4. **Processors**: Individual job processors for each analysis stage
5. **Redis Client**: Connection management for Redis

### Queue Types

- `resume-processing`: Handles resume text extraction and parsing
- `ai-analysis`: AI-powered resume analysis against job requirements
- `linkedin-analysis`: LinkedIn profile analysis and verification
- `github-analysis`: GitHub profile and repository analysis
- `interview-processing`: AI-powered phone interview scheduling and analysis
- `scoring`: Comprehensive candidate scoring and ranking

## Features

### Job Processing
- **Multi-stage Pipeline**: Candidates progress through multiple analysis stages
- **Retry Logic**: Automatic retry with exponential backoff for failed jobs
- **Progress Tracking**: Real-time progress updates for individual jobs and batches
- **Priority Queuing**: Priority-based job scheduling
- **Concurrency Control**: Configurable concurrency limits per queue

### Batch Processing
- **Bulk Operations**: Process multiple candidates simultaneously
- **Batch Progress**: Track progress across entire candidate batches
- **Failure Handling**: Continue processing despite individual job failures
- **Resource Management**: Efficient resource utilization for large batches

### Monitoring and Management
- **Health Monitoring**: Continuous health checks and alerting
- **Queue Statistics**: Real-time metrics for all queues
- **Job Metrics**: Detailed job performance and failure analysis
- **Administrative Controls**: Pause, resume, retry, and cleanup operations

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional_password

# Processing Configuration
MAX_BATCH_SIZE=100
MAX_RETRIES=3
PROCESSING_TIMEOUT=300000
```

### Queue Configuration

Each queue is configured with:
- **Concurrency**: Number of jobs processed simultaneously
- **Retry Policy**: Maximum retries and backoff strategy
- **Job Retention**: Number of completed/failed jobs to keep
- **Timeout**: Maximum job execution time

## API Endpoints

### Queue Statistics
- `GET /api/queues/stats` - Get all queue statistics
- `GET /api/queues/stats/:queueName` - Get specific queue statistics

### Job Management
- `POST /api/queues/batch/process` - Start batch processing
- `POST /api/queues/candidate/process` - Process individual candidate
- `POST /api/queues/candidate/retry` - Retry failed candidate stage

### Progress Tracking
- `GET /api/queues/batch/:batchId/progress` - Get batch progress
- `GET /api/queues/job/:queueName/:jobId/progress` - Get job progress

### Administrative Operations
- `POST /api/queues/pause` - Pause queue processing
- `POST /api/queues/resume` - Resume queue processing
- `POST /api/queues/retry-failed` - Retry failed jobs
- `POST /api/queues/clean` - Clean old jobs

### Monitoring
- `GET /api/queues/system/status` - Get system status
- `GET /api/queues/metrics` - Get detailed queue metrics
- `GET /api/queues/health` - Get health report

## Usage Examples

### Starting Batch Processing

```javascript
const response = await fetch('/api/queues/batch/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    candidateIds: ['candidate1', 'candidate2', 'candidate3'],
    jobProfileId: 'job-profile-123'
  })
});

const { data: batch } = await response.json();
console.log('Batch ID:', batch.id);
```

### Tracking Progress

```javascript
const response = await fetch(`/api/queues/batch/${batchId}/progress`);
const { data: progress } = await response.json();

console.log(`Progress: ${progress.progress}%`);
console.log(`Completed: ${progress.completedJobs}/${progress.totalJobs}`);
```

### Processing Individual Candidate

```javascript
const response = await fetch('/api/queues/candidate/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    candidateId: 'candidate-123',
    jobProfileId: 'job-profile-456',
    startFromStage: 'resume' // Optional: resume, ai-analysis, linkedin, github, interview, scoring
  })
});
```

## Processing Pipeline

### Stage Flow

1. **Resume Processing**
   - Extract text from PDF files
   - Parse contact information
   - Extract URLs (LinkedIn, GitHub, projects)

2. **AI Analysis**
   - Analyze resume against job requirements
   - Generate relevance scores
   - Identify skill matches and gaps

3. **LinkedIn Analysis** (Parallel with GitHub)
   - Scrape public profile information
   - Verify professional experience
   - Calculate credibility scores

4. **GitHub Analysis** (Parallel with LinkedIn)
   - Analyze profile statistics
   - Evaluate repository quality
   - Verify project authenticity

5. **Interview Processing**
   - Schedule AI-powered phone interviews
   - Generate transcripts
   - Analyze interview performance

6. **Scoring**
   - Calculate composite candidate scores
   - Apply job-specific weights
   - Generate recommendations

### Job Dependencies

Jobs are scheduled with delays to ensure proper sequencing:
- Resume processing starts immediately
- AI analysis starts 5 seconds after resume processing
- LinkedIn and GitHub analysis start 10 seconds after resume processing (parallel)
- Interview processing starts 30 seconds after resume processing
- Scoring starts 60 seconds after resume processing

## Error Handling

### Retry Strategy
- **Exponential Backoff**: 2-second initial delay, exponentially increasing
- **Maximum Retries**: Configurable per queue (default: 3)
- **Failure Isolation**: Failed jobs don't affect other jobs in the batch

### Error Recovery
- **Automatic Retry**: Failed jobs are automatically retried
- **Manual Retry**: Administrative retry of specific jobs or entire queues
- **Graceful Degradation**: System continues processing despite individual failures

### Monitoring and Alerting
- **Health Checks**: Continuous monitoring of queue and Redis health
- **Failure Rate Monitoring**: Alerts for high failure rates
- **Backlog Monitoring**: Alerts for large job backlogs

## Performance Considerations

### Concurrency Limits
- Resume Processing: 5 concurrent jobs
- AI Analysis: 3 concurrent jobs (API rate limits)
- LinkedIn Analysis: 2 concurrent jobs (scraper limits)
- GitHub Analysis: 3 concurrent jobs (API rate limits)
- Interview Processing: 1 concurrent job (sequential interviews)
- Scoring: 5 concurrent jobs

### Resource Management
- **Memory Usage**: Monitored for large batch processing
- **Connection Pooling**: Efficient Redis connection management
- **Job Cleanup**: Automatic cleanup of old completed/failed jobs

### Scaling Considerations
- **Horizontal Scaling**: Multiple worker instances can process the same queues
- **Queue Partitioning**: Different queues can run on different servers
- **Redis Clustering**: Redis can be clustered for high availability

## Troubleshooting

### Common Issues

1. **Redis Connection Failures**
   - Check Redis server status
   - Verify connection configuration
   - Check network connectivity

2. **High Failure Rates**
   - Check external API availability (AI providers, LinkedIn scraper, GitHub API)
   - Verify API keys and credentials
   - Check rate limiting issues

3. **Job Stalling**
   - Monitor job timeouts
   - Check worker process health
   - Verify resource availability

### Debugging Tools

1. **Health Report**: `/api/queues/health`
2. **Queue Metrics**: `/api/queues/metrics`
3. **System Status**: `/api/queues/system/status`

### Log Analysis
- All queue operations are logged with structured metadata
- Job failures include detailed error information
- Performance metrics are logged for analysis

## Development and Testing

### Running Tests
```bash
npm test -- --testPathPattern=queueSystem
```

### Local Development
1. Start Redis server locally
2. Configure environment variables
3. Run the application with `npm run dev`

### Integration Testing
- Mock external services for testing
- Use test Redis instance
- Verify job processing pipeline

## Security Considerations

### Access Control
- API endpoints require authentication
- Administrative operations require elevated permissions
- Job data is isolated by user/organization

### Data Protection
- Sensitive candidate data is encrypted
- API keys are securely stored
- Audit logging for all operations

### Rate Limiting
- API endpoints are rate-limited
- External service calls respect rate limits
- Queue processing respects concurrency limits