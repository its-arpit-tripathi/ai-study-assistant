import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, 
});

// Request interceptor to add the auth token header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('study_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const summarizeNotes = async (text) => {
  const response = await api.post('/summarize', { text });
  return response.data.summary;
};

export const generateQuiz = async (text, subject, questionCount = 5) => {
  const response = await api.post('/quiz', { text, subject, questionCount });
  return response.data.quiz;
};

export const askQuestion = async (question, context) => {
  const response = await api.post('/ask', { question, context });
  return response.data.answer;
};

export default api;
