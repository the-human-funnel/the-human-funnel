import pdfParse from 'pdf-parse';
import { ResumeData } from '../models/interfaces';
import { v4 as uuidv4 } from 'uuid';

export class ResumeProcessingService {
  
  /**
   * Extract text content from PDF buffer
   */
  async extractTextFromPDF(pdfBuffer: Buffer, fileName: string): Promise<string> {
    try {
      const data = await pdfParse(pdfBuffer);
      return data.text;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to extract text from PDF ${fileName}: ${errorMessage}`);
    }
  }

  /**
   * Parse contact information from extracted text
   */
  parseContactInfo(text: string): ResumeData['contactInfo'] {
    const contactInfo: ResumeData['contactInfo'] = {
      projectUrls: []
    };

    // Email regex pattern
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emailMatch = text.match(emailRegex);
    if (emailMatch && emailMatch.length > 0) {
      contactInfo.email = emailMatch[0];
    }

    // Phone number regex patterns (various formats)
    const phoneRegex = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    const phoneMatch = text.match(phoneRegex);
    if (phoneMatch && phoneMatch.length > 0) {
      contactInfo.phone = phoneMatch[0];
    }

    // LinkedIn URL regex
    const linkedInRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?/gi;
    const linkedInMatch = text.match(linkedInRegex);
    if (linkedInMatch && linkedInMatch.length > 0) {
      contactInfo.linkedInUrl = linkedInMatch[0];
    }

    // GitHub URL regex
    const githubRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9-]+\/?/gi;
    const githubMatch = text.match(githubRegex);
    if (githubMatch && githubMatch.length > 0) {
      contactInfo.githubUrl = githubMatch[0];
    }

    // Project URLs (excluding LinkedIn and GitHub)
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

  /**
   * Process a single resume file
   */
  async processSingleResume(
    pdfBuffer: Buffer, 
    fileName: string
  ): Promise<ResumeData> {
    const resumeData: ResumeData = {
      id: uuidv4(),
      fileName,
      extractedText: '',
      contactInfo: { projectUrls: [] },
      processingStatus: 'pending',
      extractionErrors: []
    };

    try {
      // Extract text from PDF
      resumeData.extractedText = await this.extractTextFromPDF(pdfBuffer, fileName);
      
      // Parse contact information
      resumeData.contactInfo = this.parseContactInfo(resumeData.extractedText);
      
      resumeData.processingStatus = 'completed';
    } catch (error) {
      resumeData.processingStatus = 'failed';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      resumeData.extractionErrors = [errorMessage];
    }

    return resumeData;
  }
}