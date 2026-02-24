import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, ConfigProvider, Button, Tag, Tooltip, Space, Typography } from 'antd';
import {
    DashboardOutlined,
    UploadOutlined,
    TableOutlined,
    FileTextOutlined,
    SettingOutlined,
    BarChartOutlined,
    TrophyOutlined,
    TeamOutlined,
    LineChartOutlined,
    HistoryOutlined,
    LoginOutlined,
    LogoutOutlined,
    UserOutlined
} from '@ant-design/icons';

import Leaderboard from './pages/Leaderboard';
import Dashboard from './pages/Dashboard';
import OperatorPerformance from './pages/OperatorPerformance';
import Upload from './pages/Upload';
import Rates from './pages/Rates';
import Reports from './pages/Reports';
import SettingsPage from './pages/Settings';
import Analytics from './pages/Analytics';
import WeeklyOEE from './pages/WeeklyOEE';
import VersionHistory from './pages/VersionHistory';
import AdminUsers from './pages/AdminUsers';
import ProductionBoard from './pages/ProductionBoard';
import LoginPage from './pages/LoginPage';

import { AuthProvider, useAuth } from './context/AuthContext';

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

// Vibracoustic Brand Colors
const BRAND_BLUE = '#003366';

// Role color mapping for the user badge
const ROLE_COLORS: Record<string, string> = {
    admin: 'red',
    manager: 'blue',
    supervisor: 'green',
    viewer: 'default',
};

// Protected Route wrapper — redirects denied pages to dashboard
const ProtectedRoute: React.FC<{ page: string; children: React.ReactNode }> = ({ page, children }) => {
    const { canAccessPage, isViewer } = useAuth();
    if (!canAccessPage(page)) {
        return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
};

const AppContent: React.FC = () => {
    const { user, isAuthenticated, canAccessPage, logout, isViewer, canEdit, canManage } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // Show login page at /login route
    if (location.pathname === '/login') {
        if (isAuthenticated) {
            return <Navigate to="/dashboard" replace />;
        }
        return <LoginPage />;
    }

    const role = user?.role || 'viewer';
    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

    // Build menu items based on role
    const menuItems = [
        { key: 'dashboard', icon: <DashboardOutlined />, label: <a href="/dashboard">Dashboard</a>, show: true },
        { key: 'production-board', icon: <DashboardOutlined />, label: <a href="/production-board">Production Board</a>, show: true },
        { key: 'analytics', icon: <BarChartOutlined />, label: <a href="/analytics">Analytics</a>, show: true },
        { key: 'operators', icon: <TeamOutlined />, label: <a href="/operators">Operator Perf.</a>, show: true },
        { key: 'leaderboard', icon: <TrophyOutlined />, label: <a href="/leaderboard">Leaderboard</a>, show: true },
        { key: 'upload', icon: <UploadOutlined />, label: <a href="/upload">Upload & Analyze</a>, show: canManage },
        { key: 'rates', icon: <TableOutlined />, label: <a href="/rates">Rates</a>, show: canManage },
        { key: 'reports', icon: <FileTextOutlined />, label: <a href="/reports">Reports</a>, show: true },
        { key: 'settings', icon: <SettingOutlined />, label: <a href="/settings">Settings</a>, show: canManage },
        { key: 'versions', icon: <HistoryOutlined />, label: <a href="/versions">Versions</a>, show: true },
    ];

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider collapsible theme="light" width={250} style={{ boxShadow: '2px 0 8px 0 rgba(29,35,41,.05)' }}>
                <div style={{
                    height: '140px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '0',
                    margin: '0',
                    overflow: 'hidden',
                }}>
                    <img
                        src="/logo.png"
                        alt="Vibracoustic"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            transform: 'scale(1.3)'
                        }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                </div>
                <Menu
                    theme="light"
                    mode="inline"
                    defaultSelectedKeys={["dashboard"]}
                    style={{ borderRight: 0 }}
                >
                    {menuItems.filter(item => item.show).map(item => (
                        <Menu.Item key={item.key} icon={item.icon}>{item.label}</Menu.Item>
                    ))}
                </Menu>

                {/* User badge at bottom of sidebar */}
                <div style={{
                    position: 'absolute',
                    bottom: 60,
                    left: 0,
                    right: 0,
                    padding: '12px 16px',
                    borderTop: '1px solid #f0f0f0',
                    background: '#fafafa',
                }}>
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Space size={6}>
                            <UserOutlined style={{ color: '#8c8c8c' }} />
                            <Text style={{ fontSize: 12 }} ellipsis>{user?.email || 'Anonymous'}</Text>
                        </Space>
                        <Space size={6}>
                            <Tag color={ROLE_COLORS[role]} style={{ margin: 0, fontSize: 10 }}>{roleLabel}</Tag>
                            {user?.shiftScope && (
                                <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>{user.shiftScope}</Tag>
                            )}
                        </Space>
                        {isAuthenticated ? (
                            <Button
                                type="text"
                                size="small"
                                icon={<LogoutOutlined />}
                                onClick={() => { logout(); navigate('/'); }}
                                style={{ padding: '0 4px', fontSize: 11, color: '#8c8c8c' }}
                            >
                                Sign Out
                            </Button>
                        ) : (
                            <Button
                                type="text"
                                size="small"
                                icon={<LoginOutlined />}
                                onClick={() => navigate('/login')}
                                style={{ padding: '0 4px', fontSize: 11, color: BRAND_BLUE }}
                            >
                                Sign In
                            </Button>
                        )}
                    </Space>
                </div>
            </Sider>
            <Layout>
                <Content style={{ margin: '24px', minHeight: 280 }}>
                    <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/production-board" element={<ProductionBoard />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/operators" element={<OperatorPerformance />} />
                        <Route path="/leaderboard" element={<Leaderboard />} />
                        <Route path="/upload" element={<ProtectedRoute page="upload"><Upload /></ProtectedRoute>} />
                        <Route path="/rates" element={<ProtectedRoute page="rates"><Rates /></ProtectedRoute>} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/settings" element={<ProtectedRoute page="settings"><SettingsPage /></ProtectedRoute>} />
                        <Route path="/versions" element={<VersionHistory />} />
                        <Route path="/admin/users" element={<ProtectedRoute page="admin"><AdminUsers /></ProtectedRoute>} />
                    </Routes>
                </Content>
            </Layout>
        </Layout>
    );
};

const App: React.FC = () => {
    return (
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: BRAND_BLUE,
                    fontFamily: 'Roboto, sans-serif',
                },
            }}
        >
            <AuthProvider>
                <Router>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/*" element={<AppContent />} />
                    </Routes>
                </Router>
            </AuthProvider>
        </ConfigProvider>
    );
};

export default App;
