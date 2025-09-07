import API from './axios';

// Add User
export const addUser = async (data) => {
  const res = await API.post('/admin/add-user', data);
  return res.data; // return only the data
};

// Get all users (cashier + moderator)
export const getUsers = async () => {
  const res = await API.get('/admin/users');
  return res.data;
};

//  Delete user by ID
export const deleteUser = async (id) => {
  const res = await API.delete(`/admin/users/${id}`);
  return res.data;
};