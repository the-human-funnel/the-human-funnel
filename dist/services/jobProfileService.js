"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobProfileService = exports.JobProfileService = void 0;
const schemas_1 = require("../models/schemas");
const database_1 = require("../utils/database");
const mongoose_1 = require("mongoose");
class JobProfileService {
    async createJobProfile(data) {
        try {
            this.validateScoringWeights(data.scoringWeights);
            this.validateRequiredFields(data);
            const jobProfile = new schemas_1.JobProfileModel({
                ...data,
                id: new mongoose_1.Types.ObjectId().toString(),
                createdAt: new Date(),
                updatedAt: new Date()
            });
            const savedProfile = await jobProfile.save();
            return this.toJobProfile(savedProfile);
        }
        catch (error) {
            throw (0, database_1.handleMongoError)(error);
        }
    }
    async getJobProfileById(id) {
        try {
            const profile = await schemas_1.JobProfileModel.findOne({ id }).exec();
            return profile ? this.toJobProfile(profile) : null;
        }
        catch (error) {
            throw (0, database_1.handleMongoError)(error);
        }
    }
    async getJobProfiles(filters) {
        try {
            const query = {};
            if (filters?.title) {
                query.title = { $regex: filters.title, $options: 'i' };
            }
            if (filters?.experienceLevel) {
                query.experienceLevel = filters.experienceLevel;
            }
            if (filters?.createdAfter || filters?.createdBefore) {
                query.createdAt = {};
                if (filters.createdAfter) {
                    query.createdAt.$gte = filters.createdAfter;
                }
                if (filters.createdBefore) {
                    query.createdAt.$lte = filters.createdBefore;
                }
            }
            const profiles = await schemas_1.JobProfileModel.find(query)
                .sort({ createdAt: -1 })
                .exec();
            return profiles.map(profile => this.toJobProfile(profile));
        }
        catch (error) {
            throw (0, database_1.handleMongoError)(error);
        }
    }
    async updateJobProfile(data) {
        try {
            if (data.scoringWeights) {
                this.validateScoringWeights(data.scoringWeights);
            }
            const { id, ...updateData } = data;
            updateData.updatedAt = new Date();
            const updatedProfile = await schemas_1.JobProfileModel.findOneAndUpdate({ id }, { $set: updateData }, { new: true, runValidators: true }).exec();
            return updatedProfile ? this.toJobProfile(updatedProfile) : null;
        }
        catch (error) {
            throw (0, database_1.handleMongoError)(error);
        }
    }
    async deleteJobProfile(id) {
        try {
            const result = await schemas_1.JobProfileModel.deleteOne({ id }).exec();
            return result.deletedCount > 0;
        }
        catch (error) {
            throw (0, database_1.handleMongoError)(error);
        }
    }
    async jobProfileExists(id) {
        try {
            const count = await schemas_1.JobProfileModel.countDocuments({ id }).exec();
            return count > 0;
        }
        catch (error) {
            throw (0, database_1.handleMongoError)(error);
        }
    }
    async getJobProfilesCount(filters) {
        try {
            const query = {};
            if (filters?.title) {
                query.title = { $regex: filters.title, $options: 'i' };
            }
            if (filters?.experienceLevel) {
                query.experienceLevel = filters.experienceLevel;
            }
            if (filters?.createdAfter || filters?.createdBefore) {
                query.createdAt = {};
                if (filters.createdAfter) {
                    query.createdAt.$gte = filters.createdAfter;
                }
                if (filters.createdBefore) {
                    query.createdAt.$lte = filters.createdBefore;
                }
            }
            return await schemas_1.JobProfileModel.countDocuments(query).exec();
        }
        catch (error) {
            throw (0, database_1.handleMongoError)(error);
        }
    }
    validateScoringWeights(weights) {
        const total = weights.resumeAnalysis + weights.linkedInAnalysis +
            weights.githubAnalysis + weights.interviewPerformance;
        if (Math.abs(total - 100) > 0.01) {
            throw new database_1.DatabaseError(`Scoring weights must sum to 100%. Current total: ${total}%`, 'VALIDATION_ERROR', 400);
        }
        Object.entries(weights).forEach(([key, value]) => {
            if (value < 0 || value > 100) {
                throw new database_1.DatabaseError(`Scoring weight for ${key} must be between 0 and 100. Got: ${value}`, 'VALIDATION_ERROR', 400);
            }
        });
    }
    validateRequiredFields(data) {
        const requiredFields = ['title', 'description', 'requiredSkills', 'experienceLevel', 'scoringWeights', 'interviewQuestions'];
        for (const field of requiredFields) {
            if (!data[field]) {
                throw new database_1.DatabaseError(`Required field missing: ${field}`, 'VALIDATION_ERROR', 400);
            }
        }
        if (data.requiredSkills.length === 0) {
            throw new database_1.DatabaseError('At least one required skill must be specified', 'VALIDATION_ERROR', 400);
        }
        if (data.interviewQuestions.length === 0) {
            throw new database_1.DatabaseError('At least one interview question must be specified', 'VALIDATION_ERROR', 400);
        }
    }
    toJobProfile(doc) {
        return {
            id: doc.id,
            title: doc.title,
            description: doc.description,
            requiredSkills: doc.requiredSkills,
            experienceLevel: doc.experienceLevel,
            scoringWeights: doc.scoringWeights,
            interviewQuestions: doc.interviewQuestions,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        };
    }
}
exports.JobProfileService = JobProfileService;
exports.jobProfileService = new JobProfileService();
//# sourceMappingURL=jobProfileService.js.map