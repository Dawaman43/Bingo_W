import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true, // keep this if you plan to use cookies
});

export default API;
