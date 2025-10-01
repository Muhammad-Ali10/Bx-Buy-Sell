import apiClient from "@/lib/apiClient";



export const uploadAdminQuestion = async (brandInfoData) => {
    const { data } = await apiClient.post("/question-admin", brandInfoData);
    return data;
};

export const getAdminQuestion = async (type) => {
    const { data } = await apiClient.get(`/question-admin/type/${type}`);
    return data?.data
};

export const deleteAdminQuestion = async (id) => {
    const { data } = await apiClient.delete(`/question-admin/${id}`);
    return data;
};

export const updateAdminQuestion = async (id) => {

    const { data } = await apiClient.patch(`/question-admin/${id.id}`, id.brandData);
    return data;
};

export const uploadTools = async (toolsData) => {

    const { data } = await apiClient.post("/service-tool", toolsData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
};


export const fetchTools = async () => {
    const { data } = await apiClient.get("/service-tool");
    return data?.data;
};
