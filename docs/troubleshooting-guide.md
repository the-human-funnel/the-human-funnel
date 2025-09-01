# Troubleshooting Guide

This guide covers common issues you may encounter when using the Job Candidate Filtering Funnel System and their solutions.

## Table of Contents

1. [Application Startup Issues](#application-startup-issues)
2. [Database Connection Problems](#database-connection-problems)
3. [AI Provider Issues](#ai-provider-issues)
4. [File Processing Problems](#file-processing-problems)
5. [Performance Issues](#performance-issues)
6. [Queue System Problems](#queue-system-problems)
7. [External Service Integration Issues](#external-service-integration-issues)
8. [Frontend Issues](#frontend-issues)
9. [Common Error Messages](#common-error-messages)
10. [Getting Help](#getting-help)

## Application Startup Issues

### Application Won't Start

**Symptoms:**
- Server fails to start
- Port already in use errors
- Module not found errors

**Solutions:**

1. **Check if port is already in use:**
   ```bash
   # Check what's using port 3000
   netstat -tulpn | grep :3000
   
   # Kill the process using the port
   kill -9 <process_id>
   
   # Or use a different port
   PORT=3001 npm start
   ```

2. **Verify environment variables:**
   ```bash
   # Check if .env file exists
   ls -la .env
   
   # Verify required variables are set
   node -e "require('dotenv').config(); console.log(process.env.MONGODB_URI)"
   ```

3. **Check Node.js version:**
   ```bash
   node --version  # Should be 18+
   npm --version
   ```

4. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

### Module Import Errors

**Symptoms:**
- "Cannot find module" errors
- TypeScript compilation errors

**Solutions:**

1. **Rebuild the project:**
   ```bash
   npm run clean
   npm run build
   ```

2. **Check TypeScript configuration:**
   ```bash
   npx tsc --noEmit  # Check for TypeScript errors
   ```

3. **Verify file paths in imports:**
   - Ensure relative paths are correct
   - Check for case sensitivity issues

## Database Connection Problems

### MongoDB Connection Failed

**Symptoms:**
- "MongoNetworkError" or "MongoServerError"
- Application hangs on startup
- Database operations timeout

**Solutions:**

1. **Verify MongoDB is running:**
   ```bash
   # Check MongoDB status
   sudo systemctl status mongod
   
   # Start MongoDB if not running
   sudo systemctl start mongod
   
   # For Docker
   docker ps | grep mongo
   ```

2. **Check connection string:**
   ```bash
   # Test connection manually
   mongosh "mongodb://localhost:27017/job-filtering-funnel"
   ```

3. **Verify database permissions:**
   ```javascript
   // In MongoDB shell
   use job-filtering-funnel
   db.runCommand({connectionStatus: 1})
   ```

4. **Check firewall settings:**
   ```bash
   # Allow MongoDB port
   sudo ufw allow 27017
   ```

### Redis Connection Issues

**Symptoms:**
- "ECONNREFUSED" errors
- Queue operations fail
- Caching not working

**Solutions:**

1. **Verify Redis is running:**
   ```bash
   # Check Redis status
   redis-cli ping  # Should return "PONG"
   
   # Start Redis if not running
   sudo systemctl start redis-server
   
   # For Docker
   docker run -d -p 6379:6379 redis:latest
   ```

2. **Check Redis configuration:**
   ```bash
   # Test connection
   redis-cli -h localhost -p 6379 ping
   
   # Check Redis logs
   sudo journalctl -u redis-server
   ```

## AI Provider Issues

### Gemini API Errors

**Symptoms:**
- "API key not valid" errors
- Rate limit exceeded
- Request timeout

**Solutions:**

1. **Verify API key:**
   ```bash
   # Check if API key is set
   echo $GEMINI_API_KEY
   
   # Test API key manually
   curl -H "Authorization: Bearer $GEMINI_API_KEY" \
        "https://generativelanguage.googleapis.com/v1/models"
   ```

2. **Check rate limits:**
   - Verify your API quota in Google Cloud Console
   - Implement exponential backoff
   - Consider upgrading your API plan

3. **Handle API failures:**
   - Ensure fallback providers (OpenAI, Claude) are configured
   - Check retry logic is working

### OpenAI API Issues

**Symptoms:**
- "Invalid API key" errors
- "Rate limit exceeded" errors
- Model not available

**Solutions:**

1. **Verify API key and organization:**
   ```bash
   curl -H "Authorization: Bearer $OPENAI_API_KEY" \
        "https://api.openai.com/v1/models"
   ```

2. **Check billing and usage:**
   - Verify account has sufficient credits
   - Check usage limits in OpenAI dashboard

### Claude API Problems

**Symptoms:**
- Authentication errors
- Model access denied
- Request format errors

**Solutions:**

1. **Verify Anthropic API key:**
   ```bash
   curl -H "x-api-key: $CLAUDE_API_KEY" \
        "https://api.anthropic.com/v1/messages" \
        -d '{"model": "claude-3-sonnet-20240229", "max_tokens": 10, "messages": [{"role": "user", "content": "Hello"}]}'
   ```

2. **Check model availability:**
   - Ensure you have access to the Claude model
   - Verify request format matches API documentation

## File Processing Problems

### PDF Processing Failures

**Symptoms:**
- "Failed to extract text from PDF"
- Empty text extraction
- Processing timeouts

**Solutions:**

1. **Check PDF file integrity:**
   ```bash
   # Verify PDF is not corrupted
   file resume.pdf  # Should show "PDF document"
   
   # Try opening with a PDF viewer
   ```

2. **Verify pdf-parse dependency:**
   ```bash
   npm list pdf-parse
   npm install pdf-parse
   ```

3. **Handle different PDF formats:**
   - Some PDFs may be image-based (scanned)
   - Consider implementing OCR for image-based PDFs
   - Add better error handling for unsupported formats

### File Upload Issues

**Symptoms:**
- "File too large" errors
- Upload timeouts
- Multer errors

**Solutions:**

1. **Check file size limits:**
   ```javascript
   // In your multer configuration
   const upload = multer({
     limits: {
       fileSize: 10 * 1024 * 1024 // 10MB
     }
   });
   ```

2. **Verify disk space:**
   ```bash
   df -h  # Check available disk space
   ```

3. **Check file permissions:**
   ```bash
   # Ensure upload directory is writable
   chmod 755 uploads/
   ```

## Performance Issues

### Slow API Responses

**Symptoms:**
- API responses take longer than 5 seconds
- Timeouts on large batches
- High CPU usage

**Solutions:**

1. **Check database performance:**
   ```javascript
   // Enable MongoDB profiling
   db.setProfilingLevel(2, { slowms: 1000 });
   db.system.profile.find().sort({ ts: -1 }).limit(5);
   ```

2. **Monitor AI API response times:**
   ```bash
   # Check logs for AI provider response times
   grep "AI analysis completed" logs/app.log | tail -10
   ```

3. **Optimize database queries:**
   - Add indexes for frequently queried fields
   - Use aggregation pipelines for complex queries
   - Implement pagination for large result sets

4. **Scale the application:**
   ```bash
   # Use PM2 for clustering
   pm2 start dist/index.js -i max
   ```

### Memory Issues

**Symptoms:**
- "Out of memory" errors
- Application crashes during large batches
- High memory usage

**Solutions:**

1. **Monitor memory usage:**
   ```bash
   # Check memory usage
   free -h
   top -p $(pgrep node)
   ```

2. **Optimize batch processing:**
   ```javascript
   // Process files in smaller chunks
   const BATCH_SIZE = 10;
   for (let i = 0; i < files.length; i += BATCH_SIZE) {
     const chunk = files.slice(i, i + BATCH_SIZE);
     await processChunk(chunk);
   }
   ```

3. **Implement garbage collection:**
   ```bash
   # Start with garbage collection flags
   node --max-old-space-size=4096 --gc-interval=100 dist/index.js
   ```

## Queue System Problems

### Jobs Not Processing

**Symptoms:**
- Jobs stuck in "waiting" state
- Queue not processing
- Redis connection issues

**Solutions:**

1. **Check Redis connection:**
   ```bash
   redis-cli ping
   redis-cli info replication
   ```

2. **Monitor queue status:**
   ```javascript
   // Check queue health
   const queue = require('./queues/resumeProcessingQueue');
   const waiting = await queue.getWaiting();
   const active = await queue.getActive();
   const completed = await queue.getCompleted();
   
   console.log(`Waiting: ${waiting.length}, Active: ${active.length}, Completed: ${completed.length}`);
   ```

3. **Restart queue workers:**
   ```bash
   # Restart the application
   pm2 restart job-filtering-funnel
   
   # Or restart specific workers
   pm2 restart worker
   ```

### Failed Jobs

**Symptoms:**
- Jobs failing repeatedly
- Error messages in queue
- Processing stuck

**Solutions:**

1. **Check failed jobs:**
   ```javascript
   const failed = await queue.getFailed();
   failed.forEach(job => {
     console.log(`Job ${job.id} failed:`, job.failedReason);
   });
   ```

2. **Retry failed jobs:**
   ```javascript
   // Retry all failed jobs
   const failed = await queue.getFailed();
   await Promise.all(failed.map(job => job.retry()));
   ```

3. **Clear stuck jobs:**
   ```javascript
   // Clean old jobs
   await queue.clean(24 * 60 * 60 * 1000, 'completed');
   await queue.clean(24 * 60 * 60 * 1000, 'failed');
   ```

## External Service Integration Issues

### LinkedIn Scraper API Problems

**Symptoms:**
- "API key invalid" errors
- Rate limit exceeded
- Profile not found

**Solutions:**

1. **Verify API credentials:**
   ```bash
   curl -H "Authorization: Bearer $LINKEDIN_SCRAPER_API_KEY" \
        "$LINKEDIN_SCRAPER_BASE_URL/health"
   ```

2. **Handle rate limits:**
   - Implement exponential backoff
   - Consider upgrading API plan
   - Cache results to reduce API calls

3. **Handle private profiles:**
   - Gracefully handle inaccessible profiles
   - Provide fallback scoring when LinkedIn data unavailable

### GitHub API Issues

**Symptoms:**
- "Bad credentials" errors
- Rate limit exceeded
- Repository not found

**Solutions:**

1. **Check GitHub token:**
   ```bash
   curl -H "Authorization: token $GITHUB_TOKEN" \
        "https://api.github.com/user"
   ```

2. **Monitor rate limits:**
   ```bash
   curl -I -H "Authorization: token $GITHUB_TOKEN" \
        "https://api.github.com/rate_limit"
   ```

3. **Handle private repositories:**
   - Gracefully handle inaccessible repos
   - Provide alternative scoring methods

### VAPI Service Problems

**Symptoms:**
- Call scheduling failures
- Poor audio quality
- Webhook delivery issues

**Solutions:**

1. **Verify VAPI credentials:**
   ```bash
   curl -H "Authorization: Bearer $VAPI_API_KEY" \
        "$VAPI_BASE_URL/calls"
   ```

2. **Check webhook configuration:**
   - Ensure webhook URL is accessible
   - Verify SSL certificate is valid
   - Check webhook signature validation

3. **Handle call failures:**
   - Implement retry logic for failed calls
   - Provide manual interview option
   - Handle no-answer scenarios

## Frontend Issues

### React Application Won't Load

**Symptoms:**
- Blank page in browser
- JavaScript errors in console
- Build failures

**Solutions:**

1. **Check build process:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Verify API connectivity:**
   ```javascript
   // In browser console
   fetch('/api/health')
     .then(r => r.json())
     .then(console.log);
   ```

3. **Check browser console:**
   - Look for JavaScript errors
   - Verify API endpoints are accessible
   - Check CORS configuration

### File Upload Not Working

**Symptoms:**
- Upload button not responding
- Files not being processed
- Error messages during upload

**Solutions:**

1. **Check file size limits:**
   - Verify files are under size limit
   - Check browser network tab for errors

2. **Verify backend connectivity:**
   ```bash
   curl -X POST -F "files=@resume.pdf" \
        http://localhost:3000/api/resume-processing/upload
   ```

3. **Check CORS configuration:**
   ```javascript
   // In backend
   app.use(cors({
     origin: ['http://localhost:3001', 'https://your-domain.com'],
     credentials: true
   }));
   ```

## Common Error Messages

### "ValidationError: Scoring weights must sum to 100"

**Cause:** Job profile scoring weights don't add up to exactly 100.

**Solution:**
```javascript
// Ensure weights sum to 100
const scoringWeights = {
  resumeAnalysis: 25,
  linkedInAnalysis: 20,
  githubAnalysis: 25,
  interviewPerformance: 30  // Total = 100
};
```

### "MongoServerError: E11000 duplicate key error"

**Cause:** Attempting to create a document with a duplicate unique field.

**Solution:**
- Check for existing records before creating
- Use upsert operations where appropriate
- Ensure unique constraints are properly handled

### "Redis connection lost"

**Cause:** Redis server is down or network connectivity issues.

**Solution:**
1. Restart Redis server
2. Check network connectivity
3. Verify Redis configuration
4. Implement connection retry logic

### "AI provider rate limit exceeded"

**Cause:** Too many requests to AI provider API.

**Solution:**
1. Implement exponential backoff
2. Use multiple API keys if available
3. Upgrade API plan
4. Cache results to reduce API calls

### "PDF processing failed: Invalid PDF"

**Cause:** Corrupted or unsupported PDF file.

**Solution:**
1. Validate PDF files before processing
2. Implement better error handling
3. Provide user feedback for invalid files
4. Consider OCR for image-based PDFs

## Getting Help

### Collecting Debug Information

When reporting issues, please include:

1. **System Information:**
   ```bash
   node --version
   npm --version
   docker --version
   ```

2. **Application Logs:**
   ```bash
   # Last 100 lines of application logs
   tail -100 logs/app.log
   
   # Docker logs
   docker-compose logs --tail=100 app
   ```

3. **Environment Variables:**
   ```bash
   # Don't include sensitive values
   env | grep -E "(NODE_ENV|PORT|MONGODB|REDIS)" | sed 's/=.*/=***/'
   ```

4. **Error Details:**
   - Full error message and stack trace
   - Steps to reproduce the issue
   - Expected vs actual behavior

### Log Levels

Configure appropriate log levels for debugging:

```javascript
// In config
{
  "logging": {
    "level": "debug",  // error, warn, info, debug
    "file": "logs/app.log",
    "console": true
  }
}
```

### Health Check Endpoints

Use these endpoints to verify system health:

- **Application Health:** `GET /api/health`
- **Database Health:** `GET /api/health/database`
- **Redis Health:** `GET /api/health/redis`
- **AI Providers:** `GET /api/health/ai-providers`

### Support Channels

1. **Documentation:** Check the docs/ directory for detailed guides
2. **GitHub Issues:** Report bugs and feature requests
3. **Logs:** Always include relevant log excerpts
4. **Configuration:** Verify environment variables and configuration files

### Performance Monitoring

Monitor these key metrics:

- **Response Times:** API endpoints should respond within 5 seconds
- **Memory Usage:** Should not exceed 80% of available memory
- **CPU Usage:** Should stay below 80% under normal load
- **Queue Length:** Monitor for growing backlogs
- **Error Rates:** Should be less than 1% of total requests

Remember to regularly update your system and dependencies to avoid known issues and security vulnerabilities.