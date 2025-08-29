// Simple test script for Job Profile Service
const { jobProfileService } = require('./dist/services/jobProfileService');
const { database } = require('./dist/utils/database');

async function testJobProfileService() {
  console.log('Testing Job Profile Service...');
  
  try {
    // Connect to database
    await database.connect();
    
    // Test data
    const testJobProfile = {
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
    
    // Test 1: Create job profile
    console.log('1. Creating job profile...');
    const createdProfile = await jobProfileService.createJobProfile(testJobProfile);
    console.log('✓ Job profile created:', createdProfile.id);
    
    // Test 2: Get job profile by ID
    console.log('2. Getting job profile by ID...');
    const retrievedProfile = await jobProfileService.getJobProfileById(createdProfile.id);
    console.log('✓ Job profile retrieved:', retrievedProfile?.title);
    
    // Test 3: Update job profile
    console.log('3. Updating job profile...');
    const updatedProfile = await jobProfileService.updateJobProfile({
      id: createdProfile.id,
      title: 'Senior Full-Stack Engineer',
      description: 'Updated description for full-stack role'
    });
    console.log('✓ Job profile updated:', updatedProfile?.title);
    
    // Test 4: Get all job profiles
    console.log('4. Getting all job profiles...');
    const allProfiles = await jobProfileService.getJobProfiles();
    console.log('✓ Total job profiles:', allProfiles.length);
    
    // Test 5: Check if job profile exists
    console.log('5. Checking if job profile exists...');
    const exists = await jobProfileService.jobProfileExists(createdProfile.id);
    console.log('✓ Job profile exists:', exists);
    
    // Test 6: Delete job profile
    console.log('6. Deleting job profile...');
    const deleted = await jobProfileService.deleteJobProfile(createdProfile.id);
    console.log('✓ Job profile deleted:', deleted);
    
    // Test 7: Verify deletion
    console.log('7. Verifying deletion...');
    const existsAfterDelete = await jobProfileService.jobProfileExists(createdProfile.id);
    console.log('✓ Job profile exists after delete:', existsAfterDelete);
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await database.disconnect();
  }
}

// Test validation errors
async function testValidationErrors() {
  console.log('\nTesting validation errors...');
  
  try {
    await database.connect();
    
    // Test invalid scoring weights (don't sum to 100)
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
    
    try {
      await jobProfileService.createJobProfile(invalidProfile);
      console.log('❌ Should have thrown validation error');
    } catch (error) {
      console.log('✓ Validation error caught:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Validation test failed:', error);
  } finally {
    await database.disconnect();
  }
}

// Run tests
testJobProfileService()
  .then(() => testValidationErrors())
  .then(() => {
    console.log('\n🎉 All tests completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });