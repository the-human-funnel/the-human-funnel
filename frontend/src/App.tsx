import React, { useState } from 'react';
import JobProfileManager from './components/JobProfileManager';
import ResumeUploader from './components/ResumeUploader';
import CandidateDashboard from './components/CandidateDashboard';
import BatchProgress from './components/BatchProgress';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <div className="p-6">{children}</div>}
    </div>
  );
}

function App() {
  const [tabValue, setTabValue] = useState(0);

  const tabs = [
    { label: 'Job Profiles', component: <JobProfileManager /> },
    { label: 'Upload Resumes', component: <ResumeUploader /> },
    { label: 'Candidates', component: <CandidateDashboard /> },
    { label: 'Processing Status', component: <BatchProgress /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Job Candidate Filtering System
          </h1>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="px-6">
          <div className="flex space-x-8">
            {tabs.map((tab, index) => (
              <button
                key={index}
                onClick={() => setTabValue(index)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  tabValue === index
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto">
        {tabs.map((tab, index) => (
          <TabPanel key={index} value={tabValue} index={index}>
            {tab.component}
          </TabPanel>
        ))}
      </main>
    </div>
  );
}

export default App;