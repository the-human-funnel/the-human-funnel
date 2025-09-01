// MongoDB initialization script for Docker
// This script runs when the MongoDB container starts for the first time

// Switch to the application database
db = db.getSiblingDB('job_filtering_funnel');

// Create application user with read/write permissions
db.createUser({
  user: 'app_user',
  pwd: 'app_password',
  roles: [
    {
      role: 'readWrite',
      db: 'job_filtering_funnel'
    }
  ]
});

// Create collections with validation rules
db.createCollection('jobProfiles', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'description', 'requiredSkills', 'scoringWeights'],
      properties: {
        title: {
          bsonType: 'string',
          description: 'Job title is required and must be a string'
        },
        description: {
          bsonType: 'string',
          description: 'Job description is required and must be a string'
        },
        requiredSkills: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'Required skills must be an array of strings'
        },
        scoringWeights: {
          bsonType: 'object',
          required: ['resumeAnalysis', 'linkedInAnalysis', 'githubAnalysis', 'interviewPerformance'],
          properties: {
            resumeAnalysis: {
              bsonType: 'number',
              minimum: 0,
              maximum: 100
            },
            linkedInAnalysis: {
              bsonType: 'number',
              minimum: 0,
              maximum: 100
            },
            githubAnalysis: {
              bsonType: 'number',
              minimum: 0,
              maximum: 100
            },
            interviewPerformance: {
              bsonType: 'number',
              minimum: 0,
              maximum: 100
            }
          }
        }
      }
    }
  }
});

db.createCollection('candidates', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['resumeData', 'processingStage'],
      properties: {
        processingStage: {
          enum: ['resume', 'ai-analysis', 'linkedin', 'github', 'interview', 'scoring', 'completed'],
          description: 'Processing stage must be one of the allowed values'
        }
      }
    }
  }
});

db.createCollection('processingBatches', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['jobProfileId', 'status'],
      properties: {
        status: {
          enum: ['processing', 'completed', 'failed'],
          description: 'Status must be one of the allowed values'
        }
      }
    }
  }
});

db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['username', 'password', 'role'],
      properties: {
        username: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9_]{3,30}$',
          description: 'Username must be 3-30 characters, alphanumeric and underscore only'
        },
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
          description: 'Must be a valid email address'
        },
        role: {
          enum: ['admin', 'recruiter', 'viewer'],
          description: 'Role must be one of the allowed values'
        }
      }
    }
  }
});

// Create indexes for better performance
db.jobProfiles.createIndex({ title: 1 });
db.jobProfiles.createIndex({ createdAt: -1 });

db.candidates.createIndex({ 'resumeData.contactInfo.email': 1 }, { sparse: true });
db.candidates.createIndex({ processingStage: 1 });
db.candidates.createIndex({ 'finalScore.compositeScore': -1 }, { sparse: true });

db.processingBatches.createIndex({ jobProfileId: 1 });
db.processingBatches.createIndex({ status: 1 });
db.processingBatches.createIndex({ startedAt: -1 });

db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true, sparse: true });

print('MongoDB initialization completed successfully');