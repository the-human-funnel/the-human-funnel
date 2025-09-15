"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResumeProcessingService = void 0;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const uuid_1 = require("uuid");
class ResumeProcessingService {
    async extractTextFromPDF(pdfBuffer, fileName) {
        try {
            const data = await (0, pdf_parse_1.default)(pdfBuffer);
            return data.text;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to extract text from PDF ${fileName}: ${errorMessage}`);
        }
    }
    parseContactInfo(text) {
        const contactInfo = {
            projectUrls: []
        };
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const emailMatch = text.match(emailRegex);
        if (emailMatch && emailMatch.length > 0) {
            contactInfo.email = emailMatch[0];
        }
        const phoneRegex = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
        const phoneMatch = text.match(phoneRegex);
        if (phoneMatch && phoneMatch.length > 0) {
            contactInfo.phone = phoneMatch[0];
        }
        const linkedInRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?/gi;
        const linkedInMatch = text.match(linkedInRegex);
        if (linkedInMatch && linkedInMatch.length > 0) {
            contactInfo.linkedInUrl = linkedInMatch[0];
        }
        const githubRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9-]+\/?/gi;
        const githubMatch = text.match(githubRegex);
        if (githubMatch && githubMatch.length > 0) {
            contactInfo.githubUrl = githubMatch[0];
        }
        const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
        const allUrls = text.match(urlRegex) || [];
        contactInfo.projectUrls = allUrls.filter(url => {
            const lowerUrl = url.toLowerCase();
            return !lowerUrl.includes('linkedin.com') &&
                !lowerUrl.includes('github.com') &&
                !lowerUrl.includes('mailto:');
        });
        return contactInfo;
    }
    async processSingleResume(pdfBuffer, fileName) {
        const resumeData = {
            id: (0, uuid_1.v4)(),
            fileName,
            extractedText: '',
            contactInfo: { projectUrls: [] },
            processingStatus: 'pending',
            extractionErrors: []
        };
        try {
            resumeData.extractedText = await this.extractTextFromPDF(pdfBuffer, fileName);
            resumeData.contactInfo = this.parseContactInfo(resumeData.extractedText);
            resumeData.processingStatus = 'completed';
        }
        catch (error) {
            resumeData.processingStatus = 'failed';
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            resumeData.extractionErrors = [errorMessage];
        }
        return resumeData;
    }
}
exports.ResumeProcessingService = ResumeProcessingService;
//# sourceMappingURL=resumeProcessingService.js.map