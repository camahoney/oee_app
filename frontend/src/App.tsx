import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Menu, ConfigProvider } from 'antd';
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
    HistoryOutlined
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
import Login from './pages/Login';
import VersionHistory from './pages/VersionHistory';
import AdminUsers from './pages/AdminUsers';
import ProductionBoard from './pages/ProductionBoard';

import { AuthProvider, useAuth } from './context/AuthContext';

const { Header, Content, Sider } = Layout;

// Vibracoustic Brand Colors
const BRAND_BLUE = '#003366';

const ProtectedRoute: React.FC<{ path: string, children: React.ReactNode }> = ({ path, children }) => {
    const { canAccessPage } = useAuth();
    if (!canAccessPage(path)) {
        return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
};

const AppContent: React.FC = () => {
    const { role, shiftScope, isViewer, logout, canAccessPage } = useAuth();
    const navigate = useNavigate();

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

                {/* User Session Badge / Sign Out (Placed ABOVE Dashboard as requested) */}
                <div style={{ padding: '0 16px 16px 16px', textAlign: 'center' }}>
                    {!isViewer ? (
                        <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px', border: '1px solid #e8e8e8' }}>
                            <div style={{ fontWeight: 'bold', color: BRAND_BLUE, marginBottom: '4px' }}>
                                {role === 'admin' ? 'Admin' : role === 'manager' ? 'Manager' : 'Supervisor'}
                            </div>
                            {shiftScope && (
                                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                                    {shiftScope}
                                </div>
                            )}
                            <Button size="small" type="default" onClick={logout} block>
                                Sign Out
                            </Button>
                        </div>
                    ) : (
                        <Button type="primary" style={{ backgroundColor: BRAND_BLUE }} block onClick={() => navigate('/login')}>
                            Sign In / Manager Access
                        </Button>
                    )}
                </div>

                <Menu
                    theme="light"
                    mode="inline"
                    defaultSelectedKeys={["dashboard"]}
                    style={{ borderRight: 0 }}
                >
                    <Menu.Item key="dashboard" icon={<DashboardOutlined />}> <a href="/dashboard">Dashboard</a> </Menu.Item>
                    <Menu.Item key="production-board" icon={<DashboardOutlined />}> <a href="/production-board">Production Board</a> </Menu.Item>
                    <Menu.Item key="analytics" icon={<BarChartOutlined />}> <a href="/analytics">Analytics</a> </Menu.Item>
                    <Menu.Item key="operators" icon={<TeamOutlined />}> <a href="/operators">Operator Perf.</a> </Menu.Item>
                    <Menu.Item key="leaderboard" icon={<TrophyOutlined />}> <a href="/leaderboard">Leaderboard</a> </Menu.Item>

                    {canAccessPage('/upload') && <Menu.Item key="upload" icon={<UploadOutlined />}> <a href="/upload">Upload & Analyze</a> </Menu.Item>}
                    {canAccessPage('/rates') && <Menu.Item key="rates" icon={<TableOutlined />}> <a href="/rates">Rates</a> </Menu.Item>}
                    {canAccessPage('/reports') && <Menu.Item key="reports" icon={<FileTextOutlined />}> <a href="/reports">Reports</a> </Menu.Item>}
                    {canAccessPage('/settings') && <Menu.Item key="settings" icon={<SettingOutlined />}> <a href="/settings">Settings</a> </Menu.Item>}
                    {canAccessPage('/versions') && <Menu.Item key="versions" icon={<HistoryOutlined />}> <a href="/versions">Versions</a> </Menu.Item>}
                    {canAccessPage('/admin/users') && <Menu.Item key="admin-users" icon={<TeamOutlined />}> <a href="/admin/users">User Admin</a> </Menu.Item>}
                </Menu>
            </Sider>
            <Layout>
                <Content style={{ margin: '24px', minHeight: 280 }}>
                    <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/login" element={<Login />} />

                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/production-board" element={<ProductionBoard />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/operators" element={<OperatorPerformance />} />
                        <Route path="/leaderboard" element={<Leaderboard />} />

                        <Route path="/upload" element={<ProtectedRoute path="/upload"><Upload /></ProtectedRoute>} />
                        <Route path="/rates" element={<ProtectedRoute path="/rates"><Rates /></ProtectedRoute>} />
                        <Route path="/reports" element={<ProtectedRoute path="/reports"><Reports /></ProtectedRoute>} />
                        <Route path="/settings" element={<ProtectedRoute path="/settings"><SettingsPage /></ProtectedRoute>} />
                        <Route path="/versions" element={<ProtectedRoute path="/versions"><VersionHistory /></ProtectedRoute>} />
                        <Route path="/admin/users" element={<ProtectedRoute path="/admin/users"><AdminUsers /></ProtectedRoute>} />

                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
                    <AppContent />
                </Router>
            </AuthProvider>
        </ConfigProvider>
    );
};

export default App;
