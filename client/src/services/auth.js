import API from './axios';

// Login
export const login = async (data) => {
  const res = await API.post('/auth/login', data);
  if(res.data.token){
    sessionStorage.setItem('token', res.data.token);
  }
  return res.data; // <-- The key change: const res = just the data
};

