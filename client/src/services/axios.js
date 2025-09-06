import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true, // keep this if you plan to use cookies
});

// Add token automatically
API.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token"); //  where you stored it in login
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;
