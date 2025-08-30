import puppeteer from 'puppeteer';
import { 
  Candidate, 
  JobProfile, 
  ProcessingBatch,
  CandidateScore,
  AIAnalysisResult,
  LinkedInAnalysis,
  GitHubAnalysis,
  InterviewSession,
  InterviewAnalysisResult
} from '../models/interfaces';
import * as path from 'path';
import { promises as fs } from 'fs';

export interface CandidateReport {
  candidate: Candidate;
  jobProfile: JobProfile;
  completionStatus: {
    resumeProcessed: boolean;
    aiAnalysisCompleted: boolean;
    linkedInAnalysisCompleted: boolean;
    githubAnalysisCompleted: boolean;
    interviewCompleted: boolean;
    scoringCompleted: boolean;
  };
  reportGeneratedAt: Date;
}

export interface BatchSummaryReport {
  batch: ProcessingBatch;
  jobProfile: JobProfile;
  candidateReports: CandidateReport[];
  summary: {
    totalCandidates: number;
    completedCandidates: number;
    failedCandidates: number;
    averageScore: number;
    topCandidates: Candidate[];
    processingTime: number;
  };
  reportGeneratedAt: Date;
}

export class ReportGenerationService {
  private reportsDir: string;

  constructor() {
    this.reportsDir = path.join(process.cwd(), 'reports');
    this.ensureReportsDirectory();
  }

  private async ensureReportsDirectory(): Promise<void> {
    try {
      await fs.access(this.reportsDir);
    } catch {
      await fs.mkdir(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Generate a comprehensive report for a single candidate
   */
  async generateCandidateReport(
    candidate: Candidate, 
    jobProfile: JobProfile,
    interviewAnalysis?: InterviewAnalysisResult
  ): Promise<CandidateReport> {
    const completionStatus = this.assessCompletionStatus(candidate);
    
    const report: CandidateReport = {
      candidate,
      jobProfile,
      completionStatus,
      reportGeneratedAt: new Date()
    };

    return report;
  }

  /**
   * Generate PDF report for a single candidate
   */
  async generateCandidatePDF(
    candidate: Candidate, 
    jobProfile: JobProfile,
    interviewAnalysis?: InterviewAnalysisResult
  ): Promise<string> {
    const report = await this.generateCandidateReport(candidate, jobProfile, interviewAnalysis);
    const htmlContent = this.generateCandidateHTML(report, interviewAnalysis);
    
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const fileName = `candidate_${candidate.id}_${Date.now()}.pdf`;
    const filePath = path.join(this.reportsDir, fileName);
    
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });
    
    await browser.close();
    return filePath;
  }

  /**
   * Generate batch summary report
   */
  async generateBatchSummaryReport(
    batch: ProcessingBatch,
    candidates: Candidate[],
    jobProfile: JobProfile,
    interviewAnalyses?: InterviewAnalysisResult[]
  ): Promise<BatchSummaryReport> {
    const candidateReports = await Promise.all(
      candidates.map(candidate => {
        const interviewAnalysis = interviewAnalyses?.find(
          analysis => analysis.candidateId === candidate.id
        );
        return this.generateCandidateReport(candidate, jobProfile, interviewAnalysis);
      })
    );

    const completedCandidates = candidateReports.filter(
      report => report.completionStatus.scoringCompleted
    );

    const scores = completedCandidates
      .map(report => report.candidate.finalScore?.compositeScore || 0)
      .filter(score => score > 0);

    const averageScore = scores.length > 0 
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
      : 0;

    const topCandidates = completedCandidates
      .sort((a, b) => (b.candidate.finalScore?.compositeScore || 0) - (a.candidate.finalScore?.compositeScore || 0))
      .slice(0, 10)
      .map(report => report.candidate);

    const processingTime = batch.completedAt && batch.startedAt
      ? (batch.completedAt.getTime() - batch.startedAt.getTime()) / (1000 * 60 * 60) // hours
      : 0;

    return {
      batch,
      jobProfile,
      candidateReports,
      summary: {
        totalCandidates: batch.totalCandidates,
        completedCandidates: completedCandidates.length,
        failedCandidates: batch.failedCandidates,
        averageScore,
        topCandidates,
        processingTime
      },
      reportGeneratedAt: new Date()
    };
  }

  /**
   * Generate PDF for batch summary report
   */
  async generateBatchSummaryPDF(
    batch: ProcessingBatch,
    candidates: Candidate[],
    jobProfile: JobProfile,
    interviewAnalyses?: InterviewAnalysisResult[]
  ): Promise<string> {
    const report = await this.generateBatchSummaryReport(batch, candidates, jobProfile, interviewAnalyses);
    const htmlContent = this.generateBatchSummaryHTML(report);
    
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const fileName = `batch_summary_${batch.id}_${Date.now()}.pdf`;
    const filePath = path.join(this.reportsDir, fileName);
    
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });
    
    await browser.close();
    return filePath;
  }

  /**
   * Export candidates data to CSV
   */
  async exportCandidatesCSV(
    candidates: Candidate[],
    jobProfile: JobProfile,
    interviewAnalyses?: InterviewAnalysisResult[]
  ): Promise<string> {
    const fileName = `candidates_export_${Date.now()}.csv`;
    const filePath = path.join(this.reportsDir, fileName);

    // CSV headers
    const headers = [
      'Candidate ID', 'Resume File', 'Email', 'Phone', 'LinkedIn URL', 'GitHub URL',
      'Processing Stage', 'Composite Score', 'Resume Score', 'LinkedIn Score', 
      'GitHub Score', 'Interview Score', 'Recommendation', 'AI Provider',
      'Skills Matched', 'Skills Missing', 'Interview Status', 'Call Quality', 'Created At'
    ];

    // Convert data to CSV format
    const csvRows = [headers.join(',')];

    candidates.forEach(candidate => {
      const interviewAnalysis = interviewAnalyses?.find(
        analysis => analysis.candidateId === candidate.id
      );

      const row = [
        this.escapeCsvValue(candidate.id),
        this.escapeCsvValue(candidate.resumeData.fileName),
        this.escapeCsvValue(candidate.resumeData.contactInfo.email || ''),
        this.escapeCsvValue(candidate.resumeData.contactInfo.phone || ''),
        this.escapeCsvValue(candidate.resumeData.contactInfo.linkedInUrl || ''),
        this.escapeCsvValue(candidate.resumeData.contactInfo.githubUrl || ''),
        this.escapeCsvValue(candidate.processingStage),
        candidate.finalScore?.compositeScore || 0,
        candidate.finalScore?.stageScores.resumeAnalysis || 0,
        candidate.finalScore?.stageScores.linkedInAnalysis || 0,
        candidate.finalScore?.stageScores.githubAnalysis || 0,
        candidate.finalScore?.stageScores.interviewPerformance || 0,
        this.escapeCsvValue(candidate.finalScore?.recommendation || 'pending'),
        this.escapeCsvValue(candidate.aiAnalysis?.provider || ''),
        this.escapeCsvValue(candidate.aiAnalysis?.skillsMatch.matched.join(', ') || ''),
        this.escapeCsvValue(candidate.aiAnalysis?.skillsMatch.missing.join(', ') || ''),
        this.escapeCsvValue(candidate.interviewSession?.status || 'not-scheduled'),
        this.escapeCsvValue(candidate.interviewSession?.callQuality || ''),
        this.escapeCsvValue(candidate.createdAt.toISOString())
      ];

      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    await fs.writeFile(filePath, csvContent, 'utf-8');
    return filePath;
  }

  /**
   * Escape CSV values to handle commas, quotes, and newlines
   */
  private escapeCsvValue(value: string | number): string {
    if (typeof value === 'number') {
      return value.toString();
    }
    
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    
    return value;
  }

  /**
   * Assess completion status of candidate processing
   */
  private assessCompletionStatus(candidate: Candidate) {
    return {
      resumeProcessed: candidate.resumeData.processingStatus === 'completed',
      aiAnalysisCompleted: !!candidate.aiAnalysis,
      linkedInAnalysisCompleted: !!candidate.linkedInAnalysis,
      githubAnalysisCompleted: !!candidate.githubAnalysis,
      interviewCompleted: candidate.interviewSession?.status === 'completed',
      scoringCompleted: !!candidate.finalScore
    };
  }
  /**

   * Generate HTML content for candidate report
   */
  private generateCandidateHTML(report: CandidateReport, interviewAnalysis?: InterviewAnalysisResult): string {
    const { candidate, jobProfile, completionStatus } = report;
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Candidate Report - ${candidate.resumeData.fileName}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .header { border-bottom: 3px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #007bff; margin: 0; }
        .header .job-title { color: #666; font-size: 18px; margin-top: 5px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #007bff; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        .section h3 { color: #333; margin-top: 20px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .info-item { margin-bottom: 10px; }
        .info-label { font-weight: bold; color: #555; }
        .score-box { background: #f8f9fa; border: 1px solid #ddd; padding: 15px; border-radius: 5px; text-align: center; }
        .score-high { background: #d4edda; border-color: #c3e6cb; }
        .score-medium { background: #fff3cd; border-color: #ffeaa7; }
        .score-low { background: #f8d7da; border-color: #f5c6cb; }
        .status-complete { color: #28a745; font-weight: bold; }
        .status-incomplete { color: #dc3545; font-weight: bold; }
        .skills-list { display: flex; flex-wrap: wrap; gap: 5px; }
        .skill-tag { background: #007bff; color: white; padding: 3px 8px; border-radius: 3px; font-size: 12px; }
        .skill-missing { background: #dc3545; }
        .recommendation { padding: 15px; border-radius: 5px; font-weight: bold; text-align: center; }
        .rec-strong-hire { background: #d4edda; color: #155724; }
        .rec-hire { background: #d1ecf1; color: #0c5460; }
        .rec-maybe { background: #fff3cd; color: #856404; }
        .rec-no-hire { background: #f8d7da; color: #721c24; }
        .incomplete-section { background: #f8f9fa; border: 1px dashed #ddd; padding: 15px; text-align: center; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Candidate Assessment Report</h1>
        <div class="job-title">Position: ${jobProfile.title}</div>
        <div>Generated: ${report.reportGeneratedAt.toLocaleString()}</div>
      </div>

      <div class="section">
        <h2>Candidate Information</h2>
        <div class="info-grid">
          <div>
            <div class="info-item">
              <span class="info-label">Resume File:</span> ${candidate.resumeData.fileName}
            </div>
            <div class="info-item">
              <span class="info-label">Email:</span> ${candidate.resumeData.contactInfo.email || 'Not provided'}
            </div>
            <div class="info-item">
              <span class="info-label">Phone:</span> ${candidate.resumeData.contactInfo.phone || 'Not provided'}
            </div>
          </div>
          <div>
            <div class="info-item">
              <span class="info-label">LinkedIn:</span> ${candidate.resumeData.contactInfo.linkedInUrl || 'Not provided'}
            </div>
            <div class="info-item">
              <span class="info-label">GitHub:</span> ${candidate.resumeData.contactInfo.githubUrl || 'Not provided'}
            </div>
            <div class="info-item">
              <span class="info-label">Processing Stage:</span> ${candidate.processingStage}
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Processing Status</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Resume Processing:</span> 
            <span class="${completionStatus.resumeProcessed ? 'status-complete' : 'status-incomplete'}">
              ${completionStatus.resumeProcessed ? 'Complete' : 'Incomplete'}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">AI Analysis:</span> 
            <span class="${completionStatus.aiAnalysisCompleted ? 'status-complete' : 'status-incomplete'}">
              ${completionStatus.aiAnalysisCompleted ? 'Complete' : 'Incomplete'}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">LinkedIn Analysis:</span> 
            <span class="${completionStatus.linkedInAnalysisCompleted ? 'status-complete' : 'status-incomplete'}">
              ${completionStatus.linkedInAnalysisCompleted ? 'Complete' : 'Incomplete'}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">GitHub Analysis:</span> 
            <span class="${completionStatus.githubAnalysisCompleted ? 'status-complete' : 'status-incomplete'}">
              ${completionStatus.githubAnalysisCompleted ? 'Complete' : 'Incomplete'}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">Interview:</span> 
            <span class="${completionStatus.interviewCompleted ? 'status-complete' : 'status-incomplete'}">
              ${completionStatus.interviewCompleted ? 'Complete' : 'Incomplete'}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">Final Scoring:</span> 
            <span class="${completionStatus.scoringCompleted ? 'status-complete' : 'status-incomplete'}">
              ${completionStatus.scoringCompleted ? 'Complete' : 'Incomplete'}
            </span>
          </div>
        </div>
      </div>

      ${this.generateScoreSection(candidate)}
      ${this.generateAIAnalysisSection(candidate)}
      ${this.generateLinkedInSection(candidate)}
      ${this.generateGitHubSection(candidate)}
      ${this.generateInterviewSection(candidate, interviewAnalysis)}
      ${this.generateRecommendationSection(candidate)}

    </body>
    </html>
    `;
  }

  /**
   * Generate HTML content for batch summary report
   */
  private generateBatchSummaryHTML(report: BatchSummaryReport): string {
    const { batch, jobProfile, summary } = report;
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Batch Summary Report - ${jobProfile.title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .header { border-bottom: 3px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #007bff; margin: 0; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #007bff; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .stat-box { background: #f8f9fa; border: 1px solid #ddd; padding: 20px; border-radius: 5px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
        .stat-label { color: #666; margin-top: 5px; }
        .candidate-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .candidate-table th, .candidate-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .candidate-table th { background: #f8f9fa; font-weight: bold; }
        .candidate-table tr:nth-child(even) { background: #f9f9f9; }
        .score-high { color: #28a745; font-weight: bold; }
        .score-medium { color: #ffc107; font-weight: bold; }
        .score-low { color: #dc3545; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Batch Processing Summary Report</h1>
        <div>Position: ${jobProfile.title}</div>
        <div>Batch ID: ${batch.id}</div>
        <div>Generated: ${report.reportGeneratedAt.toLocaleString()}</div>
      </div>

      <div class="section">
        <h2>Processing Statistics</h2>
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-number">${summary.totalCandidates}</div>
            <div class="stat-label">Total Candidates</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${summary.completedCandidates}</div>
            <div class="stat-label">Completed</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${summary.failedCandidates}</div>
            <div class="stat-label">Failed</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${summary.averageScore.toFixed(1)}</div>
            <div class="stat-label">Average Score</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${summary.processingTime.toFixed(1)}h</div>
            <div class="stat-label">Processing Time</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Top Candidates</h2>
        <table class="candidate-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Resume File</th>
              <th>Email</th>
              <th>Composite Score</th>
              <th>Recommendation</th>
              <th>Processing Stage</th>
            </tr>
          </thead>
          <tbody>
            ${summary.topCandidates.map((candidate, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${candidate.resumeData.fileName}</td>
                <td>${candidate.resumeData.contactInfo.email || 'N/A'}</td>
                <td class="${this.getScoreClass(candidate.finalScore?.compositeScore || 0)}">
                  ${candidate.finalScore?.compositeScore?.toFixed(1) || 'N/A'}
                </td>
                <td>${candidate.finalScore?.recommendation || 'pending'}</td>
                <td>${candidate.processingStage}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2>Job Profile Details</h2>
        <div><strong>Description:</strong> ${jobProfile.description}</div>
        <div><strong>Experience Level:</strong> ${jobProfile.experienceLevel}</div>
        <div><strong>Required Skills:</strong> ${jobProfile.requiredSkills.join(', ')}</div>
        <div><strong>Scoring Weights:</strong></div>
        <ul>
          <li>Resume Analysis: ${jobProfile.scoringWeights.resumeAnalysis}%</li>
          <li>LinkedIn Analysis: ${jobProfile.scoringWeights.linkedInAnalysis}%</li>
          <li>GitHub Analysis: ${jobProfile.scoringWeights.githubAnalysis}%</li>
          <li>Interview Performance: ${jobProfile.scoringWeights.interviewPerformance}%</li>
        </ul>
      </div>

    </body>
    </html>
    `;
  }

  private generateScoreSection(candidate: Candidate): string {
    if (!candidate.finalScore) {
      return `
        <div class="section">
          <h2>Final Scores</h2>
          <div class="incomplete-section">
            Scoring not yet completed for this candidate
          </div>
        </div>
      `;
    }

    const score = candidate.finalScore;
    return `
      <div class="section">
        <h2>Final Scores</h2>
        <div class="info-grid">
          <div class="score-box ${this.getScoreClass(score.compositeScore)}">
            <h3>Composite Score</h3>
            <div style="font-size: 2em; font-weight: bold;">${score.compositeScore.toFixed(1)}</div>
          </div>
          <div class="recommendation ${this.getRecommendationClass(score.recommendation)}">
            ${score.recommendation.toUpperCase()}
          </div>
        </div>
        
        <h3>Stage Scores</h3>
        <div class="info-grid">
          <div class="score-box ${this.getScoreClass(score.stageScores.resumeAnalysis)}">
            <div>Resume Analysis</div>
            <div style="font-size: 1.5em; font-weight: bold;">${score.stageScores.resumeAnalysis.toFixed(1)}</div>
            <div style="font-size: 0.8em;">Weight: ${score.appliedWeights.resumeAnalysis}%</div>
          </div>
          <div class="score-box ${this.getScoreClass(score.stageScores.linkedInAnalysis)}">
            <div>LinkedIn Analysis</div>
            <div style="font-size: 1.5em; font-weight: bold;">${score.stageScores.linkedInAnalysis.toFixed(1)}</div>
            <div style="font-size: 0.8em;">Weight: ${score.appliedWeights.linkedInAnalysis}%</div>
          </div>
          <div class="score-box ${this.getScoreClass(score.stageScores.githubAnalysis)}">
            <div>GitHub Analysis</div>
            <div style="font-size: 1.5em; font-weight: bold;">${score.stageScores.githubAnalysis.toFixed(1)}</div>
            <div style="font-size: 0.8em;">Weight: ${score.appliedWeights.githubAnalysis}%</div>
          </div>
          <div class="score-box ${this.getScoreClass(score.stageScores.interviewPerformance)}">
            <div>Interview Performance</div>
            <div style="font-size: 1.5em; font-weight: bold;">${score.stageScores.interviewPerformance.toFixed(1)}</div>
            <div style="font-size: 0.8em;">Weight: ${score.appliedWeights.interviewPerformance}%</div>
          </div>
        </div>
        
        <h3>Reasoning</h3>
        <p>${score.reasoning}</p>
      </div>
    `;
  }

  private generateAIAnalysisSection(candidate: Candidate): string {
    if (!candidate.aiAnalysis) {
      return `
        <div class="section">
          <h2>AI Resume Analysis</h2>
          <div class="incomplete-section">
            AI analysis not yet completed for this candidate
          </div>
        </div>
      `;
    }

    const analysis = candidate.aiAnalysis;
    return `
      <div class="section">
        <h2>AI Resume Analysis</h2>
        <div class="info-item">
          <span class="info-label">AI Provider:</span> ${analysis.provider}
        </div>
        <div class="info-item">
          <span class="info-label">Relevance Score:</span> 
          <span class="${this.getScoreClass(analysis.relevanceScore)}">${analysis.relevanceScore}/100</span>
        </div>
        <div class="info-item">
          <span class="info-label">Confidence:</span> ${analysis.confidence}%
        </div>
        
        <h3>Skills Assessment</h3>
        <div>
          <strong>Matched Skills:</strong>
          <div class="skills-list">
            ${analysis.skillsMatch.matched.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
          </div>
        </div>
        <div style="margin-top: 10px;">
          <strong>Missing Skills:</strong>
          <div class="skills-list">
            ${analysis.skillsMatch.missing.map(skill => `<span class="skill-tag skill-missing">${skill}</span>`).join('')}
          </div>
        </div>
        
        <h3>Experience Assessment</h3>
        <p>${analysis.experienceAssessment}</p>
        
        <h3>Analysis Reasoning</h3>
        <p>${analysis.reasoning}</p>
      </div>
    `;
  }

  private generateLinkedInSection(candidate: Candidate): string {
    if (!candidate.linkedInAnalysis) {
      return `
        <div class="section">
          <h2>LinkedIn Analysis</h2>
          <div class="incomplete-section">
            LinkedIn analysis not yet completed for this candidate
          </div>
        </div>
      `;
    }

    const analysis = candidate.linkedInAnalysis;
    return `
      <div class="section">
        <h2>LinkedIn Analysis</h2>
        <div class="info-item">
          <span class="info-label">Profile Accessible:</span> ${analysis.profileAccessible ? 'Yes' : 'No'}
        </div>
        <div class="info-item">
          <span class="info-label">Professional Score:</span> 
          <span class="${this.getScoreClass(analysis.professionalScore)}">${analysis.professionalScore}/100</span>
        </div>
        
        <h3>Professional Experience</h3>
        <div class="info-item">
          <span class="info-label">Total Years:</span> ${analysis.experience.totalYears}
        </div>
        <div class="info-item">
          <span class="info-label">Relevant Roles:</span> ${analysis.experience.relevantRoles}
        </div>
        <div class="info-item">
          <span class="info-label">Company Quality:</span> ${analysis.experience.companyQuality}
        </div>
        
        <h3>Network & Endorsements</h3>
        <div class="info-item">
          <span class="info-label">Connections:</span> ${analysis.network.connections}
        </div>
        <div class="info-item">
          <span class="info-label">Endorsements:</span> ${analysis.network.endorsements}
        </div>
        
        <h3>Credibility Indicators</h3>
        <ul>
          ${analysis.credibilityIndicators.map(indicator => `<li>${indicator}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  private generateGitHubSection(candidate: Candidate): string {
    if (!candidate.githubAnalysis) {
      return `
        <div class="section">
          <h2>GitHub Analysis</h2>
          <div class="incomplete-section">
            GitHub analysis not yet completed for this candidate
          </div>
        </div>
      `;
    }

    const analysis = candidate.githubAnalysis;
    return `
      <div class="section">
        <h2>GitHub Analysis</h2>
        <div class="info-item">
          <span class="info-label">Technical Score:</span> 
          <span class="${this.getScoreClass(analysis.technicalScore)}">${analysis.technicalScore}/100</span>
        </div>
        
        <h3>Profile Statistics</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Public Repositories:</span> ${analysis.profileStats.publicRepos}
          </div>
          <div class="info-item">
            <span class="info-label">Followers:</span> ${analysis.profileStats.followers}
          </div>
          <div class="info-item">
            <span class="info-label">Contribution Streak:</span> ${analysis.profileStats.contributionStreak} days
          </div>
          <div class="info-item">
            <span class="info-label">Total Commits:</span> ${analysis.profileStats.totalCommits}
          </div>
        </div>
        
        <h3>Project Authenticity</h3>
        ${analysis.projectAuthenticity.resumeProjects.map(project => `
          <div style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 5px;">
            <div><strong>Project:</strong> ${project.url}</div>
            <div><strong>Authentic:</strong> ${project.isAuthentic ? 'Yes' : 'No'}</div>
            <div><strong>Commits:</strong> ${project.commitHistory}</div>
            <div><strong>Branching:</strong> ${project.branchingPattern}</div>
            <div><strong>Code Quality:</strong> ${project.codeQuality}</div>
          </div>
        `).join('')}
        
        <h3>Skills Evidence</h3>
        <div class="skills-list">
          ${analysis.skillsEvidence.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
        </div>
      </div>
    `;
  }

  private generateInterviewSection(candidate: Candidate, interviewAnalysis?: InterviewAnalysisResult): string {
    if (!candidate.interviewSession) {
      return `
        <div class="section">
          <h2>Interview Analysis</h2>
          <div class="incomplete-section">
            Interview not yet scheduled for this candidate
          </div>
        </div>
      `;
    }

    const session = candidate.interviewSession;
    let content = `
      <div class="section">
        <h2>Interview Analysis</h2>
        <div class="info-item">
          <span class="info-label">Status:</span> ${session.status}
        </div>
        <div class="info-item">
          <span class="info-label">Scheduled:</span> ${session.scheduledAt.toLocaleString()}
        </div>
        <div class="info-item">
          <span class="info-label">Duration:</span> ${session.duration ? `${session.duration} minutes` : 'N/A'}
        </div>
        <div class="info-item">
          <span class="info-label">Call Quality:</span> ${session.callQuality}
        </div>
    `;

    if (interviewAnalysis) {
      content += `
        <h3>Performance Scores</h3>
        <div class="info-grid">
          <div class="score-box ${this.getScoreClass(interviewAnalysis.performanceScore)}">
            <div>Overall Performance</div>
            <div style="font-size: 1.5em; font-weight: bold;">${interviewAnalysis.performanceScore}/100</div>
          </div>
          <div class="score-box ${this.getScoreClass(interviewAnalysis.communicationScore)}">
            <div>Communication</div>
            <div style="font-size: 1.5em; font-weight: bold;">${interviewAnalysis.communicationScore}/100</div>
          </div>
          <div class="score-box ${this.getScoreClass(interviewAnalysis.technicalScore)}">
            <div>Technical Skills</div>
            <div style="font-size: 1.5em; font-weight: bold;">${interviewAnalysis.technicalScore}/100</div>
          </div>
        </div>
        
        <h3>Detailed Feedback</h3>
        <div>
          <strong>Strengths:</strong>
          <ul>
            ${interviewAnalysis.detailedFeedback.strengths.map(strength => `<li>${strength}</li>`).join('')}
          </ul>
        </div>
        <div>
          <strong>Areas for Improvement:</strong>
          <ul>
            ${interviewAnalysis.detailedFeedback.weaknesses.map(weakness => `<li>${weakness}</li>`).join('')}
          </ul>
        </div>
        
        <h3>Overall Assessment</h3>
        <p>${interviewAnalysis.overallAssessment}</p>
      `;
    } else if (session.status === 'completed') {
      content += `
        <div class="incomplete-section">
          Interview completed but analysis not yet available
        </div>
      `;
    }

    content += `</div>`;
    return content;
  }

  private generateRecommendationSection(candidate: Candidate): string {
    if (!candidate.finalScore) {
      return `
        <div class="section">
          <h2>Final Recommendation</h2>
          <div class="incomplete-section">
            Final recommendation not yet available
          </div>
        </div>
      `;
    }

    return `
      <div class="section">
        <h2>Final Recommendation</h2>
        <div class="recommendation ${this.getRecommendationClass(candidate.finalScore.recommendation)}">
          ${candidate.finalScore.recommendation.toUpperCase().replace('-', ' ')}
        </div>
        <p><strong>Reasoning:</strong> ${candidate.finalScore.reasoning}</p>
        <p><strong>Rank:</strong> #${candidate.finalScore.rank}</p>
      </div>
    `;
  }

  private getScoreClass(score: number): string {
    if (score >= 70) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
  }

  private getRecommendationClass(recommendation: string): string {
    switch (recommendation) {
      case 'strong-hire': return 'rec-strong-hire';
      case 'hire': return 'rec-hire';
      case 'maybe': return 'rec-maybe';
      case 'no-hire': return 'rec-no-hire';
      default: return '';
    }
  }
}