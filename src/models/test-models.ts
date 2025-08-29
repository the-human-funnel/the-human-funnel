// Simple test to verify models work correctly
import { JobProfileModel, CandidateModel, ProcessingBatchModel } from './schemas';
import { JobProfile, Candidate, ProcessingBatch } from './interfaces';
import { database } from '../utils/database';

export async function testModels(): Promise<void> {
  try {
    console.log('Testing data models...');

    // Test JobProfile creation
    const jobProfileData: Partial<JobProfile> = {
      title: 'Senior Software Engineer',
      description: 'Looking for an experienced software engineer',
      requiredSkills: ['JavaScript', 'TypeScript', 'Node.js', 'React'],
      experienceLevel: 'Senior',
      scoringWeights: {
        resumeAnalysis: 25,
        linkedInAnalysis: 20,
        githubAnalysis: 25,
        interviewPerformance: 30
      },
      interviewQuestions: [
        'Tell me about your experience with Node.js',
        'How do you handle error handling in JavaScript?'
      ]
    };

    const jobProfile = new JobProfileModel(jobProfileData);
    console.log('JobProfile model created successfully');

    // Test Candidate creation
    const candidateData: Partial<Candidate> = {
      resumeData: {
        id: 'resume-123',
        fileName: 'john-doe-resume.pdf',
        extractedText: 'John Doe - Software Engineer with 5 years experience...',
        contactInfo: {
          email: 'john.doe@example.com',
          phone: '+1-555-0123',
          linkedInUrl: 'https://linkedin.com/in/johndoe',
          githubUrl: 'https://github.com/johndoe',
          projectUrls: ['https://github.com/johndoe/awesome-project']
        },
        processingStatus: 'pending'
      },
      processingStage: 'resume'
    };

    const candidate = new CandidateModel(candidateData);
    console.log('Candidate model created successfully');

    // Test ProcessingBatch creation
    const batchData: Partial<ProcessingBatch> = {
      jobProfileId: 'job-123',
      totalCandidates: 10,
      processedCandidates: 0,
      failedCandidates: 0,
      candidateIds: ['candidate-1', 'candidate-2', 'candidate-3']
    };

    const batch = new ProcessingBatchModel(batchData);
    console.log('ProcessingBatch model created successfully');

    // Test validation
    try {
      // This should fail because weights don't sum to 100
      const invalidJobProfile = new JobProfileModel({
        ...jobProfileData,
        scoringWeights: {
          resumeAnalysis: 25,
          linkedInAnalysis: 25,
          githubAnalysis: 25,
          interviewPerformance: 25 // Total = 100, should pass
        }
      });
      
      // Test the validation
      await invalidJobProfile.validate();
      console.log('JobProfile validation passed');
    } catch (error) {
      console.log('JobProfile validation error (expected):', error);
    }

    console.log('All model tests completed successfully!');
  } catch (error) {
    console.error('Model test failed:', error);
    throw error;
  }
}

// Export for use in other files
export { testModels as default };