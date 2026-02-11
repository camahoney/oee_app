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

// Request interceptor to add the auth token header to every request
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export interface User {
    id?: number;
    email: string;
    role: string;
    is_active?: boolean;
}

export const authService = {
    login: async (email: string, password: string) => {
        const formData = new FormData();
        formData.append('username', email);
        formData.append('password', password);

        const response = await api.post('/auth/login', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },
    register: async (email: string, password: string, role: string = 'analyst') => {
        const response = await api.post(`/auth/register?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&role=${encodeURIComponent(role)}`);
        return response.data;
    },
    getUsers: async () => {
        const response = await api.get<User[]>('/auth/users');
        return response.data;
    },
    createUser: async (user: User & { password: string }) => {
        const response = await api.post<User>('/auth/users', user);
        return response.data;
    },
    impersonate: async (email: string) => {
        const response = await api.post<{ access_token: string }>('/auth/impersonate', null, {
            params: { email }
        });
        return response.data;
    },
    updateUser: async (userId: number, data: Partial<User> & { password?: string }) => {
        const response = await api.put<User>(`/auth/users/${userId}`, data);
        return response.data;
    }
};

export const rateService = {
    getRates: async (limit: number = 5000) => {
        const response = await api.get('/rates', { params: { limit } });
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
    },
    getWeeklySummary: async (startDate: string, endDate: string, shift: string = 'All') => {
        const response = await axios.get(`${API_URL}/weekly/summary`, {
            params: {
                start_date: startDate,
                end_date: endDate,
                shift
            }
        });
        return response.data;
    }

};

export default api;
