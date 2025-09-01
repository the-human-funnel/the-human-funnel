# User Manual

This manual provides step-by-step instructions for using the Job Candidate Filtering Funnel System to screen and evaluate job candidates.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Job Profile Management](#job-profile-management)
3. [Candidate Processing](#candidate-processing)
4. [Candidate Review and Analysis](#candidate-review-and-analysis)
5. [Report Generation](#report-generation)
6. [System Administration](#system-administration)
7. [Best Practices](#best-practices)
8. [Frequently Asked Questions](#frequently-asked-questions)

## Getting Started

### System Overview

The Job Candidate Filtering Funnel System automates the candidate screening process through multiple analysis stages:

1. **Resume Processing** - Extract text and contact information from PDF resumes
2. **AI Analysis** - Evaluate resume content against job requirements using AI
3. **LinkedIn Analysis** - Assess professional credibility and experience
4. **GitHub Analysis** - Evaluate technical skills and project authenticity
5. **AI Interview** - Conduct automated phone interviews with candidates
6. **Comprehensive Scoring** - Generate weighted scores and recommendations

### Accessing the System

1. **Web Interface:** Navigate to `http://your-domain.com` in your web browser
2. **Login:** Use your provided username and password
3. **Dashboard:** After login, you'll see the main dashboard with navigation options

### System Requirements

- **Browser:** Chrome, Firefox, Safari, or Edge (latest versions)
- **Internet Connection:** Stable connection required for AI processing
- **File Formats:** PDF files for resume uploads (max 10MB per file)

## Job Profile Management

### Creating a Job Profile

A job profile defines the requirements and scoring criteria for a specific position.

#### Step 1: Navigate to Job Profiles
1. Click **"Job Profiles"** in the main navigation
2. Click **"Create New Profile"** button

#### Step 2: Basic Information
Fill in the following required fields:

- **Job Title:** e.g., "Senior Software Engineer"
- **Description:** Detailed job description and requirements
- **Experience Level:** Select from dropdown (Junior, Mid-level, Senior, Executive)
- **Required Skills:** Add skills one by one (e.g., JavaScript, React, Node.js)

#### Step 3: Configure Scoring Weights
Set the importance of each analysis stage (must total 100%):

- **Resume Analysis:** Weight for AI resume evaluation (recommended: 25%)
- **LinkedIn Analysis:** Weight for professional profile assessment (recommended: 20%)
- **GitHub Analysis:** Weight for technical skills evaluation (recommended: 25%)
- **Interview Performance:** Weight for AI interview results (recommended: 30%)

#### Step 4: Interview Questions
Add 5-10 role-specific questions for the AI interview:

- Focus on technical competencies
- Include behavioral questions
- Keep questions clear and specific

#### Step 5: Save and Activate
1. Review all information
2. Click **"Save Job Profile"**
3. The profile is now ready for candidate processing

### Managing Existing Job Profiles

#### Viewing Job Profiles
- **List View:** See all job profiles with basic information
- **Search:** Filter profiles by title or skills
- **Sort:** Order by creation date, title, or last used

#### Editing Job Profiles
1. Click **"Edit"** next to the profile name
2. Modify any fields as needed
3. **Important:** Changing scoring weights will affect future candidate processing
4. Click **"Save Changes"**

#### Deleting Job Profiles
1. Click **"Delete"** next to the profile name
2. **Warning:** This action cannot be undone
3. Confirm deletion in the popup dialog

## Candidate Processing

### Uploading Resumes

#### Single File Upload
1. Navigate to **"Process Candidates"**
2. Select the job profile from the dropdown
3. Click **"Choose File"** and select a PDF resume
4. Click **"Upload and Process"**

#### Bulk Upload (Recommended)
1. Navigate to **"Process Candidates"**
2. Select the job profile from the dropdown
3. **Drag and drop** multiple PDF files into the upload area, or
4. Click **"Choose Files"** and select multiple PDFs (up to 100 files)
5. Click **"Start Batch Processing"**

#### Upload Requirements
- **File Format:** PDF only
- **File Size:** Maximum 10MB per file
- **File Names:** Use descriptive names (e.g., "john_doe_resume.pdf")
- **Content:** Ensure PDFs contain selectable text (not scanned images)

### Monitoring Processing Progress

#### Batch Progress Tracking
1. After starting batch processing, you'll see a progress screen
2. **Real-time Updates:** Progress bar shows completion percentage
3. **Stage Breakdown:** See how many candidates are in each processing stage
4. **Estimated Time:** System provides completion time estimates
5. **Error Tracking:** Failed processing attempts are logged and displayed

#### Processing Stages
Each candidate goes through these stages:

1. **Resume Processing** (1-2 minutes)
   - Text extraction from PDF
   - Contact information parsing
   - URL extraction (LinkedIn, GitHub, projects)

2. **AI Analysis** (2-3 minutes)
   - Resume content evaluation against job requirements
   - Skills matching and gap analysis
   - Experience assessment

3. **LinkedIn Analysis** (1-2 minutes)
   - Professional profile verification
   - Experience validation
   - Network and credibility assessment

4. **GitHub Analysis** (2-4 minutes)
   - Repository analysis
   - Code quality assessment
   - Project authenticity verification

5. **AI Interview** (10-15 minutes)
   - Automated phone call scheduling
   - Interview conduct and recording
   - Transcript generation

6. **Interview Analysis** (2-3 minutes)
   - Transcript evaluation
   - Response scoring
   - Communication assessment

7. **Final Scoring** (1 minute)
   - Weighted score calculation
   - Ranking and recommendation generation

### Handling Processing Issues

#### Common Issues and Solutions

**Resume Processing Failed:**
- Check if PDF is corrupted or password-protected
- Ensure file contains selectable text
- Try re-uploading the file

**AI Analysis Failed:**
- System automatically retries with different AI providers
- If all providers fail, candidate is marked for manual review

**LinkedIn/GitHub Profile Not Found:**
- System continues processing without this data
- Final score is adjusted for missing information

**Interview Call Failed:**
- System automatically retries up to 3 times
- Candidate can be marked for manual interview

## Candidate Review and Analysis

### Candidate Dashboard

#### Accessing Candidates
1. Navigate to **"Candidates"**
2. Select the job profile from the filter dropdown
3. View the list of processed candidates

#### Candidate List Features

**Sorting Options:**
- **Score (High to Low):** Default sorting by composite score
- **Processing Date:** Most recently processed first
- **Name:** Alphabetical order
- **Recommendation:** Group by hire/no-hire recommendations

**Filtering Options:**
- **Score Range:** Filter by minimum/maximum scores
- **Processing Status:** Show only completed or in-progress candidates
- **Recommendation:** Filter by strong-hire, hire, maybe, or no-hire
- **Profile Availability:** Filter by LinkedIn/GitHub profile availability

**Search:**
- Search by candidate name
- Search by skills or keywords
- Search by email or phone number

### Individual Candidate Review

#### Candidate Summary Card
Each candidate shows:
- **Name and Contact Information**
- **Composite Score** (0-100) with visual indicator
- **Recommendation** (Strong Hire, Hire, Maybe, No Hire)
- **Processing Status** and completion date
- **Quick Action Buttons** (View Details, Generate Report, Mark for Interview)

#### Detailed Candidate View
Click **"View Details"** to see comprehensive analysis:

**Resume Analysis Section:**
- Extracted text preview
- Skills matching results
- Experience assessment
- AI reasoning and confidence score

**LinkedIn Analysis Section:**
- Professional experience summary
- Network and endorsement metrics
- Credibility indicators
- Profile accessibility status

**GitHub Analysis Section:**
- Repository statistics
- Code quality assessment
- Project authenticity verification
- Technical skills evidence

**Interview Analysis Section:**
- Interview transcript (if available)
- Performance scores breakdown
- Communication assessment
- Detailed response analysis

**Final Scoring Section:**
- Weighted score breakdown
- Stage-by-stage scores
- Recommendation reasoning
- Confidence indicators

### Candidate Actions

#### Mark for Manual Review
1. Click **"Mark for Review"** on candidate card
2. Add notes about why manual review is needed
3. Candidate is flagged for human recruiter attention

#### Schedule Manual Interview
1. Click **"Schedule Interview"** 
2. Add interview notes and scheduling information
3. System tracks manual interview status

#### Export Candidate Data
1. Select candidates using checkboxes
2. Click **"Export Selected"**
3. Choose format (CSV or PDF)
4. Download generated file

## Report Generation

### Individual Candidate Reports

#### Generating PDF Reports
1. Navigate to candidate details page
2. Click **"Generate Report"** button
3. Report is generated and automatically downloaded
4. Report includes all analysis results and recommendations

#### Report Contents
- **Executive Summary:** Key findings and recommendation
- **Contact Information:** Phone, email, LinkedIn, GitHub
- **Score Breakdown:** Visual charts and detailed scoring
- **Analysis Results:** Complete findings from all stages
- **Interview Transcript:** Full conversation record (if available)
- **Recommendations:** Hiring decision guidance

### Batch Reports

#### Batch Summary Reports
1. Navigate to **"Reports"** section
2. Select the job profile and date range
3. Click **"Generate Batch Summary"**
4. Report includes statistics and top candidates

#### Batch Report Contents
- **Processing Statistics:** Success rates, timing, errors
- **Score Distribution:** Charts showing candidate score ranges
- **Top Candidates:** Highest-scoring candidates with summaries
- **Recommendations Summary:** Breakdown by recommendation categories
- **Quality Metrics:** Analysis quality and confidence indicators

### Data Export

#### CSV Export Options
1. Navigate to **"Candidates"** section
2. Apply desired filters
3. Click **"Export to CSV"**
4. Choose fields to include:
   - Basic information (name, contact, scores)
   - Detailed analysis results
   - Interview transcripts
   - Custom field selection

#### Export Use Cases
- **Spreadsheet Analysis:** Import into Excel for custom analysis
- **ATS Integration:** Import into your existing recruiting system
- **Reporting:** Create custom reports and dashboards
- **Backup:** Maintain records of candidate evaluations

## System Administration

### User Management

#### Adding New Users
1. Navigate to **"Admin"** → **"Users"**
2. Click **"Add New User"**
3. Fill in user details and role
4. Send login credentials to new user

#### User Roles
- **Admin:** Full system access and configuration
- **Recruiter:** Can create job profiles and process candidates
- **Viewer:** Read-only access to candidates and reports

### System Configuration

#### AI Provider Settings
1. Navigate to **"Admin"** → **"Settings"**
2. Configure API keys for AI providers
3. Set provider priority and fallback options
4. Test connectivity to ensure proper configuration

#### Processing Settings
- **Batch Size:** Number of candidates processed simultaneously
- **Timeout Settings:** Maximum time for each processing stage
- **Retry Logic:** Number of retry attempts for failed operations
- **Quality Thresholds:** Minimum quality scores for automatic processing

### Monitoring and Maintenance

#### System Health Dashboard
- **Processing Queue Status:** Monitor active and pending jobs
- **API Status:** Check connectivity to external services
- **Error Rates:** Track processing failures and success rates
- **Performance Metrics:** Response times and throughput

#### Regular Maintenance Tasks
- **Database Cleanup:** Remove old processed candidates (configurable retention)
- **Log Rotation:** Manage application log files
- **Backup Verification:** Ensure regular backups are working
- **Security Updates:** Keep system dependencies updated

## Best Practices

### Job Profile Creation

#### Effective Job Descriptions
- **Be Specific:** Clearly define required skills and experience
- **Prioritize Requirements:** Distinguish between must-have and nice-to-have skills
- **Update Regularly:** Keep job profiles current with changing requirements

#### Scoring Weight Guidelines
- **Resume Analysis (20-30%):** Good for initial screening
- **LinkedIn Analysis (15-25%):** Important for senior roles
- **GitHub Analysis (20-30%):** Critical for technical positions
- **Interview Performance (25-35%):** Key for final decision making

#### Interview Questions
- **Technical Questions:** Test specific skills mentioned in job requirements
- **Behavioral Questions:** Assess cultural fit and soft skills
- **Scenario-Based:** Present realistic work situations
- **Clear and Concise:** Avoid ambiguous or leading questions

### Candidate Processing

#### Resume Quality
- **Encourage Standard Formats:** Request PDFs with selectable text
- **File Naming:** Use consistent naming conventions
- **Batch Sizes:** Process 20-50 candidates at a time for optimal performance

#### Review Process
- **Regular Monitoring:** Check processing progress regularly
- **Quality Control:** Review a sample of AI analysis results
- **Manual Review:** Flag edge cases for human evaluation
- **Feedback Loop:** Use results to improve job profiles and questions

### Data Management

#### Privacy and Security
- **Data Retention:** Set appropriate retention policies
- **Access Control:** Limit access to candidate data
- **Secure Storage:** Ensure sensitive information is protected
- **Audit Trail:** Maintain logs of who accessed what data

#### Backup and Recovery
- **Regular Backups:** Schedule automatic backups
- **Test Restores:** Periodically verify backup integrity
- **Disaster Recovery:** Have a plan for system failures
- **Data Export:** Regularly export important data

## Frequently Asked Questions

### General Questions

**Q: How long does it take to process a candidate?**
A: Complete processing typically takes 15-25 minutes per candidate, depending on the availability of LinkedIn/GitHub profiles and interview scheduling.

**Q: Can I process candidates without LinkedIn or GitHub profiles?**
A: Yes, the system adjusts scoring automatically when profile data is unavailable. The final score is normalized based on available information.

**Q: What happens if an AI interview call fails?**
A: The system automatically retries up to 3 times. If all attempts fail, the candidate is marked for manual interview and scoring continues with available data.

**Q: How accurate are the AI analysis results?**
A: AI analysis accuracy varies by resume quality and job complexity. The system provides confidence scores and we recommend manual review for borderline cases.

### Technical Questions

**Q: What file formats are supported for resumes?**
A: Currently, only PDF files are supported. The PDFs must contain selectable text (not scanned images).

**Q: Can I integrate this system with our existing ATS?**
A: Yes, the system provides CSV export functionality and REST APIs for integration with external systems.

**Q: How do I handle candidates with private LinkedIn/GitHub profiles?**
A: The system gracefully handles private profiles by adjusting the scoring weights and noting the limitation in the candidate report.

**Q: What should I do if processing gets stuck?**
A: Check the system health dashboard for any service issues. You can restart failed jobs or contact support if problems persist.

### Scoring and Evaluation

**Q: How are final scores calculated?**
A: Final scores are weighted averages of all completed analysis stages, normalized to account for missing data. The system uses the scoring weights defined in your job profile.

**Q: What do the recommendation categories mean?**
A: 
- **Strong Hire (85+):** Exceptional candidates who exceed requirements
- **Hire (70-84):** Good candidates who meet most requirements  
- **Maybe (50-69):** Candidates with potential but some concerns
- **No Hire (<50):** Candidates who don't meet minimum requirements

**Q: Can I adjust scores after processing?**
A: Scores are automatically calculated and cannot be manually adjusted. However, you can add notes and override recommendations for individual candidates.

**Q: How do I handle bias in AI analysis?**
A: The system uses multiple AI providers and focuses on job-relevant criteria. We recommend regular review of results and adjustment of job profiles to ensure fair evaluation.

### Troubleshooting

**Q: Why did resume processing fail?**
A: Common causes include corrupted PDFs, password-protected files, or image-only PDFs. Try re-uploading or converting the file to a standard PDF format.

**Q: What should I do if the system is running slowly?**
A: Check your internet connection and system load. Large batches may take longer to process. Consider processing smaller batches during peak usage times.

**Q: How do I get help with technical issues?**
A: Check the troubleshooting guide first, then contact your system administrator or support team with specific error messages and steps to reproduce the issue.

For additional support, please refer to the troubleshooting guide or contact your system administrator.