# Job Profile Management API

This document describes the REST API endpoints for managing job profiles in the Job Candidate Filtering Funnel System.

## Base URL

```
http://localhost:3000/api
```

## Endpoints

### 1. Create Job Profile

**POST** `/job-profiles`

Creates a new job profile with dynamic scoring weights.

#### Request Body

```json
{
  "title": "Senior Software Engineer",
  "description": "Looking for an experienced software engineer with full-stack development skills",
  "requiredSkills": ["JavaScript", "TypeScript", "Node.js", "React", "MongoDB"],
  "experienceLevel": "Senior (5+ years)",
  "scoringWeights": {
    "resumeAnalysis": 25,
    "linkedInAnalysis": 20,
    "githubAnalysis": 25,
    "interviewPerformance": 30
  },
  "interviewQuestions": [
    "Tell me about your experience with Node.js",
    "How do you handle error handling in JavaScript?",
    "Describe your experience with database design"
  ]
}
```

#### Validation Rules

- **title**: Required, non-empty string
- **description**: Required, non-empty string
- **requiredSkills**: Required, non-empty array of strings
- **experienceLevel**: Required, non-empty string
- **scoringWeights**: Required object with four numeric values (0-100) that must sum to exactly 100%
  - `resumeAnalysis`: Weight for resume analysis (0-100)
  - `linkedInAnalysis`: Weight for LinkedIn analysis (0-100)
  - `githubAnalysis`: Weight for GitHub analysis (0-100)
  - `interviewPerformance`: Weight for interview performance (0-100)
- **interviewQuestions**: Required, non-empty array of strings

#### Response

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "title": "Senior Software Engineer",
    "description": "Looking for an experienced software engineer with full-stack development skills",
    "requiredSkills": ["JavaScript", "TypeScript", "Node.js", "React", "MongoDB"],
    "experienceLevel": "Senior (5+ years)",
    "scoringWeights": {
      "resumeAnalysis": 25,
      "linkedInAnalysis": 20,
      "githubAnalysis": 25,
      "interviewPerformance": 30
    },
    "interviewQuestions": [
      "Tell me about your experience with Node.js",
      "How do you handle error handling in JavaScript?",
      "Describe your experience with database design"
    ],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "Job profile created successfully"
}
```

### 2. Get All Job Profiles

**GET** `/job-profiles`

Retrieves all job profiles with optional filtering.

#### Query Parameters

- `title` (optional): Filter by title (case-insensitive partial match)
- `experienceLevel` (optional): Filter by exact experience level
- `createdAfter` (optional): Filter profiles created after this date (ISO 8601 format)
- `createdBefore` (optional): Filter profiles created before this date (ISO 8601 format)

#### Example

```
GET /job-profiles?title=engineer&experienceLevel=Senior
```

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "title": "Senior Software Engineer",
      "description": "Looking for an experienced software engineer",
      "requiredSkills": ["JavaScript", "TypeScript", "Node.js"],
      "experienceLevel": "Senior (5+ years)",
      "scoringWeights": {
        "resumeAnalysis": 25,
        "linkedInAnalysis": 20,
        "githubAnalysis": 25,
        "interviewPerformance": 30
      },
      "interviewQuestions": ["Question 1", "Question 2"],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "count": 1
  },
  "message": "Job profiles retrieved successfully"
}
```

### 3. Get Job Profile by ID

**GET** `/job-profiles/{id}`

Retrieves a specific job profile by its ID.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "title": "Senior Software Engineer",
    "description": "Looking for an experienced software engineer",
    "requiredSkills": ["JavaScript", "TypeScript", "Node.js"],
    "experienceLevel": "Senior (5+ years)",
    "scoringWeights": {
      "resumeAnalysis": 25,
      "linkedInAnalysis": 20,
      "githubAnalysis": 25,
      "interviewPerformance": 30
    },
    "interviewQuestions": ["Question 1", "Question 2"],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "Job profile retrieved successfully"
}
```

### 4. Update Job Profile

**PUT** `/job-profiles/{id}`

Updates an existing job profile. All fields are optional, but if `scoringWeights` is provided, all four weights must be included and sum to 100%.

#### Request Body

```json
{
  "title": "Senior Full-Stack Engineer",
  "description": "Updated description for full-stack role",
  "scoringWeights": {
    "resumeAnalysis": 30,
    "linkedInAnalysis": 15,
    "githubAnalysis": 25,
    "interviewPerformance": 30
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "title": "Senior Full-Stack Engineer",
    "description": "Updated description for full-stack role",
    "requiredSkills": ["JavaScript", "TypeScript", "Node.js"],
    "experienceLevel": "Senior (5+ years)",
    "scoringWeights": {
      "resumeAnalysis": 30,
      "linkedInAnalysis": 15,
      "githubAnalysis": 25,
      "interviewPerformance": 30
    },
    "interviewQuestions": ["Question 1", "Question 2"],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:45:00.000Z"
  },
  "message": "Job profile updated successfully"
}
```

### 5. Delete Job Profile

**DELETE** `/job-profiles/{id}`

Deletes a job profile by its ID.

#### Response

```json
{
  "success": true,
  "message": "Job profile deleted successfully"
}
```

### 6. Check Job Profile Exists

**GET** `/job-profiles/{id}/exists`

Checks if a job profile exists without returning the full data.

#### Response

```json
{
  "success": true,
  "data": {
    "exists": true
  },
  "message": "Job profile exists"
}
```

## Error Responses

### Validation Error

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "Scoring weights must sum to 100%. Current total: 95%",
    "Required skills must be a non-empty array"
  ]
}
```

### Not Found Error

```json
{
  "success": false,
  "message": "Job profile not found"
}
```

### Database Error

```json
{
  "success": false,
  "message": "Duplicate value for field: title",
  "code": "DUPLICATE_KEY_ERROR"
}
```

### Internal Server Error

```json
{
  "success": false,
  "message": "Internal server error"
}
```

## Health Check

**GET** `/health`

Returns the API health status.

#### Response

```json
{
  "success": true,
  "message": "API is healthy",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **Requirement 1.1**: Job profile creation with all required fields
- **Requirement 1.2**: Scoring weights validation (must sum to 100%)
- **Requirement 1.3**: Job profile update functionality with history preservation
- **Requirement 1.4**: Job profile deletion with validation checks

## Key Features

1. **Dynamic Scoring Weights**: Each job profile can have custom weights for different analysis stages
2. **Comprehensive Validation**: All inputs are validated both at the API level and service level
3. **Error Handling**: Proper error responses with meaningful messages
4. **Filtering**: Support for filtering job profiles by various criteria
5. **RESTful Design**: Standard HTTP methods and status codes
6. **Type Safety**: Full TypeScript implementation with proper interfaces