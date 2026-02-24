import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, message, Space, Tag } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { authService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

const BRAND_BLUE = '#003366';

const LoginPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const onFinish = async (values: { email: string; password: string }) => {
        setLoading(true);
        try {
            const response = await authService.login(values.email, values.password);
            login(response.access_token);
            message.success(`Welcome! Logged in as ${response.role || 'user'}`);
        } catch (err: any) {
            const detail = err?.response?.data?.detail || 'Login failed. Check your credentials.';
            message.error(detail);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #001529 0%, #003366 50%, #004080 100%)',
        }}>
            <Card
                style={{
                    width: 400,
                    borderRadius: 12,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                }}
                bodyStyle={{ padding: '40px 32px' }}
            >
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <img
                        src="/logo.png"
                        alt="Vibracoustic"
                        style={{ height: 50, marginBottom: 16, objectFit: 'contain' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <Title level={3} style={{ margin: 0, color: BRAND_BLUE }}>OEE Analytics</Title>
                    <Text type="secondary">Sign in to continue</Text>
                </div>

                <Form
                    name="login"
                    onFinish={onFinish}
                    layout="vertical"
                    size="large"
                >
                    <Form.Item
                        name="email"
                        rules={[{ required: true, message: 'Please enter your email' }]}
                    >
                        <Input
                            prefix={<UserOutlined />}
                            placeholder="Email"
                            autoComplete="username"
                        />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Please enter your password' }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="Password"
                            autoComplete="current-password"
                        />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 16 }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            block
                            style={{
                                height: 44,
                                borderRadius: 8,
                                background: BRAND_BLUE,
                                fontWeight: 600,
                            }}
                        >
                            Sign In
                        </Button>
                    </Form.Item>
                </Form>

                <div style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Continue without login for <Tag color="blue" style={{ fontSize: 11 }}>view-only</Tag> access
                    </Text>
                </div>
            </Card>
        </div>
    );
};

export default LoginPage;
