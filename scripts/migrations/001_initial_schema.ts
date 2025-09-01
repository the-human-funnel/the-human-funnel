import { Db } from 'mongodb';

export default {
  version: '001',
  description: 'Create initial database schema and indexes',
  
  async up(db: Db): Promise<void> {
    // Create job profiles collection with indexes
    await db.createCollection('jobProfiles');
    await db.collection('jobProfiles').createIndexes([
      { key: { title: 1 }, name: 'title_index' },
      { key: { createdAt: -1 }, name: 'created_at_index' },
      { key: { 'scoringWeights.resumeAnalysis': 1, 'scoringWeights.linkedInAnalysis': 1, 'scoringWeights.githubAnalysis': 1, 'scoringWeights.interviewPerformance': 1 }, name: 'scoring_weights_index' }
    ]);

    // Create candidates collection with indexes
    await db.createCollection('candidates');
    await db.collection('candidates').createIndexes([
      { key: { 'resumeData.contactInfo.email': 1 }, name: 'email_index', sparse: true },
      { key: { 'resumeData.contactInfo.phone': 1 }, name: 'phone_index', sparse: true },
      { key: { processingStage: 1 }, name: 'processing_stage_index' },
      { key: { createdAt: -1 }, name: 'created_at_index' },
      { key: { 'finalScore.compositeScore': -1 }, name: 'composite_score_index', sparse: true },
      { key: { 'finalScore.jobProfileId': 1, 'finalScore.compositeScore': -1 }, name: 'job_score_index', sparse: true }
    ]);

    // Create processing batches collection with indexes
    await db.createCollection('processingBatches');
    await db.collection('processingBatches').createIndexes([
      { key: { jobProfileId: 1 }, name: 'job_profile_index' },
      { key: { status: 1 }, name: 'status_index' },
      { key: { startedAt: -1 }, name: 'started_at_index' }
    ]);

    // Create users collection for authentication
    await db.createCollection('users');
    await db.collection('users').createIndexes([
      { key: { username: 1 }, name: 'username_index', unique: true },
      { key: { email: 1 }, name: 'email_index', unique: true, sparse: true }
    ]);

    // Create audit logs collection
    await db.createCollection('auditLogs');
    await db.collection('auditLogs').createIndexes([
      { key: { timestamp: -1 }, name: 'timestamp_index' },
      { key: { userId: 1, timestamp: -1 }, name: 'user_timestamp_index' },
      { key: { action: 1 }, name: 'action_index' }
    ]);

    // Create system settings collection
    await db.createCollection('systemSettings');
    await db.collection('systemSettings').createIndex(
      { key: 1 }, 
      { name: 'key_index', unique: true }
    );

    console.log('✓ Created collections and indexes');
  },

  async down(db: Db): Promise<void> {
    // Drop all collections
    const collections = ['jobProfiles', 'candidates', 'processingBatches', 'users', 'auditLogs', 'systemSettings'];
    
    for (const collection of collections) {
      try {
        await db.collection(collection).drop();
        console.log(`✓ Dropped collection: ${collection}`);
      } catch (error) {
        console.log(`Collection ${collection} does not exist, skipping`);
      }
    }
  }
};