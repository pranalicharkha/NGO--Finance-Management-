// API Configuration for different environments
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://nidigo-backend.onrender.com';

console.log('API Base URL:', API_BASE_URL);
