// MongoDB schemas with proper indexing for performance
import { Schema, model, Document } from 'mongoose';
import { 
  JobProfile, 
  Candidate, 
  ResumeData, 
  ProcessingBatch,
  AIAnalysisResult,
  LinkedInAnalysis,
  GitHubAnalysis,
  InterviewSession,
  CandidateScore
} from './interfaces';

// JobProfile Schema
const jobProfileSchema = new Schema<JobProfile & Document>({
  title: { type: String, required: true, index: true },
  description: { type: String, required: true },
  requiredSkills: [{ type: String, required: true }],
  experienceLevel: { type: String, required: true, index: true },
  scoringWeights: {
    resumeAnalysis: { type: Number, required: true, min: 0, max: 100 },
    linkedInAnalysis: { type: Number, required: true, min: 0, max: 100 },
    githubAnalysis: { type: Number, required: true, min: 0, max: 100 },
    interviewPerformance: { type: Number, required: true, min: 0, max: 100 }
  },
  interviewQuestions: [{ type: String, required: true }],
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

// Add validation for scoring weights to sum to 100%
jobProfileSchema.pre('save', function(next) {
  const weights = this.scoringWeights;
  const total = weights.resumeAnalysis + weights.linkedInAnalysis + 
                weights.githubAnalysis + weights.interviewPerformance;
  
  if (Math.abs(total - 100) > 0.01) { // Allow for small floating point errors
    return next(new Error('Scoring weights must sum to 100%'));
  }
  
  this.updatedAt = new Date();
  next();
});

// ResumeData Schema
const resumeDataSchema = new Schema({
  fileName: { type: String, required: true },
  extractedText: { type: String, required: true },
  contactInfo: {
    phone: { type: String },
    email: { type: String, index: true },
    linkedInUrl: { type: String },
    githubUrl: { type: String },
    projectUrls: [{ type: String }]
  },
  processingStatus: { 
    type: String, 
    enum: ['pending', 'completed', 'failed'], 
    default: 'pending',
    index: true 
  },
  extractionErrors: [{ type: String }]
});

// AI Analysis Result Schema
const aiAnalysisResultSchema = new Schema({
  candidateId: { type: String, required: true, index: true },
  provider: { 
    type: String, 
    enum: ['gemini', 'openai', 'claude'], 
    required: true 
  },
  relevanceScore: { type: Number, required: true, min: 0, max: 100 },
  skillsMatch: {
    matched: [{ type: String }],
    missing: [{ type: String }]
  },
  experienceAssessment: { type: String, required: true },
  reasoning: { type: String, required: true },
  confidence: { type: Number, required: true, min: 0, max: 1 }
});

// LinkedIn Analysis Schema
const linkedInAnalysisSchema = new Schema({
  candidateId: { type: String, required: true, index: true },
  profileAccessible: { type: Boolean, required: true },
  professionalScore: { type: Number, required: true, min: 0, max: 100 },
  experience: {
    totalYears: { type: Number, required: true, min: 0 },
    relevantRoles: { type: Number, required: true, min: 0 },
    companyQuality: { type: String, required: true }
  },
  network: {
    connections: { type: Number, required: true, min: 0 },
    endorsements: { type: Number, required: true, min: 0 }
  },
  credibilityIndicators: [{ type: String }]
});

// GitHub Analysis Schema
const gitHubAnalysisSchema = new Schema({
  candidateId: { type: String, required: true, index: true },
  profileStats: {
    publicRepos: { type: Number, required: true, min: 0 },
    followers: { type: Number, required: true, min: 0 },
    contributionStreak: { type: Number, required: true, min: 0 },
    totalCommits: { type: Number, required: true, min: 0 }
  },
  technicalScore: { type: Number, required: true, min: 0, max: 100 },
  projectAuthenticity: {
    resumeProjects: [{
      url: { type: String, required: true },
      isAuthentic: { type: Boolean, required: true },
      commitHistory: { type: Number, required: true, min: 0 },
      branchingPattern: { type: String, required: true },
      codeQuality: { type: String, required: true }
    }]
  },
  skillsEvidence: [{ type: String }]
});

// Interview Session Schema
const interviewSessionSchema = new Schema({
  candidateId: { type: String, required: true, index: true },
  jobProfileId: { type: String, required: true, index: true },
  vapiCallId: { type: String, required: true, unique: true },
  scheduledAt: { type: Date, required: true, index: true },
  status: { 
    type: String, 
    enum: ['scheduled', 'in-progress', 'completed', 'failed', 'no-answer'], 
    default: 'scheduled',
    index: true 
  },
  transcript: { type: String },
  duration: { type: Number, min: 0 },
  callQuality: { 
    type: String, 
    enum: ['excellent', 'good', 'poor'],
    default: 'good'
  },
  retryCount: { type: Number, default: 0, min: 0, max: 3 }
});

// Candidate Score Schema
const candidateScoreSchema = new Schema({
  candidateId: { type: String, required: true, index: true },
  jobProfileId: { type: String, required: true, index: true },
  compositeScore: { type: Number, required: true, min: 0, max: 100, index: true },
  stageScores: {
    resumeAnalysis: { type: Number, required: true, min: 0, max: 100 },
    linkedInAnalysis: { type: Number, required: true, min: 0, max: 100 },
    githubAnalysis: { type: Number, required: true, min: 0, max: 100 },
    interviewPerformance: { type: Number, required: true, min: 0, max: 100 }
  },
  appliedWeights: {
    resumeAnalysis: { type: Number, required: true, min: 0, max: 100 },
    linkedInAnalysis: { type: Number, required: true, min: 0, max: 100 },
    githubAnalysis: { type: Number, required: true, min: 0, max: 100 },
    interviewPerformance: { type: Number, required: true, min: 0, max: 100 }
  },
  rank: { type: Number, required: true, min: 1, index: true },
  recommendation: { 
    type: String, 
    enum: ['strong-hire', 'hire', 'maybe', 'no-hire'], 
    required: true,
    index: true 
  },
  reasoning: { type: String, required: true }
});

// Candidate Schema (main entity)
const candidateSchema = new Schema<Candidate & Document>({
  resumeData: { type: resumeDataSchema, required: true },
  aiAnalysis: { type: aiAnalysisResultSchema },
  linkedInAnalysis: { type: linkedInAnalysisSchema },
  githubAnalysis: { type: gitHubAnalysisSchema },
  interviewSession: { type: interviewSessionSchema },
  finalScore: { type: candidateScoreSchema },
  processingStage: { 
    type: String, 
    enum: ['resume', 'ai-analysis', 'linkedin', 'github', 'interview', 'scoring', 'completed'], 
    default: 'resume',
    index: true 
  },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
candidateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// ProcessingBatch Schema
const processingBatchSchema = new Schema<ProcessingBatch & Document>({
  jobProfileId: { type: String, required: true, index: true },
  totalCandidates: { type: Number, required: true, min: 0 },
  processedCandidates: { type: Number, default: 0, min: 0 },
  failedCandidates: { type: Number, default: 0, min: 0 },
  status: { 
    type: String, 
    enum: ['processing', 'completed', 'failed'], 
    default: 'processing',
    index: true 
  },
  startedAt: { type: Date, default: Date.now, index: true },
  completedAt: { type: Date },
  candidateIds: [{ type: String, required: true }]
});

// Add validation to ensure processed + failed <= total
processingBatchSchema.pre('save', function(next) {
  if (this.processedCandidates + this.failedCandidates > this.totalCandidates) {
    return next(new Error('Processed + failed candidates cannot exceed total candidates'));
  }
  
  // Auto-complete batch when all candidates are processed
  if (this.processedCandidates + this.failedCandidates === this.totalCandidates && 
      this.status === 'processing') {
    this.status = 'completed';
    this.completedAt = new Date();
  }
  
  next();
});

// Create compound indexes for better query performance
candidateSchema.index({ processingStage: 1, createdAt: -1 });
candidateSchema.index({ 'finalScore.compositeScore': -1, 'finalScore.jobProfileId': 1 });
candidateSchema.index({ 'resumeData.contactInfo.email': 1 }, { sparse: true });

processingBatchSchema.index({ jobProfileId: 1, status: 1 });
processingBatchSchema.index({ startedAt: -1 });

interviewSessionSchema.index({ candidateId: 1, jobProfileId: 1 });
interviewSessionSchema.index({ scheduledAt: 1, status: 1 });

// Export models
export const JobProfileModel = model<JobProfile & Document>('JobProfile', jobProfileSchema);
export const CandidateModel = model<Candidate & Document>('Candidate', candidateSchema);
export const ProcessingBatchModel = model<ProcessingBatch & Document>('ProcessingBatch', processingBatchSchema);