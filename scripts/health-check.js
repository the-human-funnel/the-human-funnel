#!/usr/bin/env node

/**
 * Health check script for Docker containers
 * This script verifies that the application is running correctly
 */

const http = require('http');
const process = require('process');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const TIMEOUT = 5000; // 5 seconds

function healthCheck() {
  const options = {
    hostname: HOST,
    port: PORT,
    path: '/health',
    method: 'GET',
    timeout: TIMEOUT
  };

  const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
      console.log('Health check passed');
      process.exit(0);
    } else {
      console.error(`Health check failed with status: ${res.statusCode}`);
      process.exit(1);
    }
  });

  req.on('error', (error) => {
    console.error('Health check failed:', error.message);
    process.exit(1);
  });

  req.on('timeout', () => {
    console.error('Health check timed out');
    req.destroy();
    process.exit(1);
  });

  req.setTimeout(TIMEOUT);
  req.end();
}

// Run health check
healthCheck();