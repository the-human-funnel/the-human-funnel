import { Db } from 'mongodb';

export default {
  version: '003',
  description: 'Initialize system settings and configuration',
  
  async up(db: Db): Promise<void> {
    const systemSettings = [
      {
        key: 'processing.maxBatchSize',
        value: 100,
        description: 'Maximum number of resumes that can be processed in a single batch',
        type: 'number',
        updatedAt: new Date()
      },
      {
        key: 'processing.maxRetries',
        value: 3,
        description: 'Maximum number of retry attempts for failed processing stages',
        type: 'number',
        updatedAt: new Date()
      },
      {
        key: 'ai.primaryProvider',
        value: 'gemini',
        description: 'Primary AI provider for resume analysis',
        type: 'string',
        allowedValues: ['gemini', 'openai', 'claude'],
        updatedAt: new Date()
      },
      {
        key: 'ai.fallbackProviders',
        value: ['openai', 'claude'],
        description: 'Fallback AI providers in order of preference',
        type: 'array',
        updatedAt: new Date()
      },
      {
        key: 'scoring.defaultWeights',
        value: {
          resumeAnalysis: 25,
          linkedInAnalysis: 20,
          githubAnalysis: 25,
          interviewPerformance: 30
        },
        description: 'Default scoring weights for new job profiles',
        type: 'object',
        updatedAt: new Date()
      },
      {
        key: 'interview.maxRetries',
        value: 2,
        description: 'Maximum number of interview call attempts',
        type: 'number',
        updatedAt: new Date()
      },
      {
        key: 'interview.callTimeoutMinutes',
        value: 15,
        description: 'Maximum duration for interview calls in minutes',
        type: 'number',
        updatedAt: new Date()
      },
      {
        key: 'security.sessionTimeoutHours',
        value: 8,
        description: 'User session timeout in hours',
        type: 'number',
        updatedAt: new Date()
      },
      {
        key: 'reports.retentionDays',
        value: 90,
        description: 'Number of days to retain candidate reports',
        type: 'number',
        updatedAt: new Date()
      },
      {
        key: 'notifications.emailEnabled',
        value: false,
        description: 'Enable email notifications for batch completion',
        type: 'boolean',
        updatedAt: new Date()
      }
    ];

    await db.collection('systemSettings').insertMany(systemSettings);
    console.log(`✓ Inserted ${systemSettings.length} system settings`);
  },

  async down(db: Db): Promise<void> {
    const settingKeys = [
      'processing.maxBatchSize',
      'processing.maxRetries',
      'ai.primaryProvider',
      'ai.fallbackProviders',
      'scoring.defaultWeights',
      'interview.maxRetries',
      'interview.callTimeoutMinutes',
      'security.sessionTimeoutHours',
      'reports.retentionDays',
      'notifications.emailEnabled'
    ];

    const result = await db.collection('systemSettings').deleteMany({
      key: { $in: settingKeys }
    });

    console.log(`✓ Removed ${result.deletedCount} system settings`);
  }
};