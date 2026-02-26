import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Divider } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const Login: React.FC = () => {
    const { login, role, isViewer } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onFinish = async (values: any) => {
        setLoading(true);
        setError(null);
        try {
            const success = await login(values.email, values.password);
            if (success) {
                navigate('/dashboard');
            } else {
                setError('Invalid email or password');
            }
        } catch (err) {
            setError('An error occurred during login');
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
            backgroundColor: '#f0f2f5'
        }}>
            <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <img
                        src="/logo.png"
                        alt="Vibracoustic Logo"
                        style={{ height: 60, marginBottom: 16 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <Title level={3} style={{ color: '#003366', margin: 0 }}>OEE Analytics</Title>
                    <Text type="secondary">Sign in to manage production data</Text>
                </div>

                {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

                {role !== 'viewer' && !isViewer && role ? (
                    <Alert
                        message="Already Signed In"
                        description={`You are currently signed in as a ${role}.`}
                        type="success"
                        showIcon
                        style={{ marginBottom: 16 }}
                        action={
                            <Button size="small" type="primary" onClick={() => navigate('/dashboard')}>
                                Go to Dashboard
                            </Button>
                        }
                    />
                ) : null}

                <Form
                    name="login_form"
                    onFinish={onFinish}
                    layout="vertical"
                >
                    <Form.Item
                        name="email"
                        rules={[{ required: true, message: 'Please input your email!' }]}
                    >
                        <Input prefix={<UserOutlined />} placeholder="Email (e.g., admin@oee.local)" size="large" />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Please input your password!' }]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" size="large" block loading={loading} style={{ backgroundColor: '#003366' }}>
                            Sign In
                        </Button>
                    </Form.Item>
                </Form>

                <Divider style={{ margin: '16px 0' }} />
                <div style={{ textAlign: 'center' }}>
                    <Text type="secondary">
                        Don't have an account? The board is viewable without signing in. <br />
                        <a href="/dashboard">Continue as Guest</a>
                    </Text>
                </div>
            </Card>
        </div>
    );
};

export default Login;
