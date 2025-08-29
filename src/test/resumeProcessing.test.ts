import { ResumeProcessingService } from '../services/resumeProcessingService';
import { BatchProcessingService, ResumeFile } from '../services/batchProcessingService';
import * as fs from 'fs';
import * as path from 'path';

describe('Resume Processing Service', () => {
  let resumeProcessor: ResumeProcessingService;
  let batchProcessor: BatchProcessingService;

  beforeEach(() => {
    resumeProcessor = new ResumeProcessingService();
    batchProcessor = new BatchProcessingService();
  });

  describe('Contact Information Parsing', () => {
    test('should extract email addresses correctly', () => {
      const text = 'Contact me at john.doe@example.com or jane.smith@company.org';
      const contactInfo = resumeProcessor.parseContactInfo(text);
      expect(contactInfo.email).toBe('john.doe@example.com');
    });

    test('should extract phone numbers in various formats', () => {
      const testCases = [
        '(555) 123-4567',
        '555-123-4567',
        '555.123.4567',
        '555 123 4567',
        '+1 555 123 4567'
      ];

      testCases.forEach(phone => {
        const contactInfo = resumeProcessor.parseContactInfo(`Call me at ${phone}`);
        expect(contactInfo.phone).toBeTruthy();
      });
    });

    test('should extract LinkedIn URLs correctly', () => {
      const testCases = [
        'https://www.linkedin.com/in/johndoe',
        'http://linkedin.com/in/jane-smith',
        'linkedin.com/in/developer123',
        'www.linkedin.com/in/profile-name/'
      ];

      testCases.forEach(url => {
        const contactInfo = resumeProcessor.parseContactInfo(`Profile: ${url}`);
        expect(contactInfo.linkedInUrl).toBeTruthy();
        expect(contactInfo.linkedInUrl?.toLowerCase()).toContain('linkedin.com');
      });
    });

    test('should extract GitHub URLs correctly', () => {
      const testCases = [
        'https://github.com/username',
        'http://www.github.com/developer',
        'github.com/coder123'
      ];

      testCases.forEach(url => {
        const contactInfo = resumeProcessor.parseContactInfo(`Code: ${url}`);
        expect(contactInfo.githubUrl).toBeTruthy();
        expect(contactInfo.githubUrl?.toLowerCase()).toContain('github.com');
      });
    });

    test('should extract project URLs while excluding LinkedIn and GitHub', () => {
      const text = `
        Check out my projects:
        https://myproject.com
        https://www.linkedin.com/in/profile
        https://github.com/username
        http://portfolio.dev
        https://demo.herokuapp.com
      `;

      const contactInfo = resumeProcessor.parseContactInfo(text);
      expect(contactInfo.projectUrls).toHaveLength(3);
      expect(contactInfo.projectUrls).toContain('https://myproject.com');
      expect(contactInfo.projectUrls).toContain('http://portfolio.dev');
      expect(contactInfo.projectUrls).toContain('https://demo.herokuapp.com');
    });

    test('should handle text with no contact information', () => {
      const text = 'This is just some random text without any contact details.';
      const contactInfo = resumeProcessor.parseContactInfo(text);
      
      expect(contactInfo.email).toBeUndefined();
      expect(contactInfo.phone).toBeUndefined();
      expect(contactInfo.linkedInUrl).toBeUndefined();
      expect(contactInfo.githubUrl).toBeUndefined();
      expect(contactInfo.projectUrls).toHaveLength(0);
    });
  });

  describe('PDF Text Extraction', () => {
    test('should handle invalid PDF buffer gracefully', async () => {
      const invalidBuffer = Buffer.from('This is not a PDF file');
      
      await expect(
        resumeProcessor.extractTextFromPDF(invalidBuffer, 'invalid.pdf')
      ).rejects.toThrow('Failed to extract text from PDF invalid.pdf');
    });

    test('should process empty PDF buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      
      await expect(
        resumeProcessor.extractTextFromPDF(emptyBuffer, 'empty.pdf')
      ).rejects.toThrow();
    });
  });

  describe('Single Resume Processing', () => {
    test('should create proper ResumeData structure for failed processing', async () => {
      const invalidBuffer = Buffer.from('invalid pdf content');
      const fileName = 'test-resume.pdf';

      const result = await resumeProcessor.processSingleResume(invalidBuffer, fileName);

      expect(result).toMatchObject({
        id: expect.any(String),
        fileName: fileName,
        extractedText: '',
        contactInfo: { projectUrls: [] },
        processingStatus: 'failed',
        extractionErrors: expect.arrayContaining([expect.any(String)])
      });
    });
  });

  describe('Batch Processing Service', () => {
    test('should initialize with correct default state', () => {
      expect(batchProcessor.getActiveBatches()).toHaveLength(0);
    });

    test('should handle empty file array', async () => {
      const files: ResumeFile[] = [];
      const jobProfileId = 'test-job-profile';

      const batch = await batchProcessor.processBatch(files, jobProfileId);

      expect(batch.totalCandidates).toBe(0);
      expect(batch.processedCandidates).toBe(0);
      expect(batch.status).toBe('completed');
    });

    test('should process batch with invalid files', async () => {
      const files: ResumeFile[] = [
        {
          buffer: Buffer.from('invalid pdf 1'),
          fileName: 'invalid1.pdf'
        },
        {
          buffer: Buffer.from('invalid pdf 2'),
          fileName: 'invalid2.pdf'
        }
      ];

      const jobProfileId = 'test-job-profile';
      const batch = await batchProcessor.processBatch(files, jobProfileId);

      expect(batch.totalCandidates).toBe(2);
      expect(batch.processedCandidates).toBe(2);
      expect(batch.failedCandidates).toBe(2);
      expect(batch.status).toBe('completed');
      expect(batch.candidateIds).toHaveLength(2);
    });

    test('should track progress during batch processing', (done) => {
      const files: ResumeFile[] = [
        { buffer: Buffer.from('file1'), fileName: 'file1.pdf' },
        { buffer: Buffer.from('file2'), fileName: 'file2.pdf' }
      ];

      let progressEvents = 0;

      batchProcessor.on('progress', (progress) => {
        progressEvents++;
        expect(progress.batchId).toBeTruthy();
        expect(progress.totalFiles).toBe(2);
        expect(progress.progress).toBeGreaterThanOrEqual(0);
        expect(progress.progress).toBeLessThanOrEqual(100);
      });

      batchProcessor.on('completed', () => {
        expect(progressEvents).toBeGreaterThan(0);
        done();
      });

      batchProcessor.processBatch(files, 'test-job-profile');
    });

    test('should generate correct batch summary', async () => {
      const files: ResumeFile[] = [
        { buffer: Buffer.from('file1'), fileName: 'file1.pdf' },
        { buffer: Buffer.from('file2'), fileName: 'file2.pdf' }
      ];

      const batch = await batchProcessor.processBatch(files, 'test-job-profile');
      const summary = batchProcessor.generateBatchSummary(batch);

      expect(summary.successRate).toBe(0); // All files are invalid, so 0% success
      expect(summary.summary).toContain('Total Files: 2');
      expect(summary.summary).toContain('Failed: 2');
      expect(summary.processingTime).toBeGreaterThan(0);
    });

    test('should handle batch cancellation', async () => {
      // Start a batch
      const files: ResumeFile[] = [
        { buffer: Buffer.from('file1'), fileName: 'file1.pdf' }
      ];

      const batchPromise = batchProcessor.processBatch(files, 'test-job-profile');
      const batch = await batchPromise;

      // Try to cancel (should fail since it's already completed)
      const cancelled = batchProcessor.cancelBatch(batch.id);
      expect(cancelled).toBe(false);
    });
  });

  describe('URL Extraction Edge Cases', () => {
    test('should handle malformed URLs gracefully', () => {
      const text = `
        Bad URLs:
        http://
        https://
        linkedin.com
        github.com
        www.
        Good URL: https://validsite.com
      `;

      const contactInfo = resumeProcessor.parseContactInfo(text);
      expect(contactInfo.projectUrls).toContain('https://validsite.com');
    });

    test('should extract multiple emails and use the first one', () => {
      const text = 'Primary: first@example.com Secondary: second@example.com';
      const contactInfo = resumeProcessor.parseContactInfo(text);
      expect(contactInfo.email).toBe('first@example.com');
    });

    test('should handle case-insensitive URL matching', () => {
      const text = `
        HTTPS://LINKEDIN.COM/IN/PROFILE
        HTTP://GITHUB.COM/USER
        https://MyProject.COM
      `;

      const contactInfo = resumeProcessor.parseContactInfo(text);
      expect(contactInfo.linkedInUrl?.toLowerCase()).toContain('linkedin.com');
      expect(contactInfo.githubUrl?.toLowerCase()).toContain('github.com');
      expect(contactInfo.projectUrls).toContain('https://MyProject.COM');
    });
  });
});