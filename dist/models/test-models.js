"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testModels = testModels;
exports.default = testModels;
const schemas_1 = require("./schemas");
async function testModels() {
    try {
        console.log('Testing data models...');
        const jobProfileData = {
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
        const jobProfile = new schemas_1.JobProfileModel(jobProfileData);
        console.log('JobProfile model created successfully');
        const candidateData = {
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
        const candidate = new schemas_1.CandidateModel(candidateData);
        console.log('Candidate model created successfully');
        const batchData = {
            jobProfileId: 'job-123',
            totalCandidates: 10,
            processedCandidates: 0,
            failedCandidates: 0,
            candidateIds: ['candidate-1', 'candidate-2', 'candidate-3']
        };
        const batch = new schemas_1.ProcessingBatchModel(batchData);
        console.log('ProcessingBatch model created successfully');
        try {
            const invalidJobProfile = new schemas_1.JobProfileModel({
                ...jobProfileData,
                scoringWeights: {
                    resumeAnalysis: 25,
                    linkedInAnalysis: 25,
                    githubAnalysis: 25,
                    interviewPerformance: 25
                }
            });
            await invalidJobProfile.validate();
            console.log('JobProfile validation passed');
        }
        catch (error) {
            console.log('JobProfile validation error (expected):', error);
        }
        console.log('All model tests completed successfully!');
    }
    catch (error) {
        console.error('Model test failed:', error);
        throw error;
    }
}
//# sourceMappingURL=test-models.js.map