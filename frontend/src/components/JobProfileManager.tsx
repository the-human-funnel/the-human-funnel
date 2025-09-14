import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';
import Modal from './ui/Modal';
import Badge from './ui/Badge';
import Alert from './ui/Alert';
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Job Profiles</h1>
        <Button onClick={() => handleOpen()}>
          <Plus className="w-4 h-4 mr-2" />
          Create Profile
        </Button>
      </div>

      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profiles.map((profile) => (
          <Card key={profile.id}>
            <CardContent>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {profile.title}
                </h3>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleOpen(profile)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(profile.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <p className="text-gray-600 text-sm mb-3">
                {profile.description}
              </p>
              
              <p className="text-sm font-medium text-gray-700 mb-3">
                Experience: {profile.experienceLevel}
              </p>
              
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Required Skills:
                </p>
                <div className="flex flex-wrap gap-1">
                  {profile.requiredSkills.slice(0, 3).map((skill) => (
                    <Badge key={skill} variant="primary" size="sm">
                      {skill}
                    </Badge>
                  ))}
                  {profile.requiredSkills.length > 3 && (
                    <Badge variant="default" size="sm">
                      +{profile.requiredSkills.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal
        isOpen={open}
        onClose={handleClose}
        title={editingProfile ? 'Edit Job Profile' : 'Create Job Profile'}
        size="lg"
      >
        <div className="space-y-6">
          <Input
            label="Job Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          
          <Select
            label="Experience Level"
            value={formData.experienceLevel}
            onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value })}
          >
            <option value="">Select Experience Level</option>
            <option value="Entry">Entry Level</option>
            <option value="Mid">Mid Level</option>
            <option value="Senior">Senior Level</option>
            <option value="Lead">Lead/Principal</option>
          </Select>

          {/* Skills Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Required Skills</h3>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Add Skill"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSkill()}
              />
              <Button onClick={addSkill} variant="outline">Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.requiredSkills.map((skill) => (
                <Badge
                  key={skill}
                  variant="primary"
                  onRemove={() => removeSkill(skill)}
                >
                  {skill}
                </Badge>
              ))}
            </div>
          </div>

          {/* Scoring Weights */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Scoring Weights (%)</h3>
            {Object.entries(formData.scoringWeights).map(([key, value]) => (
              <div key={key} className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </label>
                  <span className="text-sm text-gray-500">{value}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={value}
                  onChange={(e) => handleWeightChange(key as keyof typeof formData.scoringWeights, parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            ))}
            <p className="text-sm text-gray-500">
              Total: {Object.values(formData.scoringWeights).reduce((sum, weight) => sum + weight, 0)}%
            </p>
          </div>

          {/* Interview Questions */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Interview Questions</h3>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Add Question"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addQuestion()}
              />
              <Button onClick={addQuestion} variant="outline">Add</Button>
            </div>
            <div className="space-y-2">
              {formData.interviewQuestions.map((question, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <span className="flex-1 text-sm">
                    {index + 1}. {question}
                  </span>
                  <button
                    onClick={() => removeQuestion(index)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default JobProfileManager;
