import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface JobProfile {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  experienceLevel: string;
  scoringWeights: {
    resumeAnalysis: number;
    linkedInAnalysis: number;
    githubAnalysis: number;
    interviewPerformance: number;
  };
  interviewQuestions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: string;
  resumeData: {
    fileName: string;
    extractedText: string;
    contactInfo: {
      phone?: string;
      email?: string;
      linkedInUrl?: string;
      githubUrl?: string;
      projectUrls: string[];
    };
  };
  finalScore?: {
    compositeScore: number;
    stageScores: {
      resumeAnalysis: number;
      linkedInAnalysis: number;
      githubAnalysis: number;
      interviewPerformance: number;
    };
    rank: number;
    recommendation: string;
  };
  processingStage: string;
  createdAt: string;
}

export interface ProcessingBatch {
  id: string;
  jobProfileId: string;
  totalCandidates: number;
  processedCandidates: number;
  failedCandidates: number;
  status: string;
  startedAt: string;
  completedAt?: string;
}

// Job Profile API
export const jobProfileApi = {
  getAll: () => api.get<JobProfile[]>('/job-profiles'),
  getById: (id: string) => api.get<JobProfile>(`/job-profiles/${id}`),
  create: (data: Omit<JobProfile, 'id' | 'createdAt' | 'updatedAt'>) => 
    api.post<JobProfile>('/job-profiles', data),
  update: (id: string, data: Partial<JobProfile>) => 
    api.put<JobProfile>(`/job-profiles/${id}`, data),
  delete: (id: string) => api.delete(`/job-profiles/${id}`),
};

// Resume Upload API
export const resumeApi = {
  uploadBatch: (formData: FormData) => 
    api.post<{ batchId: string; message: string }>('/resumes/upload-batch', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
};

// Candidate API
export const candidateApi = {
  getAll: (params?: { 
    jobProfileId?: string; 
    stage?: string; 
    minScore?: number;
    page?: number;
    limit?: number;
  }) => api.get<{ candidates: Candidate[]; total: number }>('/candidates', { params }),
  getById: (id: string) => api.get<Candidate>(`/candidates/${id}`),
  exportReport: (id: string, format: 'pdf' | 'csv') => 
    api.get(`/candidates/${id}/report?format=${format}`, { responseType: 'blob' }),
  exportBatch: (batchId: string, format: 'pdf' | 'csv') => 
    api.get(`/candidates/batch/${batchId}/export?format=${format}`, { responseType: 'blob' }),
};

// Batch Processing API
export const batchApi = {
  getAll: () => api.get<ProcessingBatch[]>('/batches'),
  getById: (id: string) => api.get<ProcessingBatch>(`/batches/${id}`),
  getProgress: (id: string) => api.get<ProcessingBatch>(`/batches/${id}/progress`),
};

export default api;