import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Tag, Space, Typography, Switch } from 'antd';
import { PlusOutlined, UserSwitchOutlined } from '@ant-design/icons';
import { authService, User } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { Title } = Typography;
const { Option } = Select;

const AdminUsers: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const { impersonate } = useAuth();

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await authService.getUsers();
            setUsers(data);
        } catch (error) {
            message.error('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreateUser = async (values: any) => {
        try {
            await authService.createUser(values);
            message.success('User created successfully');
            setIsModalVisible(false);
            form.resetFields();
            fetchUsers();
        } catch (error: any) {
            message.error(error.response?.data?.detail || 'Failed to create user');
        }
    };

    const handleImpersonate = async (email: string) => {
        try {
            const data = await authService.impersonate(email);
            impersonate(data.access_token);
        } catch (error) {
            message.error('Failed to switch user');
        }
    };

    const handleUpdateProStatus = async (user: User, isPro: boolean) => {
        try {
            await authService.updateUser(user.id, { is_pro: isPro });
            message.success(`Updated ${user.email} to ${isPro ? 'Pro' : 'Standard'} status`);
            fetchUsers();
        } catch (error: any) {
            console.error("Update failed:", error);
            message.error(error.response?.data?.detail || 'Failed to update user status');
        }
    };


    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
        },
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
            render: (role: string) => (
                <Tag color={role === 'admin' ? 'blue' : 'green'}>
                    {role.toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Pro Status',
            dataIndex: 'is_pro',
            key: 'is_pro',
            render: (is_pro: boolean, record: User) => (
                <Switch
                    checked={is_pro}
                    onChange={(checked) => handleUpdateProStatus(record, checked)}
                    checkedChildren="PRO"
                    unCheckedChildren="STD"
                />
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: User) => (
                <Space size="middle">
                    <Button
                        type="dashed"
                        icon={<UserSwitchOutlined />}
                        onClick={() => handleImpersonate(record.email)}
                    >
                        Switch User
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2}>Persona Management</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
                    Add Persona
                </Button>
            </div>

            <Table
                columns={columns}
                dataSource={users}
                rowKey="id"
                loading={loading}
            />

            <Modal
                title="Create New Persona"
                visible={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                footer={null}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleCreateUser}
                >
                    <Form.Item
                        name="email"
                        label="Email"
                        rules={[{ required: true, type: 'email' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        label="Password"
                        rules={[{ required: true, min: 6 }]}
                    >
                        <Input.Password />
                    </Form.Item>
                    <Form.Item
                        name="role"
                        label="Role"
                        initialValue="analyst"
                    >
                        <Select>
                            <Option value="analyst">Analyst</Option>
                            <Option value="admin">Admin</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="is_pro"
                        label="Pro User"
                        valuePropName="checked"
                        initialValue={false}
                    >
                        <Switch checkedChildren="PRO" unCheckedChildren="STD" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block>
                            Create User
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default AdminUsers;
