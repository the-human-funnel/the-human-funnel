#!/bin/bash

# Test runner script for the Job Candidate Filtering Funnel System
# This script runs different types of tests based on the provided argument

set -e

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

# Function to check if required services are running
check_services() {
    print_status "Checking required services..."
    
    # Check MongoDB
    if ! pgrep -x "mongod" > /dev/null; then
        print_warning "MongoDB is not running. Starting MongoDB..."
        if command -v systemctl &> /dev/null; then
            sudo systemctl start mongod
        elif command -v brew &> /dev/null; then
            brew services start mongodb-community
        else
            print_error "Please start MongoDB manually"
            exit 1
        fi
    fi
    
    # Check Redis
    if ! pgrep -x "redis-server" > /dev/null; then
        print_warning "Redis is not running. Starting Redis..."
        if command -v systemctl &> /dev/null; then
            sudo systemctl start redis-server
        elif command -v brew &> /dev/null; then
            brew services start redis
        else
            print_error "Please start Redis manually"
            exit 1
        fi
    fi
    
    print_success "All required services are running"
}

# Function to run unit tests
run_unit_tests() {
    print_status "Running unit tests..."
    npm test
    print_success "Unit tests completed"
}

# Function to run integration tests
run_integration_tests() {
    print_status "Running integration tests..."
    print_warning "Integration tests may take several minutes to complete..."
    npm run test:integration
    print_success "Integration tests completed"
}

# Function to run API tests
run_api_tests() {
    print_status "Running API tests..."
    
    # Start the server in background
    print_status "Starting test server..."
    npm run build
    npm start &
    SERVER_PID=$!
    
    # Wait for server to be ready
    print_status "Waiting for server to be ready..."
    sleep 10
    
    # Run API tests
    node test-api.js
    node test-job-profile.js
    node test-resume-processing.js
    node test-validation.js
    
    # Stop the server
    print_status "Stopping test server..."
    kill $SERVER_PID
    
    print_success "API tests completed"
}

# Function to run all tests
run_all_tests() {
    print_status "Running complete test suite..."
    
    check_services
    
    print_status "Step 1/4: Building project..."
    npm run build
    
    print_status "Step 2/4: Running unit tests..."
    run_unit_tests
    
    print_status "Step 3/4: Running integration tests..."
    run_integration_tests
    
    print_status "Step 4/4: Running API tests..."
    run_api_tests
    
    print_success "All tests completed successfully!"
}

# Function to run tests with coverage
run_coverage() {
    print_status "Running tests with coverage..."
    
    check_services
    
    print_status "Running unit tests with coverage..."
    npm run test:coverage
    
    print_status "Running integration tests with coverage..."
    npm run test:integration -- --coverage
    
    print_success "Coverage reports generated in coverage/ directory"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Test runner for the Job Candidate Filtering Funnel System"
    echo ""
    echo "Options:"
    echo "  unit         Run unit tests only"
    echo "  integration  Run integration tests only"
    echo "  api          Run API tests only"
    echo "  all          Run all tests (default)"
    echo "  coverage     Run tests with coverage reports"
    echo "  help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 unit                 # Run unit tests"
    echo "  $0 integration          # Run integration tests"
    echo "  $0 all                  # Run complete test suite"
    echo "  $0 coverage             # Run tests with coverage"
}

# Main script logic
case "${1:-all}" in
    "unit")
        check_services
        run_unit_tests
        ;;
    "integration")
        check_services
        run_integration_tests
        ;;
    "api")
        check_services
        run_api_tests
        ;;
    "all")
        run_all_tests
        ;;
    "coverage")
        run_coverage
        ;;
    "help"|"-h"|"--help")
        show_usage
        ;;
    *)
        print_error "Unknown option: $1"
        show_usage
        exit 1
        ;;
esac

print_success "Test execution completed!"