import api from '../api/axios';

export const courseAdminService = {
    list: async () => {
        const { data } = await api.get('/courses');
        return data;
    },
    create: async (payload) => {
        const { data } = await api.post('/courses', payload);
        return data;
    },
    update: async (id, payload) => {
        const { data } = await api.put(`/courses/${id}`, payload);
        return data;
    },
    previewPromotion: async (sourceCourseId,targetCourseId) => {
        const {data}=await api.get('/courses/promotion/preview',{params:{sourceCourseId,targetCourseId}});
        return data;
    },
    promote: async (payload) => {
        const {data}=await api.post('/courses/promotion/execute',payload);
        return data;
    },
    setActive: async ({id,isActive}) => {
        const { data } = await api.patch(`/courses/${id}/status`, {isActive});
        return data;
    },
    deletionPreview: async (id) => {
        const { data } = await api.get(`/courses/${id}/deletion-preview`);
        return data;
    },
    remove: async ({id,deleteStudentAccounts,confirmation,studentConfirmation}) => {
        const { data } = await api.delete(`/courses/${id}`, { data: { deleteStudentAccounts, confirmation, studentConfirmation } });
        return data;
    },
};