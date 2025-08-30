import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../../App';

// Mock the API module to avoid network calls during testing
jest.mock('../../services/api', () => ({
  jobProfileApi: {
    getAll: jest.fn().mockResolvedValue({ data: [] }),
  },
  candidateApi: {
    getAll: jest.fn().mockResolvedValue({ data: { candidates: [], total: 0 } }),
  },
  batchApi: {
    getAll: jest.fn().mockResolvedValue({ data: [] }),
  },
}));

test('renders main application title', () => {
  render(<App />);
  const titleElement = screen.getByText(/Job Candidate Filtering System/i);
  expect(titleElement).toBeInTheDocument();
});

test('renders all main navigation tabs', () => {
  render(<App />);
  
  expect(screen.getByText('Job Profiles')).toBeInTheDocument();
  expect(screen.getByText('Upload Resumes')).toBeInTheDocument();
  expect(screen.getByText('Candidates')).toBeInTheDocument();
  expect(screen.getByText('Processing Status')).toBeInTheDocument();
});