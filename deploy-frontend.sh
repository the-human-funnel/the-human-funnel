#!/bin/bash

# Frontend deployment script for Job Candidate Filtering System

echo "Starting frontend deployment..."

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
npm install

# Build the frontend
echo "Building frontend for production..."
npm run build

# Go back to root directory
cd ..

# Build the backend
echo "Building backend..."
npm run build

echo "Frontend deployment complete!"
echo "The built frontend is available in frontend/build/"
echo "The backend will serve the frontend at the root URL when started"