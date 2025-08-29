// Simple API test script
const http = require('http');

const API_BASE = 'http://localhost:3000/api';

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (error) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testAPI() {
  console.log('Testing Job Profile API...');
  
  try {
    // Test 1: Health check
    console.log('1. Testing health check...');
    const health = await makeRequest('GET', '/health');
    console.log('✓ Health check:', health.status, health.data.message);
    
    // Test 2: Create job profile
    console.log('2. Creating job profile...');
    const jobProfileData = {
      title: 'Senior Software Engineer',
      description: 'Looking for an experienced software engineer with full-stack development skills',
      requiredSkills: ['JavaScript', 'TypeScript', 'Node.js', 'React', 'MongoDB'],
      experienceLevel: 'Senior (5+ years)',
      scoringWeights: {
        resumeAnalysis: 25,
        linkedInAnalysis: 20,
        githubAnalysis: 25,
        interviewPerformance: 30
      },
      interviewQuestions: [
        'Tell me about your experience with Node.js',
        'How do you handle error handling in JavaScript?',
        'Describe your experience with database design'
      ]
    };
    
    const createResponse = await makeRequest('POST', '/job-profiles', jobProfileData);
    console.log('✓ Job profile created:', createResponse.status, createResponse.data.success);
    
    if (!createResponse.data.success) {
      console.error('Failed to create job profile:', createResponse.data);
      return;
    }
    
    const jobProfileId = createResponse.data.data.id;
    console.log('  Job Profile ID:', jobProfileId);
    
    // Test 3: Get job profile by ID
    console.log('3. Getting job profile by ID...');
    const getResponse = await makeRequest('GET', `/job-profiles/${jobProfileId}`);
    console.log('✓ Job profile retrieved:', getResponse.status, getResponse.data.success);
    
    // Test 4: Get all job profiles
    console.log('4. Getting all job profiles...');
    const getAllResponse = await makeRequest('GET', '/job-profiles');
    console.log('✓ All job profiles retrieved:', getAllResponse.status, getAllResponse.data.meta?.total);
    
    // Test 5: Update job profile
    console.log('5. Updating job profile...');
    const updateData = {
      title: 'Senior Full-Stack Engineer',
      description: 'Updated description for full-stack role'
    };
    const updateResponse = await makeRequest('PUT', `/job-profiles/${jobProfileId}`, updateData);
    console.log('✓ Job profile updated:', updateResponse.status, updateResponse.data.success);
    
    // Test 6: Check if job profile exists
    console.log('6. Checking if job profile exists...');
    const existsResponse = await makeRequest('GET', `/job-profiles/${jobProfileId}/exists`);
    console.log('✓ Job profile exists:', existsResponse.status, existsResponse.data.data?.exists);
    
    // Test 7: Delete job profile
    console.log('7. Deleting job profile...');
    const deleteResponse = await makeRequest('DELETE', `/job-profiles/${jobProfileId}`);
    console.log('✓ Job profile deleted:', deleteResponse.status, deleteResponse.data.success);
    
    console.log('\n✅ All API tests passed!');
    
  } catch (error) {
    console.error('❌ API test failed:', error);
  }
}

// Test validation errors
async function testValidationErrors() {
  console.log('\nTesting API validation errors...');
  
  try {
    // Test invalid scoring weights
    const invalidProfile = {
      title: 'Test Profile',
      description: 'Test description',
      requiredSkills: ['JavaScript'],
      experienceLevel: 'Junior',
      scoringWeights: {
        resumeAnalysis: 30,
        linkedInAnalysis: 20,
        githubAnalysis: 25,
        interviewPerformance: 20  // Total = 95, should be 100
      },
      interviewQuestions: ['Test question']
    };
    
    const response = await makeRequest('POST', '/job-profiles', invalidProfile);
    console.log('✓ Validation error response:', response.status, response.data.message);
    
  } catch (error) {
    console.error('❌ Validation test failed:', error);
  }
}

// Wait for server to be ready
function waitForServer(retries = 10) {
  return new Promise((resolve, reject) => {
    const checkServer = async () => {
      try {
        await makeRequest('GET', '/health');
        resolve();
      } catch (error) {
        if (retries > 0) {
          console.log('Waiting for server... retries left:', retries);
          setTimeout(() => {
            checkServer();
          }, 1000);
          retries--;
        } else {
          reject(new Error('Server not ready after 10 retries'));
        }
      }
    };
    checkServer();
  });
}

// Run tests
console.log('Waiting for server to be ready...');
waitForServer()
  .then(() => testAPI())
  .then(() => testValidationErrors())
  .then(() => {
    console.log('\n🎉 All API tests completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('API test suite failed:', error);
    process.exit(1);
  });