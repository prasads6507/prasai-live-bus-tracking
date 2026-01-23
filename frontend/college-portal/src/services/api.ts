import axios from 'axios';

const getBaseUrl = () => {
    const url = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api';
    return url.endsWith('/api') ? url : `${url}/api`;
};

const api = axios.create({
    baseURL: getBaseUrl(),
});

// Add a request interceptor to attach the token
api.interceptors.request.use(
    (config) => {
        // Determine if this is a driver portal request (starts with /driver/)
        // Admin requests like /api/admin/users/driver should NOT match this
        const isDriverPortalRequest = config.url?.startsWith('/driver/') || config.url === '/driver';

        console.log(`INTERCEPTOR: ${config.method?.toUpperCase()} ${config.url} | isDriver: ${isDriverPortalRequest}`);

        // Use appropriate token based on request type
        const token = isDriverPortalRequest
            ? localStorage.getItem('driver_token')
            : localStorage.getItem('token');

        console.log(`Using token: ${token ? 'PRESENT' : 'MISSING'} (${isDriverPortalRequest ? 'driver_token' : 'token'})`);

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

export default api;
