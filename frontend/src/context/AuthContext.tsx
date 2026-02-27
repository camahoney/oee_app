import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { authService } from '../services/api';

interface AuthContextType {
    token: string | null;
    role: string | null;         // admin, manager, supervisor, viewer
    shiftScope: string | null;   // "1st Shift", etc.
    isPro: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    // Helper access getters
    canEdit: boolean;   // admin, manager
    canManage: boolean; // admin
    isSupervisor: boolean;
    isViewer: boolean;  // anonymous or viewer role
    canAccessPage: (path: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getInitialState = () => {
    const initialToken = localStorage.getItem('token');
    let initialRole = 'viewer';
    let initialShiftScope = null;
    let initialIsPro = false;

    if (initialToken) {
        try {
            const decoded: any = jwtDecode(initialToken);
            if (decoded.exp * 1000 >= Date.now()) {
                initialRole = decoded.role || 'viewer';
                initialShiftScope = decoded.shift_scope || null;
                initialIsPro = !!decoded.is_pro;
            }
        } catch {
            // fallback to defaults
        }
    }
    return { initialToken, initialRole, initialShiftScope, initialIsPro };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { initialToken, initialRole, initialShiftScope, initialIsPro } = getInitialState();

    const [token, setToken] = useState<string | null>(initialToken);
    const [role, setRole] = useState<string | null>(initialRole);
    const [shiftScope, setShiftScope] = useState<string | null>(initialShiftScope);
    const [isPro, setIsPro] = useState<boolean>(initialIsPro);

    useEffect(() => {
        if (token) {
            try {
                const decoded: any = jwtDecode(token);
                // Check if expired
                if (decoded.exp * 1000 < Date.now()) {
                    logout();
                } else {
                    setRole(decoded.role || 'viewer');
                    setShiftScope(decoded.shift_scope || null);
                    setIsPro(!!decoded.is_pro);
                }
            } catch (e) {
                console.error("Invalid token", e);
                logout();
            }
        } else {
            // Anonymous fallback
            setRole('viewer');
            setShiftScope(null);
            setIsPro(false);
        }
    }, [token]);

    const login = async (email: string, password: string): Promise<boolean> => {
        try {
            const data = await authService.login(email, password);
            if (data && data.access_token) {
                setToken(data.access_token);
                localStorage.setItem('token', data.access_token);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login failed', error);
            return false;
        }
    };

    const logout = () => {
        setToken(null);
        setRole('viewer');
        setShiftScope(null);
        setIsPro(false);
        localStorage.removeItem('token');
    };

    // Derived permissions
    const canEdit = role === 'admin' || role === 'manager';
    const canManage = role === 'admin';
    const isSupervisor = role === 'supervisor';
    const isViewer = !role || role === 'viewer'; // True if not logged in or explicitly viewer

    const canAccessPage = (path: string) => {
        if (canEdit) return true; // Admins and managers access everything

        switch (path) {
            case '/upload':
            case '/settings':
            case '/rates':
            case '/admin/users':
                return false; // Viewers and Supervisors cannot access these pages
            case '/reports':
            case '/versions':
            case '/analytics':
            case '/leaderboard':
            case '/operators':
            case '/dashboard':
            case '/production-board':
            default:
                return true; // Everyone can see standard read-only views
        }
    };

    return (
        <AuthContext.Provider value={{
            token, role, shiftScope, isPro,
            login, logout,
            canEdit, canManage, isSupervisor, isViewer, canAccessPage
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
