import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout, Menu, ConfigProvider, Button, Dropdown, Avatar, Spin } from 'antd';
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
    UserOutlined,
    LogoutOutlined,
    UserSwitchOutlined
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
import Login from './pages/Login';
import AdminUsers from './pages/AdminUsers';

import { AuthProvider, useAuth } from './context/AuthContext';

const { Header, Content, Sider } = Layout;

// Vibracoustic Brand Colors
const BRAND_BLUE = '#003366';

// Private Route Component
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};

const AppContent: React.FC = () => {
    const { logout, user } = useAuth();

    // User Menu for Dropdown
    const userMenu = (
        <Menu>
            <Menu.Item key="email" disabled>
                {user?.email}
            </Menu.Item>
            <Menu.Divider />
            {user?.role === 'admin' && (
                <Menu.Item key="users" icon={<UserSwitchOutlined />}>
                    <a href="/admin/users">Manage Users</a>
                </Menu.Item>
            )}
            <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={logout}>
                Logout
            </Menu.Item>
        </Menu>
    );

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
                    <Menu.Item key="dashboard" icon={<DashboardOutlined />}> <a href="/dashboard">Dashboard</a> </Menu.Item>
                    <Menu.Item key="analytics" icon={<BarChartOutlined />}> <a href="/analytics">Analytics</a> </Menu.Item>
                    <Menu.Item key="weekly" icon={<LineChartOutlined />}> <a href="/weekly">Weekly OEE</a> </Menu.Item>
                    <Menu.Item key="operators" icon={<TeamOutlined />}> <a href="/operators">Operator Perf.</a> </Menu.Item>
                    <Menu.Item key="leaderboard" icon={<TrophyOutlined />}> <a href="/leaderboard">Leaderboard</a> </Menu.Item>
                    <Menu.Item key="upload" icon={<UploadOutlined />}> <a href="/upload">Upload & Analyze</a> </Menu.Item>
                    <Menu.Item key="rates" icon={<TableOutlined />}> <a href="/rates">Rates</a> </Menu.Item>
                    <Menu.Item key="reports" icon={<FileTextOutlined />}> <a href="/reports">Reports</a> </Menu.Item>
                    <Menu.Item key="settings" icon={<SettingOutlined />}> <a href="/settings">Settings</a> </Menu.Item>
                    <Menu.Item key="versions" icon={<HistoryOutlined />}> <a href="/versions">Versions</a> </Menu.Item>
                </Menu>

                {/* User Profile Section in Sider */}
                <div style={{ position: 'absolute', bottom: 20, width: '100%', padding: '0 24px' }}>
                    <Dropdown overlay={userMenu} placement="topRight" trigger={['click']}>
                        <Button type="text" block style={{ height: 'auto', padding: '8px 0', textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{ position: 'relative', marginRight: 12 }}>
                                    <Avatar icon={<UserOutlined />} style={{ backgroundColor: BRAND_BLUE }} />
                                    {user?.is_pro && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: -2,
                                            right: -2,
                                            backgroundColor: '#faad14', // Gold color for Pro
                                            color: 'white',
                                            fontSize: '8px',
                                            padding: '0 4px',
                                            borderRadius: '4px',
                                            fontWeight: 'bold',
                                            border: '1px solid white'
                                        }}>
                                            PRO
                                        </div>
                                    )}
                                </div>
                                <div style={{ overflow: 'hidden' }}>
                                    <div style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {user?.role === 'admin' ? 'Admin' : 'User'}
                                        {user?.is_pro && <span style={{ fontSize: '10px', color: '#faad14', border: '1px solid #faad14', borderRadius: '4px', padding: '0 2px', lineHeight: '12px' }}>PRO</span>}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#8c8c8c', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                        {user?.email}
                                    </div>
                                </div>
                            </div>
                        </Button>
                    </Dropdown>
                </div>
            </Sider>
            <Layout>
                <Content style={{ margin: '24px', minHeight: 280 }}>
                    <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/weekly" element={<WeeklyOEE />} />
                        <Route path="/operators" element={<OperatorPerformance />} />
                        <Route path="/leaderboard" element={<Leaderboard />} />
                        <Route path="/upload" element={<Upload />} />
                        <Route path="/rates" element={<Rates />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/versions" element={<VersionHistory />} />
                        <Route path="/admin/users" element={
                            user?.role === 'admin' ? <AdminUsers /> : <Navigate to="/dashboard" />
                        } />
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
                        <Route path="/login" element={<Login />} />
                        <Route path="/*" element={
                            <PrivateRoute>
                                <AppContent />
                            </PrivateRoute>
                        } />
                    </Routes>
                </Router>
            </AuthProvider>
        </ConfigProvider>
    );
};

export default App;
