import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: true, // only if you actually use cookies
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token"); // ✅ same as AuthProvider
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;
