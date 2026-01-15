import axios from 'axios';

// Create an Axios instance with base URL pointing to the backend
const api = axios.create({
    baseURL: 'http://localhost:8000', // Update this if backend runs elsewhere
    headers: {
        'Content-Type': 'application/json',
    },
});

export const rateService = {
    getRates: async () => {
        const response = await api.get('/rates');
        return response.data;
    },
    uploadRates: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post('/rates/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },
};

export const reportService = {
    uploadReport: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post('/reports/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },
    calculateMetrics: async (reportId: number) => {
        const response = await api.post(`/metrics/${reportId}/calculate`);
        return response.data;
    },
    getMetrics: async (reportId: number) => {
        const response = await api.get(`/metrics/report/${reportId}`);
        return response.data;
    },
    getDashboardStats: async () => {
        const response = await api.get('/metrics/stats');
        return response.data;
    }
};

export default api;
