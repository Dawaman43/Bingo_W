import API from './axios';

// Add User
export const addUser = async (data) => {
  const res = await API.post('/admin/add-user', data);
  return res.data; // return only the data
};
