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
import VersionHistory from './pages/VersionHistory';
import AdminUsers from './pages/AdminUsers';

import { AuthProvider } from './context/AuthContext';

const { Header, Content, Sider } = Layout;

// Vibracoustic Brand Colors
const BRAND_BLUE = '#003366';

const AppContent: React.FC = () => {
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
                        <Route path="/admin/users" element={<AdminUsers />} />
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
