import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Statistic, List, Tag, Spin, message } from 'antd';
import { DashboardOutlined, FieldTimeOutlined, ThunderboltOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { reportService } from '../services/api';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            const data = await reportService.getDashboardStats();
            setStats(data);
        } catch (error) {
            console.error("Dashboard fetch error:", error);
            message.error("Failed to load dashboard data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    if (loading) {
        return <div style={{ textAlign: 'center', marginTop: 50 }}><Spin size="large" /></div>;
    }

    if (!stats) {
        return <div>No data available.</div>;
    }

    return (
        <div>
            <Title level={2}><DashboardOutlined /> Dashboard</Title>

            <Row gutter={[16, 16]}>
                <Col span={6}>
                    <Card bordered={false}>
                        <Statistic
                            title="OEE"
                            value={stats.oee}
                            precision={1}
                            suffix="%"
                            valueStyle={{ color: stats.oee >= 85 ? '#3f8600' : '#cf1322' }}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card bordered={false}>
                        <Statistic
                            title="Availability"
                            value={stats.availability}
                            precision={1}
                            suffix="%"
                            prefix={<FieldTimeOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card bordered={false}>
                        <Statistic
                            title="Performance"
                            value={stats.performance}
                            precision={1}
                            suffix="%"
                            prefix={<ThunderboltOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card bordered={false}>
                        <Statistic
                            title="Quality"
                            value={stats.quality}
                            precision={1}
                            suffix="%"
                            prefix={<SafetyCertificateOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            <div style={{ marginTop: 24 }}>
                <Title level={4}>Recent Activity</Title>
                <List
                    bordered
                    dataSource={stats.recent_activity || []}
                    renderItem={(item: any) => (
                        <List.Item>
                            <List.Item.Meta
                                title={<Text strong>Operator: {item.operator || 'Unknown'}</Text>}
                                description={`Part: ${item.part_number || 'N/A'} | Machine: ${item.machine || 'Unknown'} | Date: ${item.date}`}
                            />
                            <Tag color="blue">OEE: {(item.oee * 100).toFixed(1)}%</Tag>
                        </List.Item>
                    )}
                />
            </div>
        </div>
    );
};

export default Dashboard;
