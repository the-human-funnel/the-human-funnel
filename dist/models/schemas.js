"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessingBatchModel = exports.CandidateModel = exports.JobProfileModel = void 0;
const mongoose_1 = require("mongoose");
const jobProfileSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    requiredSkills: [{ type: String, required: true }],
    experienceLevel: { type: String, required: true },
    scoringWeights: {
        resumeAnalysis: { type: Number, required: true, min: 0, max: 100 },
        linkedInAnalysis: { type: Number, required: true, min: 0, max: 100 },
        githubAnalysis: { type: Number, required: true, min: 0, max: 100 },
        interviewPerformance: { type: Number, required: true, min: 0, max: 100 }
    },
    interviewQuestions: [{ type: String, required: true }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
jobProfileSchema.pre('save', function (next) {
    const weights = this.scoringWeights;
    const total = weights.resumeAnalysis + weights.linkedInAnalysis +
        weights.githubAnalysis + weights.interviewPerformance;
    if (Math.abs(total - 100) > 0.01) {
        return next(new Error('Scoring weights must sum to 100%'));
    }
    this.updatedAt = new Date();
    next();
});
const resumeDataSchema = new mongoose_1.Schema({
    fileName: { type: String, required: true },
    extractedText: { type: String, required: true },
    contactInfo: {
        phone: { type: String },
        email: { type: String },
        linkedInUrl: { type: String },
        githubUrl: { type: String },
        projectUrls: [{ type: String }]
    },
    processingStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
    extractionErrors: [{ type: String }]
});
const aiAnalysisResultSchema = new mongoose_1.Schema({
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
const linkedInAnalysisSchema = new mongoose_1.Schema({
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
const gitHubAnalysisSchema = new mongoose_1.Schema({
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
const interviewSessionSchema = new mongoose_1.Schema({
    candidateId: { type: String, required: true, index: true },
    jobProfileId: { type: String, required: true, index: true },
    vapiCallId: { type: String, required: true, unique: true },
    scheduledAt: { type: Date, required: true, index: true },
    status: {
        type: String,
        enum: ['scheduled', 'in-progress', 'completed', 'failed', 'no-answer'],
        default: 'scheduled',
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
const candidateScoreSchema = new mongoose_1.Schema({
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
    },
    reasoning: { type: String, required: true }
});
const candidateSchema = new mongoose_1.Schema({
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
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
candidateSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});
const processingBatchSchema = new mongoose_1.Schema({
    jobProfileId: { type: String, required: true, index: true },
    totalCandidates: { type: Number, required: true, min: 0 },
    processedCandidates: { type: Number, default: 0, min: 0 },
    failedCandidates: { type: Number, default: 0, min: 0 },
    status: {
        type: String,
        enum: ['processing', 'completed', 'failed'],
        default: 'processing',
    },
    startedAt: { type: Date, default: Date.now, index: true },
    completedAt: { type: Date },
    candidateIds: [{ type: String, required: true }]
});
processingBatchSchema.pre('save', function (next) {
    if (this.processedCandidates + this.failedCandidates > this.totalCandidates) {
        return next(new Error('Processed + failed candidates cannot exceed total candidates'));
    }
    if (this.processedCandidates + this.failedCandidates === this.totalCandidates &&
        this.status === 'processing') {
        this.status = 'completed';
        this.completedAt = new Date();
    }
    next();
});
exports.JobProfileModel = (0, mongoose_1.model)('JobProfile', jobProfileSchema);
exports.CandidateModel = (0, mongoose_1.model)('Candidate', candidateSchema);
exports.ProcessingBatchModel = (0, mongoose_1.model)('ProcessingBatch', processingBatchSchema);
//# sourceMappingURL=schemas.js.map