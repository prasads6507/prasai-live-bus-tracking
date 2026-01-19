import axios from 'axios';

const api = axios.create({
    baseURL: '/api', // Relative path for self-contained deployment
});

// Add a request interceptor to attach the token
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

export default api;
