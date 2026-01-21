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
    createRate: async (data: any) => {
        const response = await api.post('/rates/', data);
        return response.data;
    },
    updateRate: async (id: number, data: any) => {
        const response = await api.put(`/rates/${id}`, data);
        return response.data;
    },
    deleteRate: async (id: number) => {
        const response = await api.delete(`/rates/${id}`);
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
        const url = reportId ? `/metrics/stats?report_id=${reportId}` : '/metrics/stats';
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
    updateReport: async (id: number, filename: string) => {
        const response = await api.put(`/reports/${id}`, { filename });
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
    },
    createReportEntry: async (reportId: number, data: any) => {
        const response = await api.post(`/reports/${reportId}/entries`, data);
        return response.data;
    },
    deleteReportEntry: async (entryId: number) => {
        await api.delete(`/reports/entries/${entryId}`);
    }
};

export interface Setting {
    key: string;
    value: string;
    description?: string;
}

export const settingsService = {
    getAll: async () => {
        const response = await api.get<Setting[]>('/settings/');
        return response.data;
    },
    get: async (key: string) => {
        const response = await api.get<Setting>(`/settings/${key}`);
        return response.data;
    },
    update: async (key: string, value: string, description?: string) => {
        const response = await api.put(`/settings/${key}`, null, {
            params: { value, description }
        });
        return response.data;
    }
};

export const analyticsService = {
    getComparison: async (groupBy: string = 'shift', startDate?: string, endDate?: string) => {
        const response = await axios.get(`${API_URL}/analytics/compare`, {
            params: {
                group_by: groupBy,
                start_date: startDate,
                end_date: endDate
            }
        });
        return response.data;
    },
    getQualityAnalysis: async (limit: number = 10, startDate?: string, endDate?: string) => {
        const response = await axios.get(`${API_URL}/analytics/quality`, {
            params: {
                limit,
                start_date: startDate,
                end_date: endDate
            }
        });
        return response.data;
    },
    getDowntimeAnalysis: async (limit: number = 10, startDate?: string, endDate?: string) => {
        const response = await axios.get(`${API_URL}/analytics/downtime`, {
            params: {
                limit,
                start_date: startDate,
                end_date: endDate
            }
        });
        return response.data;
    },
    getHistory: async (params: { operator?: string, part_number?: string, start_date?: string, end_date?: string, limit?: number }) => {
        const response = await axios.get(`${API_URL}/analytics/history`, { params });
        return response.data;
    },
    getPartPerformance: async (partNumber: string, startDate?: string, endDate?: string) => {
        const response = await axios.get(`${API_URL}/analytics/part-performance`, {
            params: {
                part_number: partNumber,
                start_date: startDate,
                end_date: endDate
            }
        });
        return response.data;
    },
    getOperatorBreakdown: async (operator: string, startDate?: string, endDate?: string) => {
        const response = await axios.get(`${API_URL}/analytics/operator-breakdown`, {
            params: {
                operator,
                start_date: startDate,
                end_date: endDate
            }
        });
        return response.data;
    }

};

export default api;
