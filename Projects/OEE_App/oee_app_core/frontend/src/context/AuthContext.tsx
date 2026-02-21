import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { api, authService, User } from '../services/api'; // user api default export for axios instance if needed, or just authService
import { jwtDecode } from "jwt-decode";
import { message } from 'antd';

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (token: string) => void;
    logout: () => void;
    impersonate: (token: string) => void;
    isAuthenticated: boolean;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        // Mock authentication for no-login mode
        setUser({
            email: 'admin@oee.local',
            role: 'admin',
            is_pro: true,
            id: 1,
            hashed_password: '',
            is_active: true
        });
        setIsLoading(false);
    }, []);

    const login = (newToken: string) => {
        setToken(newToken);
        localStorage.setItem('token', newToken);
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        // Optional: Redirect to login via router if needed, better handled by PrivateRoute
    };

    const impersonate = (newToken: string) => {
        login(newToken);
        message.success("Switched user successfully");
    };

    const value = {
        user,
        token,
        isLoading,
        login,
        logout,
        impersonate,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin'
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
