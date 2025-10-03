import apiClient from "@/lib/apiClient";



export const uploadAdminQuestion = async (brandInfoData) => {
    const { data } = await apiClient.post("/question-admin", brandInfoData);
    return data;
};

export const getAdminQuestion = async (type) => {
    const { data } = await apiClient.get(`/question-admin/type/${type}`);
    console.log(data);
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


export const addWord = async (wordData) => {
    const { data } = await apiClient.post("/prohibited-word", wordData);
    return data;    
}

export const updateWord = async (id) => {
    const { data } = await apiClient.patch(`/prohibited-word/${id.id}`, id.wordData);
    return data
}

export const fetchWord = async () => {
    const { data } = await apiClient.get("/prohibited-word");
    console.log(data);
    return data?.data
}

export const deleteWord = async (id) => {
    const { data } = await apiClient.delete(`/prohibited-word/${id}`);
    return data
}