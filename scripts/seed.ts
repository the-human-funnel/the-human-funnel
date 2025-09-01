#!/usr/bin/env ts-node

import { MongoClient, Db } from 'mongodb';
import * as bcrypt from 'bcryptjs';
import config from '../src/config';

class SeedRunner {
  private client: MongoClient;
  private db: Db;

  constructor() {
    this.client = new MongoClient(config.getAppConfig().database.mongodb.uri);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db();
    console.log('Connected to MongoDB for seeding');
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    console.log('Disconnected from MongoDB');
  }

  async seedDefaultAdmin(): Promise<void> {
    const authSecrets = config.getSecretsConfig();
    const existingAdmin = await this.db.collection('users').findOne({ 
      username: authSecrets.defaultAdminUsername 
    });

    if (existingAdmin) {
      console.log('Default admin user already exists, skipping');
      return;
    }

    const hashedPassword = await bcrypt.hash(
      authSecrets.defaultAdminPassword, 
      config.getAppConfig().security.bcrypt.rounds
    );

    const adminUser = {
      username: authSecrets.defaultAdminUsername,
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'admin',
      permissions: [
        'job_profiles:read',
        'job_profiles:write',
        'job_profiles:delete',
        'candidates:read',
        'candidates:write',
        'candidates:delete',
        'batches:read',
        'batches:write',
        'reports:read',
        'reports:export',
        'system:admin'
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null
    };

    await this.db.collection('users').insertOne(adminUser);
    console.log(`✓ Created default admin user: ${authSecrets.defaultAdminUsername}`);
  }

  async seedTestJobProfiles(): Promise<void> {
    const testProfiles = [
      {
        _id: 'test-junior-developer',
        title: 'Junior Software Developer',
        description: 'Entry-level software developer position for recent graduates',
        requiredSkills: [
          'JavaScript', 'HTML', 'CSS', 'Git', 'Basic Programming Concepts'
        ],
        experienceLevel: 'Entry-level (0-2 years)',
        scoringWeights: {
          resumeAnalysis: 35,
          linkedInAnalysis: 15,
          githubAnalysis: 25,
          interviewPerformance: 25
        },
        interviewQuestions: [
          'What programming languages are you familiar with?',
          'Can you explain what version control is?',
          'How do you approach learning new technologies?',
          'What projects have you worked on recently?'
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: 'test-senior-engineer',
        title: 'Senior Software Engineer',
        description: 'Senior-level position requiring extensive experience and leadership skills',
        requiredSkills: [
          'JavaScript', 'TypeScript', 'React', 'Node.js', 'System Design',
          'Leadership', 'Mentoring', 'Architecture', 'Performance Optimization'
        ],
        experienceLevel: 'Senior-level (5+ years)',
        scoringWeights: {
          resumeAnalysis: 20,
          linkedInAnalysis: 25,
          githubAnalysis: 30,
          interviewPerformance: 25
        },
        interviewQuestions: [
          'How do you approach system design for scalable applications?',
          'Describe your experience mentoring junior developers.',
          'How do you handle technical debt in large codebases?',
          'What is your approach to code reviews?',
          'How do you stay current with technology trends?'
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Check if test profiles already exist
    const existingProfiles = await this.db.collection('jobProfiles').find({
      _id: { $in: testProfiles.map(p => p._id) }
    }).toArray();

    if (existingProfiles.length > 0) {
      console.log('Test job profiles already exist, skipping');
      return;
    }

    await this.db.collection('jobProfiles').insertMany(testProfiles);
    console.log(`✓ Created ${testProfiles.length} test job profiles`);
  }

  async seedDemoData(): Promise<void> {
    // Create a demo processing batch
    const demoBatch = {
      _id: 'demo-batch-001',
      jobProfileId: 'default-software-engineer',
      totalCandidates: 0,
      processedCandidates: 0,
      failedCandidates: 0,
      status: 'completed',
      startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      completedAt: new Date(Date.now() - 23 * 60 * 60 * 1000), // 23 hours ago
      candidateIds: []
    };

    const existingBatch = await this.db.collection('processingBatches').findOne({
      _id: demoBatch._id
    });

    if (!existingBatch) {
      await this.db.collection('processingBatches').insertOne(demoBatch);
      console.log('✓ Created demo processing batch');
    } else {
      console.log('Demo processing batch already exists, skipping');
    }

    // Add some audit log entries
    const auditLogs = [
      {
        userId: 'admin',
        action: 'system.startup',
        resource: 'system',
        details: { message: 'System initialized with seed data' },
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'Seed Script'
      },
      {
        userId: 'admin',
        action: 'job_profile.create',
        resource: 'jobProfiles',
        resourceId: 'default-software-engineer',
        details: { title: 'Software Engineer' },
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'Seed Script'
      }
    ];

    await this.db.collection('auditLogs').insertMany(auditLogs);
    console.log(`✓ Created ${auditLogs.length} audit log entries`);
  }

  async clearAllData(): Promise<void> {
    const collections = ['users', 'jobProfiles', 'candidates', 'processingBatches', 'auditLogs'];
    
    for (const collection of collections) {
      const result = await this.db.collection(collection).deleteMany({});
      console.log(`✓ Cleared ${result.deletedCount} documents from ${collection}`);
    }
  }

  async runSeed(options: { clear?: boolean; demo?: boolean } = {}): Promise<void> {
    if (options.clear) {
      await this.clearAllData();
    }

    await this.seedDefaultAdmin();
    
    if (options.demo) {
      await this.seedTestJobProfiles();
      await this.seedDemoData();
    }

    console.log('✓ Seeding completed successfully');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {
    clear: args.includes('--clear'),
    demo: args.includes('--demo')
  };

  const runner = new SeedRunner();
  
  try {
    await runner.connect();
    await runner.runSeed(options);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await runner.disconnect();
  }
}

if (require.main === module) {
  main();
}

export default SeedRunner;