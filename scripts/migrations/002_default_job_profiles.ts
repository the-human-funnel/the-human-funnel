import { Db } from 'mongodb';

export default {
  version: '002',
  description: 'Create default job profiles for common roles',
  
  async up(db: Db): Promise<void> {
    const defaultJobProfiles = [
      {
        _id: 'default-software-engineer',
        title: 'Software Engineer',
        description: 'Full-stack software engineer with experience in modern web technologies',
        requiredSkills: [
          'JavaScript', 'TypeScript', 'React', 'Node.js', 'MongoDB', 'Git',
          'REST APIs', 'HTML/CSS', 'Problem Solving', 'Debugging'
        ],
        experienceLevel: 'Mid-level (2-5 years)',
        scoringWeights: {
          resumeAnalysis: 25,
          linkedInAnalysis: 20,
          githubAnalysis: 30,
          interviewPerformance: 25
        },
        interviewQuestions: [
          'Can you explain the difference between let, const, and var in JavaScript?',
          'How do you handle asynchronous operations in JavaScript?',
          'What is your experience with React hooks?',
          'How do you approach debugging a complex issue?',
          'Describe your experience with version control and Git workflows.',
          'What testing frameworks have you used?'
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: 'default-frontend-developer',
        title: 'Frontend Developer',
        description: 'Frontend developer specializing in user interface development',
        requiredSkills: [
          'JavaScript', 'React', 'Vue.js', 'HTML5', 'CSS3', 'SASS/SCSS',
          'Responsive Design', 'UI/UX', 'Webpack', 'TypeScript'
        ],
        experienceLevel: 'Mid-level (2-5 years)',
        scoringWeights: {
          resumeAnalysis: 30,
          linkedInAnalysis: 25,
          githubAnalysis: 25,
          interviewPerformance: 20
        },
        interviewQuestions: [
          'How do you ensure cross-browser compatibility?',
          'What is your approach to responsive web design?',
          'Can you explain the CSS box model?',
          'How do you optimize frontend performance?',
          'What is your experience with modern JavaScript frameworks?',
          'How do you handle state management in React applications?'
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: 'default-backend-developer',
        title: 'Backend Developer',
        description: 'Backend developer with expertise in server-side technologies and databases',
        requiredSkills: [
          'Node.js', 'Python', 'Java', 'MongoDB', 'PostgreSQL', 'REST APIs',
          'GraphQL', 'Docker', 'AWS', 'Microservices', 'Database Design'
        ],
        experienceLevel: 'Mid-level (2-5 years)',
        scoringWeights: {
          resumeAnalysis: 25,
          linkedInAnalysis: 15,
          githubAnalysis: 35,
          interviewPerformance: 25
        },
        interviewQuestions: [
          'How do you design RESTful APIs?',
          'What is your experience with database optimization?',
          'How do you handle authentication and authorization?',
          'Can you explain microservices architecture?',
          'What is your approach to error handling in backend services?',
          'How do you ensure API security?'
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: 'default-data-scientist',
        title: 'Data Scientist',
        description: 'Data scientist with machine learning and analytics expertise',
        requiredSkills: [
          'Python', 'R', 'Machine Learning', 'Statistics', 'Pandas', 'NumPy',
          'Scikit-learn', 'TensorFlow', 'SQL', 'Data Visualization', 'Jupyter'
        ],
        experienceLevel: 'Mid-level (2-5 years)',
        scoringWeights: {
          resumeAnalysis: 30,
          linkedInAnalysis: 20,
          githubAnalysis: 30,
          interviewPerformance: 20
        },
        interviewQuestions: [
          'How do you approach a new machine learning problem?',
          'Can you explain the bias-variance tradeoff?',
          'What is your experience with feature engineering?',
          'How do you validate machine learning models?',
          'What statistical methods do you commonly use?',
          'How do you handle missing data in datasets?'
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await db.collection('jobProfiles').insertMany(defaultJobProfiles);
    console.log(`✓ Inserted ${defaultJobProfiles.length} default job profiles`);
  },

  async down(db: Db): Promise<void> {
    const defaultIds = [
      'default-software-engineer',
      'default-frontend-developer', 
      'default-backend-developer',
      'default-data-scientist'
    ];

    const result = await db.collection('jobProfiles').deleteMany({
      _id: { $in: defaultIds }
    });

    console.log(`✓ Removed ${result.deletedCount} default job profiles`);
  }
};