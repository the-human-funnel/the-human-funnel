import { ResumeData } from '../models/interfaces';
export declare class ResumeProcessingService {
    extractTextFromPDF(pdfBuffer: Buffer, fileName: string): Promise<string>;
    parseContactInfo(text: string): ResumeData['contactInfo'];
    processSingleResume(pdfBuffer: Buffer, fileName: string): Promise<ResumeData>;
}
//# sourceMappingURL=resumeProcessingService.d.ts.map