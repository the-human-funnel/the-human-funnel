#!/bin/bash

# Job Candidate Filtering Funnel - Restore Script
# This script restores database and application data from backups

set -e

# Default values
BACKUP_DIR=""
ENVIRONMENT="production"
FORCE=false

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
    echo "Usage: $0 -d BACKUP_DIR [OPTIONS]"
    echo ""
    echo "Required:"
    echo "  -d, --dir DIR           Backup directory to restore from"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENV   Target environment (development|production|test) [default: production]"
    echo "  -f, --force             Force restore without confirmation"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -d ./backups/20231201_143022"
    echo "  $0 -d ./backups/20231201_143022 -e development -f"
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
        -f|--force)
            FORCE=true
            shift
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

# Validate required arguments
if [[ -z "$BACKUP_DIR" ]]; then
    print_error "Backup directory is required"
    show_usage
    exit 1
fi

if [[ ! -d "$BACKUP_DIR" ]]; then
    print_error "Backup directory does not exist: $BACKUP_DIR"
    exit 1
fi

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|production|test)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    exit 1
fi

# Set docker-compose file based on environment
DOCKER_COMPOSE_FILE="docker-compose.yml"
if [[ "$ENVIRONMENT" == "development" ]]; then
    DOCKER_COMPOSE_FILE="docker-compose.dev.yml"
fi

# Check if manifest exists
MANIFEST_FILE="$BACKUP_DIR/manifest.json"
if [[ -f "$MANIFEST_FILE" ]]; then
    print_status "Found backup manifest:"
    cat "$MANIFEST_FILE"
    echo ""
else
    print_warning "No manifest file found in backup directory"
fi

# Confirmation prompt
if [[ "$FORCE" != true ]]; then
    print_warning "This will restore data from: $BACKUP_DIR"
    print_warning "Target environment: $ENVIRONMENT"
    print_warning "This operation will OVERWRITE existing data!"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        print_status "Restore cancelled"
        exit 0
    fi
fi

print_status "Starting restore process..."

# Check if services are running
if ! docker-compose -f "$DOCKER_COMPOSE_FILE" ps | grep -q "Up"; then
    print_status "Starting services..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d mongodb redis
    sleep 10
fi

# Restore MongoDB
MONGODB_BACKUP="$BACKUP_DIR/mongodb_backup.tar.gz"
MONGODB_BACKUP_DIR="$BACKUP_DIR/mongodb"

if [[ -f "$MONGODB_BACKUP" ]]; then
    print_status "Restoring MongoDB from compressed backup..."
    
    # Copy backup to container
    docker cp "$MONGODB_BACKUP" $(docker-compose -f "$DOCKER_COMPOSE_FILE" ps -q mongodb):/tmp/
    
    # Extract and restore
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T mongodb bash -c "
        cd /tmp && 
        tar -xzf mongodb_backup.tar.gz && 
        mongorestore --drop --dir /tmp/job_filtering_funnel
    "
    
    # Clean up
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T mongodb rm -rf /tmp/mongodb_backup.tar.gz /tmp/job_filtering_funnel
    
    print_success "MongoDB restored successfully"
    
elif [[ -d "$MONGODB_BACKUP_DIR" ]]; then
    print_status "Restoring MongoDB from uncompressed backup..."
    
    # Copy backup directory to container
    docker cp "$MONGODB_BACKUP_DIR" $(docker-compose -f "$DOCKER_COMPOSE_FILE" ps -q mongodb):/tmp/
    
    # Restore
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T mongodb mongorestore --drop --dir /tmp/mongodb
    
    # Clean up
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T mongodb rm -rf /tmp/mongodb
    
    print_success "MongoDB restored successfully"
else
    print_warning "No MongoDB backup found, skipping MongoDB restore"
fi

# Restore Redis
REDIS_BACKUP="$BACKUP_DIR/dump.rdb.gz"
REDIS_BACKUP_UNCOMPRESSED="$BACKUP_DIR/dump.rdb"

if [[ -f "$REDIS_BACKUP" ]]; then
    print_status "Restoring Redis from compressed backup..."
    
    # Stop Redis to replace dump file
    docker-compose -f "$DOCKER_COMPOSE_FILE" stop redis
    
    # Copy and decompress backup
    gunzip -c "$REDIS_BACKUP" > /tmp/dump.rdb
    docker cp /tmp/dump.rdb $(docker-compose -f "$DOCKER_COMPOSE_FILE" ps -q redis):/data/
    rm /tmp/dump.rdb
    
    # Start Redis
    docker-compose -f "$DOCKER_COMPOSE_FILE" start redis
    sleep 5
    
    print_success "Redis restored successfully"
    
elif [[ -f "$REDIS_BACKUP_UNCOMPRESSED" ]]; then
    print_status "Restoring Redis from uncompressed backup..."
    
    # Stop Redis to replace dump file
    docker-compose -f "$DOCKER_COMPOSE_FILE" stop redis
    
    # Copy backup
    docker cp "$REDIS_BACKUP_UNCOMPRESSED" $(docker-compose -f "$DOCKER_COMPOSE_FILE" ps -q redis):/data/dump.rdb
    
    # Start Redis
    docker-compose -f "$DOCKER_COMPOSE_FILE" start redis
    sleep 5
    
    print_success "Redis restored successfully"
else
    print_warning "No Redis backup found, skipping Redis restore"
fi

# Restore application files
APP_FILES_BACKUP="$BACKUP_DIR/app_files.tar.gz"
APP_FILES_DIR="$BACKUP_DIR/app_files"

if [[ -f "$APP_FILES_BACKUP" ]]; then
    print_status "Restoring application files from compressed backup..."
    
    # Extract to temporary directory
    TEMP_DIR=$(mktemp -d)
    tar -xzf "$APP_FILES_BACKUP" -C "$TEMP_DIR"
    
    # Restore uploads
    if [[ -d "$TEMP_DIR/app_files/uploads" ]]; then
        rm -rf ./uploads
        cp -r "$TEMP_DIR/app_files/uploads" ./
        print_success "Uploads directory restored"
    fi
    
    # Restore logs (optional)
    if [[ -d "$TEMP_DIR/app_files/logs" ]]; then
        mkdir -p ./logs
        cp -r "$TEMP_DIR/app_files/logs"/* ./logs/ 2>/dev/null || true
        print_success "Logs directory restored"
    fi
    
    # Clean up
    rm -rf "$TEMP_DIR"
    
elif [[ -d "$APP_FILES_DIR" ]]; then
    print_status "Restoring application files from uncompressed backup..."
    
    # Restore uploads
    if [[ -d "$APP_FILES_DIR/uploads" ]]; then
        rm -rf ./uploads
        cp -r "$APP_FILES_DIR/uploads" ./
        print_success "Uploads directory restored"
    fi
    
    # Restore logs (optional)
    if [[ -d "$APP_FILES_DIR/logs" ]]; then
        mkdir -p ./logs
        cp -r "$APP_FILES_DIR/logs"/* ./logs/ 2>/dev/null || true
        print_success "Logs directory restored"
    fi
else
    print_warning "No application files backup found, skipping application files restore"
fi

# Restart application to pick up restored data
print_status "Restarting application..."
docker-compose -f "$DOCKER_COMPOSE_FILE" restart app

# Wait for application to be ready
sleep 10

# Verify restore
print_status "Verifying restore..."
if docker-compose -f "$DOCKER_COMPOSE_FILE" ps app | grep -q "Up"; then
    print_success "Application is running"
else
    print_error "Application failed to start after restore"
    docker-compose -f "$DOCKER_COMPOSE_FILE" logs app
    exit 1
fi

print_success "Restore completed successfully!"
echo ""
echo "Restore Summary:"
echo "  Source: $BACKUP_DIR"
echo "  Environment: $ENVIRONMENT"
echo "  Services restarted: Yes"
echo ""
print_status "Please verify that your application is working correctly"