import api from './api';

export interface LoginCredentials {
    email: string;
    passwordHash: string; // Internal naming, backend expects 'password'
}

export interface RegisterCredentials {
    name: string;
    email: string;
    passwordHash: string;
}

export interface User {
    _id: string;
    name: string;
    email: string;
    role: string;
    collegeId: string;
    token: string;
}

export const login = async (credentials: LoginCredentials): Promise<User> => {
    const response = await api.post('/auth/login', {
        email: credentials.email,
        password: credentials.passwordHash,
    });
    return response.data;
};

export const register = async (credentials: RegisterCredentials): Promise<User> => {
    const response = await api.post('/auth/register-owner', {
        name: credentials.name,
        email: credentials.email,
        password: credentials.passwordHash,
    });
    return response.data;
};

export const loginWithGoogle = async (token: string): Promise<User> => {
    const response = await api.post('/auth/google-login', { token });
    return response.data;
};

export const getMe = async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
};
