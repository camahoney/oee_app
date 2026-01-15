import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
    DashboardOutlined,
    UploadOutlined,
    TableOutlined,
    FileTextOutlined,
    SettingOutlined,
} from '@ant-design/icons';

import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Rates from './pages/Rates';
import Reports from './pages/Reports';
import SettingsPage from './pages/Settings';

const { Header, Content, Sider } = Layout;

const App: React.FC = () => {
    return (
        <Router>
            <Layout style={{ minHeight: '100vh' }}>
                <Sider collapsible>
                    <div style={{ height: 32, margin: 16, background: 'rgba(255,255,255,0.2)' }} />
                    <Menu theme="dark" mode="inline" defaultSelectedKeys={["dashboard"]}>
                        <Menu.Item key="dashboard" icon={<DashboardOutlined />}> <a href="/dashboard">Dashboard</a> </Menu.Item>
                        <Menu.Item key="upload" icon={<UploadOutlined />}> <a href="/upload">Upload & Analyze</a> </Menu.Item>
                        <Menu.Item key="rates" icon={<TableOutlined />}> <a href="/rates">Rates</a> </Menu.Item>
                        <Menu.Item key="reports" icon={<FileTextOutlined />}> <a href="/reports">Reports</a> </Menu.Item>
                        <Menu.Item key="settings" icon={<SettingOutlined />}> <a href="/settings">Settings</a> </Menu.Item>
                    </Menu>
                </Sider>
                <Layout>
                    <Header style={{ background: '#fff', padding: 0 }} />
                    <Content style={{ margin: '16px' }}>
                        <Routes>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/upload" element={<Upload />} />
                            <Route path="/rates" element={<Rates />} />
                            <Route path="/reports" element={<Reports />} />
                            <Route path="/settings" element={<SettingsPage />} />
                        </Routes>
                    </Content>
                </Layout>
            </Layout>
        </Router>
    );
};

export default App;
