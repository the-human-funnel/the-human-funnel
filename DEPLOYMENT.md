# Deployment Guide

This guide covers the deployment and configuration management for the Job Candidate Filtering Funnel System.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Docker Deployment](#docker-deployment)
5. [Manual Deployment](#manual-deployment)
6. [Backup and Restore](#backup-and-restore)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 2.0 or higher
- **Node.js**: Version 18 or higher (for manual deployment)
- **MongoDB**: Version 7.0 or higher
- **Redis**: Version 7.0 or higher

### Hardware Requirements

#### Development Environment
- **CPU**: 2 cores minimum
- **RAM**: 4GB minimum
- **Storage**: 10GB available space

#### Production Environment
- **CPU**: 4 cores minimum (8 cores recommended)
- **RAM**: 8GB minimum (16GB recommended)
- **Storage**: 50GB available space (SSD recommended)
- **Network**: Stable internet connection for AI API calls

## Environment Configuration

### 1. Environment Files

Create environment-specific configuration files:

```bash
# Copy the example environment file
cp .env.example .env

# Edit the environment file with your specific values
nano .env
```

### 2. Required Environment Variables

#### Core Application Settings
```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/job-filtering-funnel
MONGODB_PASSWORD=your_secure_password
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

#### AI Provider Configuration
```bash
# Primary AI provider (required)
GEMINI_API_KEY=your_gemini_api_key_here

# Fallback AI providers (recommended)
OPENAI_API_KEY=your_openai_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here
```

#### External Service Configuration
```bash
# LinkedIn Scraper
LINKEDIN_SCRAPER_API_KEY=your_linkedin_scraper_api_key
LINKEDIN_SCRAPER_BASE_URL=https://api.linkedin-scraper.com

# GitHub API
GITHUB_TOKEN=your_github_token_here

# VAPI (AI Calling Service)
VAPI_API_KEY=your_vapi_api_key_here
VAPI_BASE_URL=https://api.vapi.ai
```

#### Security Configuration
```bash
# Authentication
JWT_SECRET=your_very_secure_jwt_secret_here
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=change_this_password

# Security Settings
API_RATE_LIMIT=100
CORS_ORIGINS=https://your-domain.com
TRUST_PROXY=true
```

### 3. Configuration Validation

Validate your configuration before deployment:

```bash
npm run config:validate
```

## Database Setup

### 1. Database Migrations

Run database migrations to set up the schema:

```bash
# Run all pending migrations
npm run migrate

# Check migration status
npm run migrate:status

# Rollback last migration (if needed)
npm run migrate:down
```

### 2. Seed Data

Initialize the database with default data:

```bash
# Basic seed data (admin user, default job profiles)
npm run seed

# Development seed data (includes demo data)
npm run seed:demo

# Clear all data and reseed
npm run seed:clear && npm run seed
```

## Docker Deployment

### 1. Quick Start (Recommended)

Deploy the entire application stack with Docker:

```bash
# Production deployment
npm run deploy:prod

# Development deployment
npm run deploy:dev
```

### 2. Manual Docker Deployment

#### Production Deployment

```bash
# Build and start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

#### Development Deployment

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Start with admin interfaces
docker-compose -f docker-compose.dev.yml --profile admin up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

### 3. Service URLs

#### Production
- **Application API**: http://localhost:3000
- **Frontend**: http://localhost:80
- **Health Check**: http://localhost:3000/health

#### Development
- **Application API**: http://localhost:3000
- **Frontend**: http://localhost:3001
- **MongoDB Express**: http://localhost:8081 (admin/admin)
- **Redis Commander**: http://localhost:8082

### 4. Docker Commands Reference

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart a specific service
docker-compose restart app

# View service logs
docker-compose logs -f app

# Execute commands in containers
docker-compose exec app npm run migrate
docker-compose exec mongodb mongosh

# Scale services (production)
docker-compose up -d --scale app=3
```

## Manual Deployment

### 1. Prerequisites Installation

```bash
# Install Node.js dependencies
npm install

# Install frontend dependencies
npm run install:frontend

# Build the application
npm run build:all
```

### 2. Database Setup

```bash
# Start MongoDB and Redis
sudo systemctl start mongod
sudo systemctl start redis

# Run migrations and seed data
npm run migrate
npm run seed
```

### 3. Application Startup

```bash
# Start the application
npm start

# Or start with PM2 for production
pm2 start dist/index.js --name "job-filtering-funnel"
pm2 startup
pm2 save
```

### 4. Nginx Configuration (Optional)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Backup and Restore

### 1. Creating Backups

```bash
# Create a full backup
npm run backup

# Create backup with custom settings
./scripts/backup.sh -d ./custom-backups -e production -r 60

# Automated backup (add to crontab)
0 2 * * * /path/to/project/scripts/backup.sh
```

### 2. Restoring from Backup

```bash
# Restore from a specific backup
npm run restore -- -d ./backups/20231201_143022

# Force restore without confirmation
./scripts/restore.sh -d ./backups/20231201_143022 -f

# Restore to development environment
./scripts/restore.sh -d ./backups/20231201_143022 -e development
```

### 3. Backup Strategy

#### Recommended Backup Schedule
- **Full backups**: Daily at 2 AM
- **Incremental backups**: Every 6 hours
- **Retention**: 30 days for daily, 7 days for incremental

#### Backup Locations
- **Local**: `./backups/` directory
- **Remote**: AWS S3, Google Cloud Storage, or similar
- **Offsite**: Secondary backup location

## Monitoring and Maintenance

### 1. Health Checks

```bash
# Application health
curl http://localhost:3000/health

# Database connectivity
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Redis connectivity
docker-compose exec redis redis-cli ping
```

### 2. Log Management

```bash
# View application logs
docker-compose logs -f app

# View specific service logs
docker-compose logs -f mongodb
docker-compose logs -f redis

# Log rotation (add to logrotate)
/path/to/project/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 nodejs nodejs
}
```

### 3. Performance Monitoring

#### Key Metrics to Monitor
- **CPU Usage**: Should stay below 80%
- **Memory Usage**: Monitor for memory leaks
- **Database Connections**: Monitor connection pool usage
- **API Response Times**: Should be under 5 seconds
- **Queue Length**: Monitor job queue backlog

#### Monitoring Tools
- **Application**: Built-in health endpoints
- **Infrastructure**: Prometheus + Grafana
- **Logs**: ELK Stack or similar
- **Alerts**: PagerDuty, Slack notifications

### 4. Maintenance Tasks

#### Daily
- Check application health
- Monitor error logs
- Verify backup completion

#### Weekly
- Review performance metrics
- Update dependencies (security patches)
- Clean up old log files

#### Monthly
- Full system backup verification
- Security audit
- Performance optimization review

## Troubleshooting

### 1. Common Issues

#### Application Won't Start
```bash
# Check logs
docker-compose logs app

# Verify environment variables
docker-compose exec app env | grep -E "(MONGODB|REDIS|JWT)"

# Test database connectivity
docker-compose exec app npm run migrate:status
```

#### Database Connection Issues
```bash
# Check MongoDB status
docker-compose ps mongodb

# Test MongoDB connection
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Check Redis status
docker-compose exec redis redis-cli ping
```

#### High Memory Usage
```bash
# Check container memory usage
docker stats

# Monitor Node.js memory
docker-compose exec app node -e "console.log(process.memoryUsage())"

# Restart services if needed
docker-compose restart app
```

### 2. Performance Issues

#### Slow API Responses
1. Check database indexes
2. Monitor AI provider response times
3. Review queue processing
4. Scale application containers

#### High CPU Usage
1. Monitor concurrent processing jobs
2. Check for infinite loops in logs
3. Scale Redis for queue processing
4. Optimize AI provider calls

### 3. Security Issues

#### Suspected Breach
1. Immediately rotate all API keys
2. Check audit logs for suspicious activity
3. Review access logs
4. Update passwords and JWT secrets

#### API Rate Limiting
1. Monitor external API usage
2. Implement exponential backoff
3. Consider upgrading API plans
4. Cache frequently accessed data

### 4. Recovery Procedures

#### Complete System Failure
1. Restore from latest backup
2. Verify data integrity
3. Update DNS if needed
4. Notify users of any data loss

#### Partial Service Failure
1. Identify failed components
2. Restart affected services
3. Check for data corruption
4. Monitor for cascading failures

## Support and Documentation

### Getting Help
- **Documentation**: Check this guide and API documentation
- **Logs**: Always include relevant log excerpts
- **Environment**: Specify your deployment environment
- **Steps**: Provide steps to reproduce issues

### Additional Resources
- [API Documentation](./docs/)
- [Architecture Overview](./docs/architecture.md)
- [Security Guide](./docs/security.md)
- [Performance Tuning](./docs/performance.md)