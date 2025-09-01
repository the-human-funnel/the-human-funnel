#!/bin/bash

# Job Candidate Filtering Funnel - Deployment Script
# This script handles deployment to different environments

set -e

# Default values
ENVIRONMENT="production"
BUILD_FRONTEND=true
RUN_MIGRATIONS=true
SEED_DATA=false
BACKUP_DB=true
DOCKER_COMPOSE_FILE="docker-compose.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENV    Target environment (development|production|test) [default: production]"
    echo "  -f, --frontend          Build and deploy frontend [default: true]"
    echo "  -m, --migrate           Run database migrations [default: true]"
    echo "  -s, --seed              Seed database with initial data [default: false]"
    echo "  -b, --backup            Backup database before deployment [default: true]"
    echo "  --no-frontend           Skip frontend build"
    echo "  --no-migrate            Skip database migrations"
    echo "  --no-backup             Skip database backup"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Deploy to production with defaults"
    echo "  $0 -e development --no-backup        # Deploy to development without backup"
    echo "  $0 -e production -s                  # Deploy to production with seed data"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -f|--frontend)
            BUILD_FRONTEND=true
            shift
            ;;
        --no-frontend)
            BUILD_FRONTEND=false
            shift
            ;;
        -m|--migrate)
            RUN_MIGRATIONS=true
            shift
            ;;
        --no-migrate)
            RUN_MIGRATIONS=false
            shift
            ;;
        -s|--seed)
            SEED_DATA=true
            shift
            ;;
        -b|--backup)
            BACKUP_DB=true
            shift
            ;;
        --no-backup)
            BACKUP_DB=false
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

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|production|test)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    print_error "Must be one of: development, production, test"
    exit 1
fi

# Set docker-compose file based on environment
if [[ "$ENVIRONMENT" == "development" ]]; then
    DOCKER_COMPOSE_FILE="docker-compose.dev.yml"
fi

print_status "Starting deployment to $ENVIRONMENT environment..."

# Check if required files exist
if [[ ! -f "$DOCKER_COMPOSE_FILE" ]]; then
    print_error "Docker compose file not found: $DOCKER_COMPOSE_FILE"
    exit 1
fi

if [[ ! -f ".env" && "$ENVIRONMENT" == "production" ]]; then
    print_error "Environment file .env not found (required for production)"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Backup database if requested and in production
if [[ "$BACKUP_DB" == true && "$ENVIRONMENT" == "production" ]]; then
    print_status "Creating database backup..."
    
    # Create backup directory
    BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup MongoDB
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps mongodb | grep -q "Up"; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T mongodb mongodump --out /tmp/backup
        docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T mongodb tar -czf /tmp/mongodb_backup.tar.gz -C /tmp/backup .
        docker cp $(docker-compose -f "$DOCKER_COMPOSE_FILE" ps -q mongodb):/tmp/mongodb_backup.tar.gz "$BACKUP_DIR/"
        print_success "MongoDB backup created: $BACKUP_DIR/mongodb_backup.tar.gz"
    else
        print_warning "MongoDB container not running, skipping backup"
    fi
fi

# Build and deploy backend
print_status "Building backend application..."
docker-compose -f "$DOCKER_COMPOSE_FILE" build app

# Build frontend if requested
if [[ "$BUILD_FRONTEND" == true ]]; then
    print_status "Building frontend application..."
    
    # Check if frontend directory exists
    if [[ -d "frontend" ]]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" build frontend
        print_success "Frontend built successfully"
    else
        print_warning "Frontend directory not found, skipping frontend build"
    fi
fi

# Start services
print_status "Starting services..."
docker-compose -f "$DOCKER_COMPOSE_FILE" up -d

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 10

# Check service health
print_status "Checking service health..."
for service in mongodb redis app; do
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps "$service" | grep -q "Up"; then
        print_success "$service is running"
    else
        print_error "$service failed to start"
        docker-compose -f "$DOCKER_COMPOSE_FILE" logs "$service"
        exit 1
    fi
done

# Run database migrations if requested
if [[ "$RUN_MIGRATIONS" == true ]]; then
    print_status "Running database migrations..."
    
    # Wait a bit more for MongoDB to be fully ready
    sleep 5
    
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T app npm run migrate
    print_success "Database migrations completed"
fi

# Seed database if requested
if [[ "$SEED_DATA" == true ]]; then
    print_status "Seeding database with initial data..."
    
    if [[ "$ENVIRONMENT" == "development" ]]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T app npm run seed -- --demo
    else
        docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T app npm run seed
    fi
    
    print_success "Database seeding completed"
fi

# Show deployment summary
print_success "Deployment completed successfully!"
echo ""
echo "Deployment Summary:"
echo "  Environment: $ENVIRONMENT"
echo "  Frontend built: $BUILD_FRONTEND"
echo "  Migrations run: $RUN_MIGRATIONS"
echo "  Data seeded: $SEED_DATA"
echo "  Database backed up: $BACKUP_DB"
echo ""

# Show service URLs
if [[ "$ENVIRONMENT" == "development" ]]; then
    echo "Service URLs:"
    echo "  Application: http://localhost:3000"
    echo "  Frontend: http://localhost:3001"
    echo "  MongoDB Express: http://localhost:8081 (with --profile admin)"
    echo "  Redis Commander: http://localhost:8082 (with --profile admin)"
else
    echo "Service URLs:"
    echo "  Application: http://localhost:3000"
    echo "  Frontend: http://localhost:80"
fi

echo ""
print_status "Use 'docker-compose -f $DOCKER_COMPOSE_FILE logs -f' to view logs"
print_status "Use 'docker-compose -f $DOCKER_COMPOSE_FILE down' to stop services"