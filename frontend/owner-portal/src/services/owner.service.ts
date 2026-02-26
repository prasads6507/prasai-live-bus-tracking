import api from './api';

export interface College {
    _id: string;
    collegeId: string;
    collegeName: string;
    status: 'ACTIVE' | 'SUSPENDED';
    plan: string;
    address?: string;
    contactEmail?: string;
    contactPhone?: string;
    createdAt: string;
}

export interface CollegeAdmin {
    userId: string;
    name: string;
    email: string;
    phone: string;
    collegeId: string;
    collegeName?: string; // Enriched field
    collegeStatus?: 'ACTIVE' | 'SUSPENDED'; // Enriched field
    role?: 'COLLEGE_ADMIN' | 'SUPER_ADMIN'; // Enriched field
}

export const getCollegeAdmins = async (): Promise<CollegeAdmin[]> => {
    const response = await api.get('/owner/college-admins');
    return response.data;
};

export const getColleges = async (): Promise<College[]> => {
    const response = await api.get('/owner/colleges');
    return response.data;
};

export const createCollege = async (data: any): Promise<any> => {
    const response = await api.post('/owner/colleges', data);
    return response.data;
};

export const deleteCollege = async (collegeId: string): Promise<void> => {
    await api.delete(`/owner/colleges/${collegeId}`);
};

export const updateCollegeStatus = async (collegeId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<College> => {
    const response = await api.put(`/owner/colleges/${collegeId}/status`, { status });
    return response.data;
};

export const createCollegeAdmin = async (data: any): Promise<any> => {
    const response = await api.post('/owner/college-admins', data);
    return response.data;
};

export const updateCollegeAdmin = async (userId: string, data: Partial<CollegeAdmin> & { password?: string; role?: string }): Promise<CollegeAdmin> => {
    const response = await api.put(`/owner/college-admins/${userId}`, data);
    return response.data;
};

export const deleteCollegeAdmin = async (adminId: string): Promise<void> => {
    await api.delete(`/owner/college-admins/${adminId}`);
};

export const getAnalytics = async (collegeId?: string): Promise<any> => {
    const response = await api.get('/owner/analytics', { params: { collegeId } });
    return response.data;
};

export const getDashboardStats = async (): Promise<any> => {
    const response = await api.get('/owner/dashboard-stats');
    return response.data;
};

export const getFirebaseUsageOverview = async (month: string): Promise<any> => {
    const response = await api.get('/owner/firebase-usage/overview', { params: { month } });
    return response.data;
};

export const getFirebaseUsageCost = async (month: string): Promise<any> => {
    const response = await api.get('/owner/firebase-usage/cost', { params: { month } });
    return response.data;
};
