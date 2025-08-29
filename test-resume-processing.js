const fs = require('fs');
const path = require('path');

// Test the resume processing functionality
async function testResumeProcessing() {
  console.log('🧪 Testing Resume Processing Service...\n');

  try {
    // Import the services
    const { ResumeProcessingService } = require('./dist/services/resumeProcessingService');
    const { BatchProcessingService } = require('./dist/services/batchProcessingService');

    const resumeProcessor = new ResumeProcessingService();
    const batchProcessor = new BatchProcessingService();

    // Test 1: Contact Information Parsing
    console.log('1. Testing contact information parsing...');
    
    const testText = `
      John Doe
      Email: john.doe@example.com
      Phone: (555) 123-4567
      LinkedIn: https://www.linkedin.com/in/johndoe
      GitHub: https://github.com/johndoe
      Portfolio: https://johndoe.dev
      Project: https://myapp.herokuapp.com
    `;

    const contactInfo = resumeProcessor.parseContactInfo(testText);
    
    console.log('   ✓ Email:', contactInfo.email);
    console.log('   ✓ Phone:', contactInfo.phone);
    console.log('   ✓ LinkedIn:', contactInfo.linkedInUrl);
    console.log('   ✓ GitHub:', contactInfo.githubUrl);
    console.log('   ✓ Project URLs:', contactInfo.projectUrls.length, 'found');

    // Test 2: Invalid PDF Processing
    console.log('\n2. Testing invalid PDF handling...');
    
    const invalidBuffer = Buffer.from('This is not a PDF file');
    const resumeData = await resumeProcessor.processSingleResume(invalidBuffer, 'invalid.pdf');
    
    console.log('   ✓ Processing Status:', resumeData.processingStatus);
    console.log('   ✓ Has Errors:', resumeData.extractionErrors && resumeData.extractionErrors.length > 0);

    // Test 3: Batch Processing
    console.log('\n3. Testing batch processing...');
    
    const testFiles = [
      {
        buffer: Buffer.from('fake pdf 1'),
        fileName: 'resume1.pdf'
      },
      {
        buffer: Buffer.from('fake pdf 2'),
        fileName: 'resume2.pdf'
      }
    ];

    // Set up progress tracking
    batchProcessor.on('progress', (progress) => {
      console.log(`   Progress: ${progress.progress}% (${progress.processedFiles}/${progress.totalFiles})`);
    });

    batchProcessor.on('completed', ({ batch }) => {
      console.log(`   ✓ Batch completed: ${batch.processedCandidates} candidates processed`);
    });

    const batch = await batchProcessor.processBatch(testFiles, 'test-job-profile');
    
    console.log('   ✓ Batch ID:', batch.id);
    console.log('   ✓ Total Candidates:', batch.totalCandidates);
    console.log('   ✓ Status:', batch.status);

    // Test 4: Batch Summary
    console.log('\n4. Testing batch summary generation...');
    
    const summary = batchProcessor.generateBatchSummary(batch);
    console.log('   ✓ Success Rate:', summary.successRate + '%');
    console.log('   ✓ Processing Time:', summary.processingTime ? `${summary.processingTime}ms` : 'N/A');

    console.log('\n✅ All resume processing tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Test URL extraction patterns
function testUrlPatterns() {
  console.log('\n🔍 Testing URL extraction patterns...\n');

  const { ResumeProcessingService } = require('./dist/services/resumeProcessingService');
  const resumeProcessor = new ResumeProcessingService();

  const testCases = [
    {
      name: 'LinkedIn URLs',
      text: 'https://www.linkedin.com/in/profile linkedin.com/in/user http://linkedin.com/in/dev',
      expectedField: 'linkedInUrl'
    },
    {
      name: 'GitHub URLs', 
      text: 'https://github.com/username github.com/developer http://www.github.com/coder',
      expectedField: 'githubUrl'
    },
    {
      name: 'Email addresses',
      text: 'Contact: user@example.com, backup@company.org, test.email+tag@domain.co.uk',
      expectedField: 'email'
    },
    {
      name: 'Phone numbers',
      text: 'Call me: (555) 123-4567 or 555-987-6543 or +1 555 111 2222',
      expectedField: 'phone'
    },
    {
      name: 'Project URLs',
      text: 'Projects: https://mysite.com https://portfolio.dev https://demo.herokuapp.com https://linkedin.com/in/skip',
      expectedField: 'projectUrls'
    }
  ];

  testCases.forEach(testCase => {
    console.log(`Testing ${testCase.name}:`);
    const result = resumeProcessor.parseContactInfo(testCase.text);
    
    if (testCase.expectedField === 'projectUrls') {
      console.log(`   Found ${result[testCase.expectedField].length} project URLs`);
      result[testCase.expectedField].forEach(url => {
        console.log(`   - ${url}`);
      });
    } else {
      console.log(`   ${testCase.expectedField}: ${result[testCase.expectedField] || 'Not found'}`);
    }
    console.log('');
  });
}

// Run tests
if (require.main === module) {
  testResumeProcessing()
    .then(() => testUrlPatterns())
    .then(() => {
      console.log('🎉 All tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testResumeProcessing, testUrlPatterns };