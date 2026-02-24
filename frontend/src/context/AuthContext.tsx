import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { authService } from '../services/api';
import { jwtDecode } from "jwt-decode";
import { message } from 'antd';

// Role types
export type UserRole = 'admin' | 'manager' | 'supervisor' | 'viewer';

interface DecodedToken {
    sub: string;        // email
    role: UserRole;
    shift_scope: string | null;
    is_pro: boolean;
    exp: number;
}

interface AuthUser {
    email: string;
    role: UserRole;
    shiftScope: string | null;
    isPro: boolean;
}

interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    isLoading: boolean;
    login: (token: string) => void;
    logout: () => void;
    impersonate: (token: string) => void;
    isAuthenticated: boolean;
    isAdmin: boolean;
    isManager: boolean;
    isSupervisor: boolean;
    isViewer: boolean;
    canEdit: boolean;           // admin | manager | supervisor (not viewer)
    canManage: boolean;         // admin | manager only
    canAccessPage: (page: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Pages that supervisors are DENIED access to
const SUPERVISOR_DENIED_PAGES = new Set([
    'upload', 'rates', 'settings', 'admin'
]);

// Pages that viewers can still see (read-only)
const VIEWER_ALLOWED_PAGES = new Set([
    'dashboard', 'production-board', 'analytics', 'operators',
    'leaderboard', 'reports', 'versions', 'upload', 'rates', 'settings'
]);

function decodeToken(token: string): AuthUser | null {
    try {
        const decoded = jwtDecode<DecodedToken>(token);
        // Check expiry
        if (decoded.exp * 1000 < Date.now()) {
            return null; // Expired
        }
        return {
            email: decoded.sub,
            role: decoded.role || 'viewer',
            shiftScope: decoded.shift_scope || null,
            isPro: decoded.is_pro || false,
        };
    } catch {
        return null;
    }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        if (token) {
            const decoded = decodeToken(token);
            if (decoded) {
                setUser(decoded);
            } else {
                // Token expired or invalid — clear it
                localStorage.removeItem('token');
                setToken(null);
                setUser(null);
            }
        } else {
            // No token: default to anonymous viewer (read-only)
            setUser({
                email: 'anonymous',
                role: 'viewer',
                shiftScope: null,
                isPro: false,
            });
        }
        setIsLoading(false);
    }, [token]);

    const login = useCallback((newToken: string) => {
        setToken(newToken);
        localStorage.setItem('token', newToken);
        const decoded = decodeToken(newToken);
        if (decoded) {
            setUser(decoded);
        }
    }, []);

    const logout = useCallback(() => {
        setToken(null);
        setUser({
            email: 'anonymous',
            role: 'viewer',
            shiftScope: null,
            isPro: false,
        });
        localStorage.removeItem('token');
    }, []);

    const impersonate = useCallback((newToken: string) => {
        login(newToken);
        message.success("Switched user successfully");
    }, [login]);

    const role = user?.role || 'viewer';

    const canAccessPage = useCallback((page: string): boolean => {
        if (role === 'admin' || role === 'manager') return true;
        if (role === 'supervisor') return !SUPERVISOR_DENIED_PAGES.has(page);
        // viewer
        return VIEWER_ALLOWED_PAGES.has(page);
    }, [role]);

    const value: AuthContextType = {
        user,
        token,
        isLoading,
        login,
        logout,
        impersonate,
        isAuthenticated: !!user && user.email !== 'anonymous',
        isAdmin: role === 'admin',
        isManager: role === 'admin' || role === 'manager',
        isSupervisor: role === 'supervisor',
        isViewer: role === 'viewer',
        canEdit: role !== 'viewer',
        canManage: role === 'admin' || role === 'manager',
        canAccessPage,
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
