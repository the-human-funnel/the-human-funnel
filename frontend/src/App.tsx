import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Tabs,
  Tab,
} from '@mui/material';
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
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function App() {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <div>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Job Candidate Filtering System
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl">
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Job Profiles" />
            <Tab label="Upload Resumes" />
            <Tab label="Candidates" />
            <Tab label="Processing Status" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <JobProfileManager />
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <ResumeUploader />
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <CandidateDashboard />
        </TabPanel>
        <TabPanel value={tabValue} index={3}>
          <BatchProgress />
        </TabPanel>
      </Container>
    </div>
  );
}

export default App;