import axios from 'axios';

const getBaseUrl = () => {
    const url = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api';
    return url.endsWith('/api') ? url : `${url}/api`;
};

const api = axios.create({
    baseURL: getBaseUrl(),
});

export { api }; // Export for direct use

// Add a request interceptor to attach the token
api.interceptors.request.use(
    (config) => {
        // Determine request type based on URL pattern
        const isDriverPortalRequest = config.url?.startsWith('/driver/') || config.url === '/driver';
        const isStudentPortalRequest = config.url?.startsWith('/student/') || config.url?.startsWith('/auth/student/');

        // Use appropriate token based on request type
        let token: string | null = null;
        if (isDriverPortalRequest) {
            token = localStorage.getItem('driver_token');
        } else if (isStudentPortalRequest) {
            token = localStorage.getItem('student_token');
        } else {
            token = localStorage.getItem('token');
        }

        // Use appropriate tenant ID
        const tenantId = localStorage.getItem('current_college_id');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        if (tenantId) {
            config.headers['x-tenant-id'] = tenantId;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

export const validateSlug = async (slug: string) => {
    const response = await api.get(`/auth/college/${slug}`);
    return response.data;
};

export const login = async (credentials: any) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
};

export const getBuses = async () => {
    const response = await api.get('/admin/buses');
    return response.data;
};

// Search Organizations
export const searchOrganizations = async (query: string) => {
    const response = await api.get('/auth/colleges/search', { params: { q: query } });
    return response.data;
};

// Driver Management
export const getDrivers = async () => {
    const response = await api.get('/admin/users/driver');
    return response.data;
};

export const createDriver = async (driverData: any) => {
    const response = await api.post('/admin/users', { ...driverData, role: 'DRIVER' });
    return response.data;
};

// Bulk Driver Creation
export const bulkCreateDrivers = async (drivers: any[]) => {
    const response = await api.post('/admin/users/bulk', { users: drivers, role: 'DRIVER' });
    return response.data;
};

export const updateDriver = async (userId: string, driverData: any) => {
    const response = await api.put(`/admin/users/${userId}`, driverData);
    return response.data;
};

export const deleteDriver = async (userId: string) => {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
};

// Driver Portal - Bus Operations
export const getDriverBuses = async () => {
    const response = await api.get('/driver/buses');
    return response.data;
};



export const searchDriverBuses = async (query: string) => {
    const response = await api.get('/driver/buses/search', { params: { q: query } });
    return response.data;
};

export const updateBusLocation = async (busId: string, locationData: any) => {
    console.log(`API CALL: POST /driver/tracking/${busId}`, locationData);
    const response = await api.post(`/driver/tracking/${busId}`, locationData);
    return response.data;
};

// Trip Management
export const startNewTrip = async (busId: string, tripId: string) => {
    console.log(`API CALL: POST /driver/trip/start/${busId}`, { tripId });
    const response = await api.post(`/driver/trip/start/${busId}`, { tripId });
    return response.data;
};

export const endCurrentTrip = async (busId: string, tripId: string) => {
    console.log(`API CALL: POST /driver/trip/end/${busId}`, { tripId });
    const response = await api.post(`/driver/trip/end/${busId}`, { tripId });
    return response.data;
};

export const saveTripHistory = async (busId: string, tripId: string, locationData: any) => {
    console.log(`API CALL: POST /driver/trip/history/${busId}`, { tripId, ...locationData });
    const response = await api.post(`/driver/trip/history/${busId}`, { tripId, ...locationData });
    return response.data;
};

// Driver Notifications
export const checkProximity = async (data: any) => {
    const response = await api.post('/driver/notifications/proximity', data);
    return response.data;
};

// Bus Management
export const createBus = async (busData: any) => {
    const response = await api.post('/admin/buses', busData);
    return response.data;
};

export const updateBus = async (busId: string, busData: any) => {
    const response = await api.put(`/admin/buses/${busId}`, busData);
    return response.data;
};

export const deleteBus = async (busId: string) => {
    const response = await api.delete(`/admin/buses/${busId}`);
    return response.data;
};

// Route Management
export const getRoutes = async () => {
    const response = await api.get('/admin/routes');
    return response.data;
};

export const createRoute = async (routeData: any) => {
    const response = await api.post('/admin/routes', routeData);
    return response.data;
};

export const updateRoute = async (routeId: string, routeData: any) => {
    const response = await api.put(`/admin/routes/${routeId}`, routeData);
    return response.data;
};

export const deleteRoute = async (routeId: string) => {
    const response = await api.delete(`/admin/routes/${routeId}`);
    return response.data;
};

// Trip History
export const getTripHistory = async () => {
    const response = await api.get('/admin/trips');
    return response.data;
};

export const updateTrip = async (tripId: string, data: any) => {
    const response = await api.put(`/admin/trips/${tripId}`, data);
    return response.data;
};

export const deleteTrip = async (tripId: string) => {
    const response = await api.delete(`/admin/trips/${tripId}`);
    return response.data;
};

export const adminEndTrip = async (tripId: string) => {
    const response = await api.post(`/admin/trips/${tripId}/end`);
    return response.data;
};

export const getTripPath = async (tripId: string) => {
    const response = await api.get(`/admin/trips/${tripId}/path`);
    return response.data;
};

export const uploadRoutesFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/admin/routes/bulk-upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

export const downloadRouteTemplate = async () => {
    const response = await api.get('/admin/routes/template', {
        responseType: 'blob'
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'routes_template.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
};

export const bulkCreateRoutes = async (routesData: any[]) => {
    const response = await api.post('/admin/routes/bulk-json', { routes: routesData });
    return response.data;
};

// Student Management
export const getStudents = async () => {
    const response = await api.get('/admin/students');
    return response.data;
};

export const createStudent = async (studentData: any) => {
    const response = await api.post('/admin/students', studentData);
    return response.data;
};

export const updateStudent = async (studentId: string, studentData: any) => {
    const response = await api.put(`/admin/students/${studentId}`, studentData);
    return response.data;
};

export const deleteStudent = async (studentId: string) => {
    const response = await api.delete(`/admin/students/${studentId}`);
    return response.data;
};

export const bulkCreateStudents = async (students: any[]) => {
    const response = await api.post('/admin/students/bulk-json', { students });
    return response.data;
};

// Student Auth
export const studentLogin = async (email: string, password: string, orgSlug: string) => {
    const response = await api.post('/auth/student/login', { email, password, orgSlug });
    return response.data;
};

export const studentSetPassword = async (newPassword: string) => {
    const response = await api.post('/auth/student/set-password', { newPassword });
    return response.data;
};


export const resetStudentPassword = async (studentId: string) => {
    const response = await api.put(`/admin/students/${studentId}/reset-password`);
    return response.data;
};

// Student Portal - Get buses for student's college
export const getStudentBuses = async () => {
    const response = await api.get('/student/buses');
    return response.data;
};

export const getStudentRoutes = async () => {
    const response = await api.get('/student/routes');
    return response.data;
};

export const getStudentTripHistory = async () => {
    const response = await api.get('/student/trips');
    return response.data;
};

// Admin Management (Super Admin / Owner only)
export const getCollegeAdmins = async () => {
    const response = await api.get('/admin/college-admins');
    return response.data;
};

export const createCollegeAdmin = async (adminData: any) => {
    const response = await api.post('/admin/college-admins', adminData);
    return response.data;
};

export const updateCollegeAdmin = async (userId: string, adminData: any) => {
    const response = await api.put(`/admin/college-admins/${userId}`, adminData);
    return response.data;
};

export const deleteCollegeAdmin = async (userId: string) => {
    const response = await api.delete(`/admin/college-admins/${userId}`);
    return response.data;
};

export default api;
