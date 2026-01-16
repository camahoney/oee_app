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
    async getDashboardStats(reportId?: number) {
        const url = reportId ? `/reports/${reportId}/metrics` : '/dashboard/stats';
        const response = await api.get(url);
        return response.data;
    },

    async exportReport(reportId: number, format: 'csv' | 'xlsx') {
        const response = await api.get(`/reports/${reportId}/export`, {
            params: { format },
            responseType: 'blob'
        });
        return response.data;
    },
    getReports: async () => {
        const response = await api.get('/reports/');
        return response.data;
    },
    deleteReport: async (reportId: number) => {
        await axios.delete(`${API_URL}/reports/${reportId}`);
    },
    getReportEntries: async (reportId: number) => {
        const response = await api.get(`/reports/${reportId}/entries`);
        return response.data;
    },
    updateReportEntry: async (entryId: number, data: any) => {
        const response = await api.put(`/reports/entries/${entryId}`, data);
        return response.data;
    }
};

export const analyticsService = {
    getComparison: async (groupBy: string = 'shift') => {
        const response = await axios.get(`${API_URL}/analytics/compare`, {
            params: { group_by: groupBy }
        });
        return response.data;
    },
    getQualityAnalysis: async (limit: number = 10) => {
        const response = await axios.get(`${API_URL}/analytics/quality`, {
            params: { limit }
        });
        return response.data;
    }
};

export default api;
