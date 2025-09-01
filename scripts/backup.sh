#!/bin/bash

# Job Candidate Filtering Funnel - Backup Script
# This script creates backups of the database and application data

set -e

# Default values
BACKUP_DIR="./backups"
ENVIRONMENT="production"
COMPRESS=true
RETENTION_DAYS=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -d, --dir DIR           Backup directory [default: ./backups]"
    echo "  -e, --environment ENV   Environment (development|production|test) [default: production]"
    echo "  -c, --compress          Compress backup files [default: true]"
    echo "  --no-compress           Don't compress backup files"
    echo "  -r, --retention DAYS    Retention period in days [default: 30]"
    echo "  -h, --help              Show this help message"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -c|--compress)
            COMPRESS=true
            shift
            ;;
        --no-compress)
            COMPRESS=false
            shift
            ;;
        -r|--retention)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Set docker-compose file based on environment
DOCKER_COMPOSE_FILE="docker-compose.yml"
if [[ "$ENVIRONMENT" == "development" ]]; then
    DOCKER_COMPOSE_FILE="docker-compose.dev.yml"
fi

# Create backup directory with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CURRENT_BACKUP_DIR="$BACKUP_DIR/$TIMESTAMP"
mkdir -p "$CURRENT_BACKUP_DIR"

print_status "Starting backup process..."
print_status "Backup directory: $CURRENT_BACKUP_DIR"

# Backup MongoDB
print_status "Backing up MongoDB..."
if docker-compose -f "$DOCKER_COMPOSE_FILE" ps mongodb | grep -q "Up"; then
    # Create MongoDB dump
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T mongodb mongodump --out /tmp/backup
    
    if [[ "$COMPRESS" == true ]]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T mongodb tar -czf /tmp/mongodb_backup.tar.gz -C /tmp/backup .
        docker cp $(docker-compose -f "$DOCKER_COMPOSE_FILE" ps -q mongodb):/tmp/mongodb_backup.tar.gz "$CURRENT_BACKUP_DIR/"
        print_success "MongoDB backup created: $CURRENT_BACKUP_DIR/mongodb_backup.tar.gz"
    else
        docker cp $(docker-compose -f "$DOCKER_COMPOSE_FILE" ps -q mongodb):/tmp/backup "$CURRENT_BACKUP_DIR/mongodb"
        print_success "MongoDB backup created: $CURRENT_BACKUP_DIR/mongodb/"
    fi
    
    # Clean up temporary files
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T mongodb rm -rf /tmp/backup /tmp/mongodb_backup.tar.gz
else
    print_warning "MongoDB container not running, skipping MongoDB backup"
fi

# Backup Redis
print_status "Backing up Redis..."
if docker-compose -f "$DOCKER_COMPOSE_FILE" ps redis | grep -q "Up"; then
    # Save Redis data
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T redis redis-cli BGSAVE
    
    # Wait for background save to complete
    sleep 2
    
    # Copy Redis dump
    docker cp $(docker-compose -f "$DOCKER_COMPOSE_FILE" ps -q redis):/data/dump.rdb "$CURRENT_BACKUP_DIR/"
    
    if [[ "$COMPRESS" == true ]]; then
        gzip "$CURRENT_BACKUP_DIR/dump.rdb"
        print_success "Redis backup created: $CURRENT_BACKUP_DIR/dump.rdb.gz"
    else
        print_success "Redis backup created: $CURRENT_BACKUP_DIR/dump.rdb"
    fi
else
    print_warning "Redis container not running, skipping Redis backup"
fi

# Backup application files
print_status "Backing up application files..."
APP_FILES_DIR="$CURRENT_BACKUP_DIR/app_files"
mkdir -p "$APP_FILES_DIR"

# Backup uploads directory if it exists
if [[ -d "./uploads" ]]; then
    cp -r ./uploads "$APP_FILES_DIR/"
    print_success "Uploads directory backed up"
fi

# Backup logs directory if it exists
if [[ -d "./logs" ]]; then
    cp -r ./logs "$APP_FILES_DIR/"
    print_success "Logs directory backed up"
fi

# Backup configuration files
cp .env* "$APP_FILES_DIR/" 2>/dev/null || true
cp config/*.json "$APP_FILES_DIR/" 2>/dev/null || true

if [[ "$COMPRESS" == true ]]; then
    tar -czf "$CURRENT_BACKUP_DIR/app_files.tar.gz" -C "$CURRENT_BACKUP_DIR" app_files
    rm -rf "$APP_FILES_DIR"
    print_success "Application files backup created: $CURRENT_BACKUP_DIR/app_files.tar.gz"
else
    print_success "Application files backup created: $APP_FILES_DIR/"
fi

# Create backup manifest
cat > "$CURRENT_BACKUP_DIR/manifest.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "environment": "$ENVIRONMENT",
  "compressed": $COMPRESS,
  "files": [
$(ls -la "$CURRENT_BACKUP_DIR" | grep -v "^total" | grep -v "^d" | awk '{print "    \"" $9 "\""}' | grep -v '""' | paste -sd ',' -)
  ],
  "created_by": "$(whoami)",
  "backup_size": "$(du -sh "$CURRENT_BACKUP_DIR" | cut -f1)"
}
EOF

print_success "Backup manifest created: $CURRENT_BACKUP_DIR/manifest.json"

# Clean up old backups based on retention policy
print_status "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -type d -name "20*" -mtime +$RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true

CLEANED_COUNT=$(find "$BACKUP_DIR" -type d -name "20*" -mtime +$RETENTION_DAYS 2>/dev/null | wc -l)
if [[ $CLEANED_COUNT -gt 0 ]]; then
    print_success "Cleaned up $CLEANED_COUNT old backup(s)"
else
    print_status "No old backups to clean up"
fi

# Show backup summary
BACKUP_SIZE=$(du -sh "$CURRENT_BACKUP_DIR" | cut -f1)
print_success "Backup completed successfully!"
echo ""
echo "Backup Summary:"
echo "  Location: $CURRENT_BACKUP_DIR"
echo "  Size: $BACKUP_SIZE"
echo "  Compressed: $COMPRESS"
echo "  Environment: $ENVIRONMENT"
echo ""
echo "Files backed up:"
ls -la "$CURRENT_BACKUP_DIR"