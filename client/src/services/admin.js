import API from "./axios";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

//admin can Get all users
export const getUsers = async () => {
  const res = await API.get("/admin/users", getAuthHeader());
  return res.data;
};

// admin can Delete user by ID
export const deleteUser = async (id) => {
  const res = await API.delete(`/admin/users/${id}`, getAuthHeader());
  return res.data;
};

//admin can Add new user
export const addUser = async (data) => {
  const res = await API.post("/admin/add-user", data, getAuthHeader());
  return res.data;
};
