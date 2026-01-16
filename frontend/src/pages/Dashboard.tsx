import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Statistic, List, Tag, Spin, message, Button } from 'antd';
import { DashboardOutlined, FieldTimeOutlined, ThunderboltOutlined, SafetyCertificateOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { reportService } from '../services/api';
import { useSearchParams, useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const reportId = searchParams.get('reportId');

    const fetchStats = async () => {
        try {
            setLoading(true);
            const data = await reportService.getDashboardStats(reportId ? Number(reportId) : undefined);
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
    }, [reportId]);

    if (loading) {
        return <div style={{ textAlign: 'center', marginTop: 50 }}><Spin size="large" /></div>;
    }

    if (!stats) {
        return <div>No data available.</div>;
    }

    return (
        <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
            <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Title level={2} style={{ marginBottom: 0 }}>
                        <DashboardOutlined style={{ marginRight: 12, color: '#1890ff' }} />
                        {reportId ? `Report Details (ID: ${reportId})` : 'Production Dashboard'}
                    </Title>
                    <Text type="secondary" style={{ fontSize: '16px' }}>
                        {reportId ? 'Historical Analysis View' : 'Real-time OEE Analytics & Insights'}
                    </Text>
                </div>
                {reportId && (
                    <Button
                        type="default"
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate('/reports')}
                        size="large"
                    >
                        Back to Reports
                    </Button>
                )}
            </div>

            <Row gutter={[24, 24]}>
                <Col span={6}>
                    <Card hoverable bordered={false} style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <Statistic
                            title={<Text type="secondary">OEE Score</Text>}
                            value={stats.oee}
                            precision={1}
                            suffix="%"
                            valueStyle={{ color: stats.oee >= 85 ? '#52c41a' : '#f5222d', fontWeight: 'bold' }}
                            prefix={<span style={{ fontSize: '24px', marginRight: '8px' }}>🚀</span>}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card hoverable bordered={false} style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <Statistic
                            title={<Text type="secondary">Availability</Text>}
                            value={stats.availability}
                            precision={1}
                            suffix="%"
                            prefix={<FieldTimeOutlined style={{ color: '#1890ff' }} />}
                            valueStyle={{ fontWeight: 'bold' }}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card hoverable bordered={false} style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <Statistic
                            title={<Text type="secondary">Performance</Text>}
                            value={stats.performance}
                            precision={1}
                            suffix="%"
                            prefix={<ThunderboltOutlined style={{ color: '#faad14' }} />}
                            valueStyle={{ fontWeight: 'bold' }}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card hoverable bordered={false} style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <Statistic
                            title={<Text type="secondary">Quality</Text>}
                            value={stats.quality}
                            precision={1}
                            suffix="%"
                            prefix={<SafetyCertificateOutlined style={{ color: '#52c41a' }} />}
                            valueStyle={{ fontWeight: 'bold' }}
                        />
                    </Card>
                </Col>
            </Row>

            <div style={{ marginTop: 32 }}>
                <Card
                    title={<Title level={4} style={{ margin: 0 }}>{reportId ? 'Report Activity Log' : 'Recent Activity Log'}</Title>}
                    bordered={false}
                    style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                >
                    <List
                        itemLayout="vertical"
                        size="large"
                        pagination={{
                            pageSize: 500, // Show all operators in one page as requested
                            position: 'bottom',
                            showSizeChanger: false
                        }}
                        dataSource={stats.recent_activity || []}
                        renderItem={(item: any) => (
                            <List.Item
                                key={item.id}
                                style={{ padding: '20px 0', borderBottom: '1px solid #f0f0f0' }}
                                extra={
                                    <div style={{ textAlign: 'right', minWidth: '150px' }}>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                                            {(item.oee * 100).toFixed(1)}%
                                        </div>
                                        <Text type="secondary">OEE Score</Text>
                                    </div>
                                }
                            >
                                <List.Item.Meta
                                    title={
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '18px', fontWeight: '600' }}>{item.operator || 'Unknown Operator'}</span>
                                            {item.warning && <Tag color="warning" style={{ borderRadius: '4px' }}>Missing Rate</Tag>}
                                            {item.insight && (
                                                <Tag color={item.insight.includes("High") ? "red" : "orange"} style={{ borderRadius: '4px', fontWeight: '500' }}>
                                                    {item.insight}
                                                </Tag>
                                            )}
                                        </div>
                                    }
                                    description={
                                        <div>
                                            <div style={{ fontSize: '14px', marginBottom: '12px', color: '#595959' }}>
                                                <strong>Part:</strong> {item.part_number} &bull; <strong>Machine:</strong> {item.machine} &bull; <strong>Date:</strong> {item.date}
                                            </div>

                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(4, 1fr)',
                                                gap: '12px',
                                                background: '#fafafa',
                                                padding: '12px',
                                                borderRadius: '8px',
                                                border: '1px solid #f0f0f0',
                                                maxWidth: '600px'
                                            }}>
                                                <div>
                                                    <Text type="secondary" style={{ fontSize: '12px' }}>⏱️ Run Time</Text>
                                                    <div style={{ fontWeight: '600' }}>{((item.run_time_min || 0) / 60).toFixed(1)} hrs</div>
                                                </div>
                                                <div>
                                                    <Text type="secondary" style={{ fontSize: '12px' }}>🛑 Downtime</Text>
                                                    <div style={{ fontWeight: '600' }}>{item.downtime_min || 0} min</div>
                                                </div>
                                                <div>
                                                    <Text type="secondary" style={{ fontSize: '12px' }}>✅ Good Pts</Text>
                                                    <div style={{ fontWeight: '600', color: '#52c41a' }}>{item.good_count || 0}</div>
                                                </div>
                                                <div>
                                                    <Text type="secondary" style={{ fontSize: '12px' }}>❌ Rejects</Text>
                                                    <div style={{ fontWeight: '600', color: '#ff4d4f' }}>{item.reject_count || 0}</div>
                                                </div>
                                            </div>
                                        </div>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
