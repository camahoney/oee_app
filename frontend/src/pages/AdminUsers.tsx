import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Tag, Space, Typography, Switch, Checkbox, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined } from '@ant-design/icons';
import { authService, User } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;

const ALL_PAGES = [
    { path: '/upload', label: 'Upload & Analyze' },
    { path: '/rates', label: 'Rates' },
    { path: '/reports', label: 'Reports' },
    { path: '/settings', label: 'Settings' },
    { path: '/versions', label: 'Versions' },
    { path: '/admin/users', label: 'User Management' },
];

const ROLE_COLORS: Record<string, string> = {
    admin: 'blue',
    manager: 'green',
    supervisor: 'orange',
    viewer: 'default',
};

const AdminUsers: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [createForm] = Form.useForm();
    const [editForm] = Form.useForm();

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

    // ── Create User ──
    const handleCreateUser = async (values: any) => {
        try {
            await authService.createUser({
                email: values.email,
                password: values.password,
                role: values.role,
                shift_scope: values.shift_scope || null,
                is_pro: values.is_pro || false,
                allowed_pages: values.allowed_pages || [],
            });
            message.success('User created successfully');
            setIsCreateModalVisible(false);
            createForm.resetFields();
            fetchUsers();
        } catch (error: any) {
            message.error(error.response?.data?.detail || 'Failed to create user');
        }
    };

    // ── Edit User ──
    const openEditModal = (user: User) => {
        setEditingUser(user);
        editForm.setFieldsValue({
            email: user.email,
            role: user.role,
            shift_scope: user.shift_scope || '',
            is_pro: user.is_pro || false,
            allowed_pages: user.allowed_pages || [],
            password: '',
        });
        setIsEditModalVisible(true);
    };

    const handleUpdateUser = async (values: any) => {
        if (!editingUser) return;
        try {
            const updateData: any = {
                role: values.role,
                shift_scope: values.shift_scope || null,
                is_pro: values.is_pro || false,
                allowed_pages: values.allowed_pages || [],
            };
            // Only send password if the admin typed one
            if (values.password && values.password.trim() !== '') {
                updateData.password = values.password;
            }
            await authService.updateUser(editingUser.id!, updateData);
            message.success(`Updated ${editingUser.email}`);
            setIsEditModalVisible(false);
            setEditingUser(null);
            editForm.resetFields();
            fetchUsers();
        } catch (error: any) {
            message.error(error.response?.data?.detail || 'Failed to update user');
        }
    };

    // ── Delete User ──
    const handleDeleteUser = async (userId: number, email: string) => {
        try {
            await authService.deleteUser(userId);
            message.success(`Deleted ${email}`);
            fetchUsers();
        } catch (error: any) {
            message.error(error.response?.data?.detail || 'Failed to delete user');
        }
    };

    // ── Table Columns ──
    const columns = [
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            render: (email: string) => <Text strong>{email}</Text>,
        },
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
            width: 120,
            render: (role: string) => (
                <Tag color={ROLE_COLORS[role] || 'default'}>
                    {role.toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Shift Scope',
            dataIndex: 'shift_scope',
            key: 'shift_scope',
            width: 130,
            render: (scope: string | null) => scope ? <Tag>{scope}</Tag> : <Text type="secondary">—</Text>,
        },
        {
            title: 'Page Access',
            dataIndex: 'allowed_pages',
            key: 'allowed_pages',
            render: (pages: string[] | null, record: User) => {
                if (record.role === 'admin') return <Tag color="blue">Full Access</Tag>;
                if (!pages || pages.length === 0) return <Text type="secondary">Role Default</Text>;
                return (
                    <Space size={[4, 4]} wrap>
                        {pages.map(p => {
                            const label = ALL_PAGES.find(ap => ap.path === p)?.label || p;
                            return <Tag key={p} style={{ fontSize: 11 }}>{label}</Tag>;
                        })}
                    </Space>
                );
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 140,
            render: (_: any, record: User) => (
                <Space size="small">
                    <Tooltip title="Edit User">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => openEditModal(record)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title={`Delete ${record.email}?`}
                        description="This action cannot be undone."
                        onConfirm={() => handleDeleteUser(record.id!, record.email)}
                        okText="Delete"
                        okType="danger"
                    >
                        <Tooltip title="Delete User">
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    // ── Shared Form Fields ──
    const UserFormFields = ({ isCreate }: { isCreate: boolean }) => (
        <>
            {isCreate && (
                <Form.Item
                    name="email"
                    label="Email"
                    rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}
                >
                    <Input placeholder="user@oee.local" />
                </Form.Item>
            )}
            <Form.Item
                name="password"
                label={isCreate ? "Password" : "New Password (leave blank to keep current)"}
                rules={isCreate ? [{ required: true, min: 4, message: 'Min 4 characters' }] : []}
            >
                <Input.Password placeholder={isCreate ? "Enter password" : "Leave blank to keep unchanged"} prefix={<LockOutlined />} />
            </Form.Item>
            <Form.Item name="role" label="Role" rules={[{ required: true }]}>
                <Select>
                    <Option value="admin">Admin</Option>
                    <Option value="manager">Manager</Option>
                    <Option value="supervisor">Supervisor</Option>
                    <Option value="viewer">Viewer</Option>
                </Select>
            </Form.Item>
            <Form.Item name="shift_scope" label="Shift Scope">
                <Select allowClear placeholder="None (all shifts)">
                    <Option value="1st Shift">1st Shift</Option>
                    <Option value="2nd Shift">2nd Shift</Option>
                    <Option value="3rd Shift">3rd Shift</Option>
                </Select>
            </Form.Item>
            <Form.Item name="allowed_pages" label="Page Access (check to grant access)">
                <Checkbox.Group style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ALL_PAGES.map(p => (
                        <Checkbox key={p.path} value={p.path}>
                            {p.label}
                        </Checkbox>
                    ))}
                </Checkbox.Group>
            </Form.Item>
            <Form.Item name="is_pro" label="Pro User" valuePropName="checked">
                <Switch checkedChildren="PRO" unCheckedChildren="STD" />
            </Form.Item>
        </>
    );

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0, color: '#003366' }}>User Management</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalVisible(true)} style={{ backgroundColor: '#003366' }}>
                    Add User
                </Button>
            </div>

            <Table
                columns={columns}
                dataSource={users}
                rowKey="id"
                loading={loading}
                pagination={false}
                bordered
                size="middle"
                style={{ background: '#fff', borderRadius: 8 }}
            />

            {/* Create Modal */}
            <Modal
                title="Create New User"
                open={isCreateModalVisible}
                onCancel={() => { setIsCreateModalVisible(false); createForm.resetFields(); }}
                footer={null}
                width={480}
            >
                <Form form={createForm} layout="vertical" onFinish={handleCreateUser} initialValues={{ role: 'viewer', is_pro: false, allowed_pages: [] }}>
                    <UserFormFields isCreate={true} />
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block style={{ backgroundColor: '#003366' }}>
                            Create User
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Edit Modal */}
            <Modal
                title={`Edit User — ${editingUser?.email || ''}`}
                open={isEditModalVisible}
                onCancel={() => { setIsEditModalVisible(false); setEditingUser(null); editForm.resetFields(); }}
                footer={null}
                width={480}
            >
                <Form form={editForm} layout="vertical" onFinish={handleUpdateUser}>
                    <UserFormFields isCreate={false} />
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block style={{ backgroundColor: '#003366' }}>
                            Save Changes
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default AdminUsers;
