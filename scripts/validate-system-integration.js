#!/usr/bin/env node

/**
 * Final System Integration Validation Script
 * Demonstrates complete system integration and validates all components
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const VALIDATION_TIMEOUT = 300000; // 5 minutes

class SystemIntegrationValidator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      validations: [],
      overall: 'unknown',
      summary: {
        passed: 0,
        failed: 0,
        total: 0
      }
    };
  }

  async validateSystemHealth() {
    console.log('🔍 Validating System Health...');
    
    try {
      const response = await axios.get(`${API_BASE_URL}/system/health`, {
        timeout: 10000
      });
      
      const healthData = response.data.data;
      const isHealthy = healthData.overall === 'healthy' || healthData.overall === 'degraded';
      
      this.addValidation('System Health Check', isHealthy, {
        overall: healthData.overall,
        services: Object.keys(healthData.services || {}),
        details: healthData
      });
      
      console.log(`✅ System Health: ${healthData.overall}`);
      return isHealthy;
      
    } catch (error) {
      this.addValidation('System Health Check', false, {
        error: error.message
      });
      console.log(`❌ System Health Check Failed: ${error.message}`);
      return false;
    }
  }

  async validateProcessingPipeline() {
    console.log('🔍 Validating Complete Processing Pipeline...');
    
    try {
      // Create a test job profile
      const jobProfile = {
        title: 'Integration Test Engineer',
        description: 'Test job profile for system validation',
        requiredSkills: ['JavaScript', 'Node.js', 'Testing', 'API Integration'],
        experienceLevel: 'Mid-Level',
        scoringWeights: {
          resumeAnalysis: 25,
          linkedInAnalysis: 20,
          githubAnalysis: 25,
          interviewPerformance: 30
        },
        interviewQuestions: [
          'Describe your testing experience',
          'How do you approach API integration testing?'
        ]
      };

      const jobResponse = await axios.post(`${API_BASE_URL}/job-profiles`, jobProfile);
      const jobProfileId = jobResponse.data.data.id;
      
      console.log(`📋 Created test job profile: ${jobProfileId}`);

      // Test resume content
      const testResume = `
Integration Test Candidate
Email: test@example.com
Phone: (555) 123-4567
LinkedIn: https://www.linkedin.com/in/testcandidate
GitHub: https://github.com/testcandidate

EXPERIENCE
Software Engineer | TechCorp | 2021-2023
• Developed Node.js applications
• Implemented API integrations
• Wrote comprehensive tests

SKILLS
JavaScript, Node.js, Testing, API Integration, MongoDB

PROJECTS
Test Framework: https://github.com/testcandidate/test-framework
      `;

      // Upload test resume
      const FormData = require('form-data');
      const form = new FormData();
      form.append('files', Buffer.from(testResume), 'test-resume.pdf');
      form.append('jobProfileId', jobProfileId);

      const uploadResponse = await axios.post(`${API_BASE_URL}/resume-processing/upload`, form, {
        headers: form.getHeaders(),
        timeout: 30000
      });

      const candidateId = uploadResponse.data.data.candidates[0].id;
      console.log(`📄 Uploaded test resume, candidate ID: ${candidateId}`);

      // Wait for processing to complete
      let processingComplete = false;
      let attempts = 0;
      const maxAttempts = 60; // 1 minute timeout

      while (!processingComplete && attempts < maxAttempts) {
        const statusResponse = await axios.get(`${API_BASE_URL}/candidates/${candidateId}/status`);
        const candidate = statusResponse.data.data.candidate;
        
        processingComplete = candidate.processingStage === 'completed';
        
        if (!processingComplete) {
          console.log(`⏳ Processing stage: ${candidate.processingStage}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }

      if (processingComplete) {
        // Validate final candidate data
        const candidateResponse = await axios.get(`${API_BASE_URL}/candidates/${candidateId}`);
        const candidate = candidateResponse.data.data;

        const hasResumeData = !!(candidate.resumeData && candidate.resumeData.extractedText);
        const hasAIAnalysis = !!(candidate.aiAnalysis && candidate.aiAnalysis.relevanceScore !== undefined);
        const hasLinkedInAnalysis = !!candidate.linkedInAnalysis;
        const hasGitHubAnalysis = !!candidate.githubAnalysis;
        const hasInterviewSession = !!candidate.interviewSession;
        const hasFinalScore = !!(candidate.finalScore && candidate.finalScore.compositeScore !== undefined);

        const pipelineComplete = hasResumeData && hasAIAnalysis && hasLinkedInAnalysis && 
                                hasGitHubAnalysis && hasInterviewSession && hasFinalScore;

        this.addValidation('Complete Processing Pipeline', pipelineComplete, {
          candidateId,
          stages: {
            resumeProcessing: hasResumeData,
            aiAnalysis: hasAIAnalysis,
            linkedInAnalysis: hasLinkedInAnalysis,
            githubAnalysis: hasGitHubAnalysis,
            interviewSession: hasInterviewSession,
            finalScoring: hasFinalScore
          },
          finalScore: candidate.finalScore?.compositeScore,
          recommendation: candidate.finalScore?.recommendation
        });

        console.log(`✅ Processing Pipeline Complete - Score: ${candidate.finalScore?.compositeScore}`);
        return pipelineComplete;
      } else {
        this.addValidation('Complete Processing Pipeline', false, {
          error: 'Processing timeout',
          attempts,
          maxAttempts
        });
        console.log('❌ Processing Pipeline Timeout');
        return false;
      }

    } catch (error) {
      this.addValidation('Complete Processing Pipeline', false, {
        error: error.message
      });
      console.log(`❌ Processing Pipeline Failed: ${error.message}`);
      return false;
    }
  }

  async validateExternalIntegrations() {
    console.log('🔍 Validating External API Integrations...');
    
    try {
      const response = await axios.get(`${API_BASE_URL}/system/external-services`);
      const services = response.data.data.services;
      
      const aiAvailable = services.ai && services.ai.status === 'available';
      const linkedInAvailable = services.linkedin && services.linkedin.status === 'available';
      const githubAvailable = services.github && services.github.status === 'available';
      const vapiAvailable = services.vapi && services.vapi.status === 'available';
      
      const allIntegrationsWorking = aiAvailable && linkedInAvailable && githubAvailable && vapiAvailable;
      
      this.addValidation('External API Integrations', allIntegrationsWorking, {
        ai: aiAvailable,
        linkedin: linkedInAvailable,
        github: githubAvailable,
        vapi: vapiAvailable,
        details: services
      });
      
      console.log(`✅ External Integrations: AI(${aiAvailable}), LinkedIn(${linkedInAvailable}), GitHub(${githubAvailable}), VAPI(${vapiAvailable})`);
      return allIntegrationsWorking;
      
    } catch (error) {
      this.addValidation('External API Integrations', false, {
        error: error.message
      });
      console.log(`❌ External Integrations Failed: ${error.message}`);
      return false;
    }
  }

  async validatePerformanceMetrics() {
    console.log('🔍 Validating Performance Metrics...');
    
    try {
      const response = await axios.get(`${API_BASE_URL}/system/performance-metrics`);
      const metrics = response.data.data;
      
      // Check memory usage (should be reasonable)
      const memoryUsageMB = metrics.memory.heapUsed / 1024 / 1024;
      const memoryOK = memoryUsageMB < 1000; // Less than 1GB
      
      // Check uptime (should be positive)
      const uptimeOK = metrics.uptime > 0;
      
      // Check database response time (should be fast)
      const dbResponseOK = metrics.database.responseTime < 1000; // Less than 1 second
      
      const performanceOK = memoryOK && uptimeOK && dbResponseOK;
      
      this.addValidation('Performance Metrics', performanceOK, {
        memoryUsageMB: Math.round(memoryUsageMB),
        uptime: Math.round(metrics.uptime),
        dbResponseTime: metrics.database.responseTime,
        checks: {
          memory: memoryOK,
          uptime: uptimeOK,
          database: dbResponseOK
        }
      });
      
      console.log(`✅ Performance: Memory(${Math.round(memoryUsageMB)}MB), Uptime(${Math.round(metrics.uptime)}s)`);
      return performanceOK;
      
    } catch (error) {
      this.addValidation('Performance Metrics', false, {
        error: error.message
      });
      console.log(`❌ Performance Validation Failed: ${error.message}`);
      return false;
    }
  }

  addValidation(name, passed, details = {}) {
    this.results.validations.push({
      name,
      passed,
      details,
      timestamp: new Date().toISOString()
    });
    
    this.results.summary.total++;
    if (passed) {
      this.results.summary.passed++;
    } else {
      this.results.summary.failed++;
    }
  }

  async runAllValidations() {
    console.log('🚀 Starting Final System Integration Validation');
    console.log('================================================');
    
    const validations = [
      () => this.validateSystemHealth(),
      () => this.validateExternalIntegrations(),
      () => this.validatePerformanceMetrics(),
      () => this.validateProcessingPipeline()
    ];
    
    for (const validation of validations) {
      await validation();
      console.log(''); // Add spacing between validations
    }
    
    // Calculate overall result
    const successRate = (this.results.summary.passed / this.results.summary.total) * 100;
    this.results.overall = successRate >= 80 ? 'passed' : 'failed';
    this.results.successRate = successRate;
    
    // Generate report
    this.generateReport();
    
    console.log('================================================');
    console.log('🎉 Final System Integration Validation Complete!');
    console.log(`📊 Results: ${this.results.summary.passed}/${this.results.summary.total} validations passed (${Math.round(successRate)}%)`);
    console.log(`🏆 Overall Status: ${this.results.overall.toUpperCase()}`);
    
    if (this.results.overall === 'passed') {
      console.log('✅ System is ready for production deployment!');
    } else {
      console.log('❌ System requires attention before production deployment');
    }
    
    return this.results.overall === 'passed';
  }

  generateReport() {
    const reportPath = path.join(__dirname, '..', 'test-results', 'system-integration-validation.json');
    
    // Ensure directory exists
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`📄 Validation report saved: ${reportPath}`);
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new SystemIntegrationValidator();
  
  validator.runAllValidations()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Validation failed with error:', error.message);
      process.exit(1);
    });
}

module.exports = SystemIntegrationValidator;