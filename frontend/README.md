# Job Candidate Filtering System - Frontend

This is the React.js frontend interface for the Job Candidate Filtering Funnel System.

## Features

### 1. Job Profile Management
- Create and edit job profiles with dynamic scoring weights
- Manage required skills and interview questions
- Configure scoring weights for different analysis stages
- View and delete existing job profiles

### 2. Resume Upload Interface
- Drag-and-drop file upload for PDF resumes
- Bulk upload support (up to 10,000 files)
- File validation and progress tracking
- Integration with job profile selection

### 3. Candidate Dashboard
- View all processed candidates with filtering and sorting
- Filter by job profile, processing stage, and minimum score
- Detailed candidate information with contact details
- Score breakdown and recommendation display
- Export individual candidate reports (PDF/CSV)

### 4. Real-time Progress Tracking
- Monitor batch processing status in real-time
- View processing statistics and estimated completion times
- Auto-refresh functionality for live updates
- Export batch reports when processing is complete

## Technology Stack

- **React 18** with TypeScript
- **Tailwind CSS** for styling and component library
- **Lucide React** for icons
- **React Dropzone** for file upload
- **Axios** for API communication

### Recent Migration

The frontend has been migrated from Material-UI to Tailwind CSS for better performance, smaller bundle size, and greater design flexibility. See [MIGRATION.md](./MIGRATION.md) for detailed information about the changes.

## Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Start the development server:
```bash
npm start
```

The application will open at `http://localhost:3001` and proxy API requests to `http://localhost:3000`.

### Building for Production

```bash
npm run build
```

This creates a `build` folder with optimized production files that can be served by the backend.

## API Integration

The frontend communicates with the backend API through the following endpoints:

- **Job Profiles**: `/api/job-profiles`
- **Resume Upload**: `/api/resumes/upload-batch`
- **Candidates**: `/api/candidates`
- **Batch Processing**: `/api/batches`
- **Reports**: `/api/candidates/{id}/report`

## Component Structure

```
src/
├── components/
│   ├── ui/                      # Reusable UI components (Tailwind-based)
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Modal.tsx
│   │   ├── Badge.tsx
│   │   ├── Alert.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── DataTable.tsx
│   │   └── Slider.tsx
│   ├── JobProfileManager.tsx    # Job profile CRUD operations
│   ├── ResumeUploader.tsx       # File upload with drag-and-drop
│   ├── CandidateDashboard.tsx   # Candidate listing and filtering
│   └── BatchProgress.tsx        # Real-time processing status
├── services/
│   └── api.ts                   # API service layer
├── App.tsx                      # Main application component
├── index.tsx                    # Application entry point
└── index.css                    # Tailwind CSS imports
```

## Features Implementation

### Job Profile Management
- Dynamic form validation for scoring weights (must sum to 100%)
- Skill and question management with add/remove functionality
- Real-time weight adjustment with sliders
- Profile history preservation for audit purposes

### Resume Upload
- File type validation (PDF only)
- Size limit enforcement (10MB per file)
- Batch upload progress tracking
- Error handling for failed uploads

### Candidate Dashboard
- Advanced filtering by multiple criteria
- Sortable data grid with pagination
- Detailed candidate view with all analysis results
- Export functionality for reports

### Progress Tracking
- Real-time batch status updates
- Processing rate calculations
- Estimated completion time
- Auto-refresh with toggle option

## Environment Variables

- `REACT_APP_API_URL`: Backend API base URL (default: http://localhost:3000/api)
- `GENERATE_SOURCEMAP`: Whether to generate source maps (default: false)

## Development Notes

- The frontend uses a proxy configuration to route API calls to the backend during development
- Tailwind CSS configuration can be customized in `tailwind.config.js`
- Custom UI components are built with Tailwind utilities for consistency
- All API calls include automatic authentication token handling
- Error handling is implemented at the component level with user-friendly messages
- The design system uses a consistent color palette and spacing scale