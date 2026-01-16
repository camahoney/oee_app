import React, { useEffect, useState } from 'react';
import { Typography, Table, Button, Space, message, Popconfirm, Card } from 'antd';
import { EyeOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import { reportService } from '../services/api';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const Reports: React.FC = () => {
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchReports = async () => {
        try {
            setLoading(true);
            const data = await reportService.getReports();
            setReports(data);
        } catch (error) {
            message.error('Failed to load reports');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const handleDelete = async (id: number) => {
        try {
            await reportService.deleteReport(id);
            message.success('Report deleted successfully');
            fetchReports();
        } catch (error) {
            message.error('Failed to delete report');
        }
    };

    const columns = [
        {
            title: 'Report Filename',
            dataIndex: 'filename',
            key: 'filename',
            render: (text: string) => <Space><FileTextOutlined /> <Text strong>{text}</Text></Space>
        },
        {
            title: 'Uploaded At',
            dataIndex: 'uploaded_at',
            key: 'uploaded_at',
            render: (text: string) => new Date(text + 'Z').toLocaleString(),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: any) => (
                <Space>
                    <Button
                        type="primary"
                        icon={<EyeOutlined />}
                        onClick={() => navigate(`/dashboard?reportId=${record.id}`)}
                    >
                        View
                    </Button>
                    <Popconfirm
                        title="Delete Report"
                        description="Are you sure you want to delete this report? This cannot be undone."
                        onConfirm={() => handleDelete(record.id)}
                        okText="Yes, Delete"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                    >
                        <Button danger icon={<DeleteOutlined />}>Delete</Button>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
            <div style={{ marginBottom: '32px' }}>
                <Title level={2} style={{ marginBottom: 0 }}>
                    <FileTextOutlined style={{ marginRight: 12, color: '#1890ff' }} />
                    Reports Management
                </Title>
                <Text type="secondary" style={{ fontSize: '16px' }}>View and manage past production reports</Text>
            </div>

            <Card bordered={false} style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Table
                    dataSource={reports}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                />
            </Card>
        </div>
    );
};

export default Reports;
