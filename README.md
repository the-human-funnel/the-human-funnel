# Job Candidate Filtering Funnel System

An AI-powered recruitment tool that automates the candidate screening process for companies. The system processes large volumes of resumes and filters candidates based on job requirements through multi-stage analysis.

## Project Structure

```
src/
├── index.ts              # Main application entry point
├── models/               # Data models and interfaces
├── services/             # Business logic services
├── routes/               # API route definitions
├── middleware/           # Express middleware
├── queues/               # Job queue definitions and processors
└── utils/                # Utility functions and helpers
    ├── config.ts         # Configuration management
    ├── database.ts       # Database connection utilities
    ├── redis.ts          # Redis connection utilities
    ├── logger.ts         # Logging utilities
    └── validation.ts     # Validation utilities
```

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual configuration values
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Start the application:**
   ```bash
   npm start
   ```

## Development

- **Development mode with auto-reload:**
  ```bash
  npm run dev
  ```

- **Build project:**
  ```bash
  npm run build
  ```

- **Clean build artifacts:**
  ```bash
  npm run clean
  ```

## Core Dependencies

- **Express.js** - Web framework
- **MongoDB** - Database for document storage
- **Redis** - Caching and job queues
- **Bull Queue** - Job queue system
- **TypeScript** - Type safety and development experience

## Environment Variables

See `.env.example` for all required environment variables including:
- Database connections (MongoDB, Redis)
- AI provider API keys (Gemini, OpenAI, Claude)
- External service configurations (LinkedIn scraper, GitHub, VAPI)
- Security and processing settings

## Next Steps

This is the initial project setup. The next tasks will implement:
1. Core data models and database schemas
2. Job profile management service
3. Resume processing and text extraction
4. AI analysis services
5. LinkedIn and GitHub integration
6. Interview scheduling and analysis
7. Scoring and ranking system