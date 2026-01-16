import axios from 'axios';

// Create an Axios instance with base URL pointing to the backend
const API_URL = import.meta.env.PROD
    ? 'https://oee-app.onrender.com'
    : 'http://localhost:8000';

const api = axios.create({
    baseURL: API_URL,
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
    getDashboardStats: async (reportId?: number) => {
        const url = reportId ? `/metrics/stats?report_id=${reportId}` : '/metrics/stats';
        const response = await api.get(url);
        return response.data;
    },
    getReports: async () => {
        const response = await api.get('/reports/');
        return response.data;
    },
    deleteReport: async (reportId: number) => {
        await api.delete(`/reports/${reportId}`);
    }
};

export default api;
