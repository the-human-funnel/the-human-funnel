import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,

  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Alert,
  Grid,
  IconButton
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { jobProfileApi, JobProfile } from '../services/api';

const JobProfileManager: React.FC = () => {
  const [profiles, setProfiles] = useState<JobProfile[]>([]);
  const [open, setOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<JobProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requiredSkills: [] as string[],
    experienceLevel: '',
    scoringWeights: {
      resumeAnalysis: 25,
      linkedInAnalysis: 20,
      githubAnalysis: 25,
      interviewPerformance: 30,
    },
    interviewQuestions: [] as string[],
  });

  const [newSkill, setNewSkill] = useState('');
  const [newQuestion, setNewQuestion] = useState('');

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const response = await jobProfileApi.getAll();
      setProfiles(response.data);
    } catch (err) {
      setError('Failed to load job profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (profile?: JobProfile) => {
    if (profile) {
      setEditingProfile(profile);
      setFormData({
        title: profile.title,
        description: profile.description,
        requiredSkills: profile.requiredSkills,
        experienceLevel: profile.experienceLevel,
        scoringWeights: profile.scoringWeights,
        interviewQuestions: profile.interviewQuestions,
      });
    } else {
      setEditingProfile(null);
      setFormData({
        title: '',
        description: '',
        requiredSkills: [],
        experienceLevel: '',
        scoringWeights: {
          resumeAnalysis: 25,
          linkedInAnalysis: 20,
          githubAnalysis: 25,
          interviewPerformance: 30,
        },
        interviewQuestions: [],
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingProfile(null);
    setError(null);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // Validate weights sum to 100
      const totalWeight = Object.values(formData.scoringWeights).reduce((sum, weight) => sum + weight, 0);
      if (totalWeight !== 100) {
        setError('Scoring weights must sum to 100%');
        return;
      }

      if (editingProfile) {
        await jobProfileApi.update(editingProfile.id, formData);
      } else {
        await jobProfileApi.create(formData);
      }
      
      await loadProfiles();
      handleClose();
    } catch (err) {
      setError('Failed to save job profile');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this job profile?')) {
      try {
        await jobProfileApi.delete(id);
        await loadProfiles();
      } catch (err) {
        setError('Failed to delete job profile');
      }
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !formData.requiredSkills.includes(newSkill.trim())) {
      setFormData({
        ...formData,
        requiredSkills: [...formData.requiredSkills, newSkill.trim()],
      });
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    setFormData({
      ...formData,
      requiredSkills: formData.requiredSkills.filter(s => s !== skill),
    });
  };

  const addQuestion = () => {
    if (newQuestion.trim()) {
      setFormData({
        ...formData,
        interviewQuestions: [...formData.interviewQuestions, newQuestion.trim()],
      });
      setNewQuestion('');
    }
  };

  const removeQuestion = (index: number) => {
    setFormData({
      ...formData,
      interviewQuestions: formData.interviewQuestions.filter((_, i) => i !== index),
    });
  };

  const handleWeightChange = (field: keyof typeof formData.scoringWeights, value: number) => {
    setFormData({
      ...formData,
      scoringWeights: {
        ...formData.scoringWeights,
        [field]: value,
      },
    });
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Job Profiles</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpen()}
        >
          Create Profile
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {profiles.map((profile) => (
          <Grid item xs={12} md={6} lg={4} key={profile.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Typography variant="h6" gutterBottom>
                    {profile.title}
                  </Typography>
                  <Box>
                    <IconButton onClick={() => handleOpen(profile)}>
                      <Edit />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(profile.id)}>
                      <Delete />
                    </IconButton>
                  </Box>
                </Box>
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {profile.description}
                </Typography>
                
                <Typography variant="subtitle2" gutterBottom>
                  Experience: {profile.experienceLevel}
                </Typography>
                
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Required Skills:
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {profile.requiredSkills.slice(0, 3).map((skill) => (
                      <Chip key={skill} label={skill} size="small" />
                    ))}
                    {profile.requiredSkills.length > 3 && (
                      <Chip label={`+${profile.requiredSkills.length - 3} more`} size="small" />
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingProfile ? 'Edit Job Profile' : 'Create Job Profile'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Job Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              margin="normal"
            />
            
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              margin="normal"
            />
            
            <FormControl fullWidth margin="normal">
              <InputLabel>Experience Level</InputLabel>
              <Select
                value={formData.experienceLevel}
                onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value })}
              >
                <MenuItem value="Entry">Entry Level</MenuItem>
                <MenuItem value="Mid">Mid Level</MenuItem>
                <MenuItem value="Senior">Senior Level</MenuItem>
                <MenuItem value="Lead">Lead/Principal</MenuItem>
              </Select>
            </FormControl>

            {/* Skills Section */}
            <Box mt={3}>
              <Typography variant="h6" gutterBottom>Required Skills</Typography>
              <Box display="flex" gap={1} mb={2}>
                <TextField
                  label="Add Skill"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                />
                <Button onClick={addSkill}>Add</Button>
              </Box>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {formData.requiredSkills.map((skill) => (
                  <Chip
                    key={skill}
                    label={skill}
                    onDelete={() => removeSkill(skill)}
                  />
                ))}
              </Box>
            </Box>

            {/* Scoring Weights */}
            <Box mt={3}>
              <Typography variant="h6" gutterBottom>Scoring Weights (%)</Typography>
              {Object.entries(formData.scoringWeights).map(([key, value]) => (
                <Box key={key} mb={2}>
                  <Typography gutterBottom>
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: {value}%
                  </Typography>
                  <Slider
                    value={value}
                    onChange={(_, newValue) => handleWeightChange(key as keyof typeof formData.scoringWeights, newValue as number)}
                    min={0}
                    max={100}
                    step={5}
                  />
                </Box>
              ))}
              <Typography variant="caption" color="text.secondary">
                Total: {Object.values(formData.scoringWeights).reduce((sum, weight) => sum + weight, 0)}%
              </Typography>
            </Box>

            {/* Interview Questions */}
            <Box mt={3}>
              <Typography variant="h6" gutterBottom>Interview Questions</Typography>
              <Box display="flex" gap={1} mb={2}>
                <TextField
                  fullWidth
                  label="Add Question"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addQuestion()}
                />
                <Button onClick={addQuestion}>Add</Button>
              </Box>
              {formData.interviewQuestions.map((question, index) => (
                <Box key={index} display="flex" alignItems="center" gap={1} mb={1}>
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    {index + 1}. {question}
                  </Typography>
                  <IconButton size="small" onClick={() => removeQuestion(index)}>
                    <Delete />
                  </IconButton>
                </Box>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default JobProfileManager;
