import apiClient from "@/lib/apiClient";

export const getUsers = async () => {
  const { data } = await apiClient.get("/user");
  return data?.data;
};

export const deleteUser = async (id) => {
  const { data } = await apiClient.delete(`/user/${id}`);
  return data;
};


export const getUser = async (id) => {
  const { data } = await apiClient.get(`/user/${id}`);
  return data?.data;
};



