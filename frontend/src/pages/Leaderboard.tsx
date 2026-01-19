import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Table, Spin, Avatar, Statistic, Empty, Badge } from 'antd';
import { CrownOutlined, TrophyOutlined, UserOutlined, RiseOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
import { analyticsService } from '../services/api';

const { Title, Text } = Typography;

const BRAND_BLUE = '#003366';
const GOLD = '#FFD700';
const SILVER = '#C0C0C0';
const BRONZE = '#CD7F32';

const Leaderboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [operators, setOperators] = useState<any[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Defaulting to last 30 days for leaderboard context, or could make this selectable
            const startDate = dayjs().subtract(30, 'days').format('YYYY-MM-DD');
            const endDate = dayjs().format('YYYY-MM-DD');

            const ops = await analyticsService.getComparison('operator', startDate, endDate);
            // Sort by Volume descending
            const sortedOps = ops.sort((a: any, b: any) => (b.total_produced || 0) - (a.total_produced || 0));
            setOperators(sortedOps);
        } catch (e) { console.error("Leaderboard fetch failed", e); }
        setLoading(false);
    };

    const getRankColor = (rank: number) => {
        if (rank === 0) return GOLD;
        if (rank === 1) return SILVER;
        if (rank === 2) return BRONZE;
        return '#f0f0f0'; // Default gray
    };

    const getRankIcon = (rank: number) => {
        if (rank === 0) return <CrownOutlined style={{ fontSize: 32, color: '#fff' }} />;
        if (rank === 1) return <TrophyOutlined style={{ fontSize: 28, color: '#fff' }} />;
        if (rank === 2) return <TrophyOutlined style={{ fontSize: 24, color: '#fff' }} />;
        return <UserOutlined style={{ fontSize: 20, color: '#999' }} />;
    };

    if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

    const top3 = operators.slice(0, 3);

    // Podium order for visual display: 2nd, 1st, 3rd
    const podiumData = [
        top3[1] ? { ...top3[1], rank: 1, originalIndex: 1 } : null,
        top3[0] ? { ...top3[0], rank: 0, originalIndex: 0 } : null,
        top3[2] ? { ...top3[2], rank: 2, originalIndex: 2 } : null,
    ].filter(Boolean);

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <Title level={1} style={{ color: BRAND_BLUE, marginBottom: 8 }}>
                    <TrophyOutlined /> Operator Hall of Fame
                </Title>
                <Text type="secondary" style={{ fontSize: 16 }}>Top Producers for the last 30 Days</Text>
            </div>

            {/* Podium Section */}
            <Row justify="center" align="bottom" gutter={24} style={{ marginBottom: 60, minHeight: 320 }}>
                {podiumData.map((op, index) => (
                    op && (
                        <Col key={op.name} span={6} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <div style={{ marginBottom: 16, position: 'relative' }}>
                                <Avatar
                                    size={op.rank === 0 ? 100 : op.rank === 1 ? 80 : 70}
                                    style={{ backgroundColor: getRankColor(op.rank), border: '4px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    icon={<UserOutlined />}
                                />
                                <div style={{
                                    position: 'absolute', top: -15, right: -10,
                                    backgroundColor: getRankColor(op.rank),
                                    borderRadius: '50%', padding: 8,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                                }}>
                                    {getRankIcon(op.rank)}
                                </div>
                            </div>
                            <Card
                                bordered={false}
                                style={{
                                    width: '100%',
                                    borderRadius: '12px 12px 0 0',
                                    borderTop: `6px solid ${getRankColor(op.rank)}`,
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                                    height: op.rank === 0 ? 220 : op.rank === 1 ? 190 : 160
                                }}
                            >
                                <Title level={3} style={{ marginBottom: 0 }}>{op.name}</Title>
                                <div style={{ fontSize: 32, fontWeight: 'bold', color: BRAND_BLUE, margin: '16px 0' }}>
                                    {op.total_produced?.toLocaleString()}
                                </div>
                                <Text type="secondary">Parts Produced</Text>
                            </Card>
                        </Col>
                    )
                ))}
            </Row>

            {/* Stats Row */}
            <Row gutter={[24, 24]}>
                <Col xs={24} lg={16}>
                    <Card title="Detailed Rankings" bordered={false} style={{ borderRadius: 12 }}>
                        <Table
                            dataSource={operators}
                            rowKey="name"
                            pagination={{ pageSize: 10 }}
                            columns={[
                                {
                                    title: 'Rank',
                                    key: 'rank',
                                    width: 80,
                                    render: (_, __, index) => {
                                        if (index < 3) return <Badge count={index + 1} style={{ backgroundColor: getRankColor(index) }} />;
                                        return <span style={{ paddingLeft: 8, color: '#999' }}>#{index + 1}</span>;
                                    }
                                },
                                {
                                    title: 'Operator',
                                    dataIndex: 'name',
                                    key: 'name',
                                    render: (name) => <Text strong>{name}</Text>
                                },
                                {
                                    title: 'Volume',
                                    dataIndex: 'total_produced',
                                    key: 'total',
                                    sorter: (a, b) => a.total_produced - b.total_produced,
                                    defaultSortOrder: 'descend',
                                    render: (val) => <Text style={{ fontSize: 16 }}>{val?.toLocaleString()}</Text>
                                },
                                {
                                    title: 'Quality',
                                    dataIndex: 'total_good',
                                    key: 'good',
                                    render: (val, r) => (
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <Text type="success">{val?.toLocaleString()} Good</Text>
                                            <Text type="secondary" style={{ fontSize: 11 }}>
                                                {((r.total_good / (r.total_produced || 1)) * 100).toFixed(1)}% Yield
                                            </Text>
                                        </div>
                                    )
                                },
                                {
                                    title: 'OEE Score',
                                    dataIndex: 'oee',
                                    key: 'oee',
                                    render: (val) => <Text strong style={{ color: val >= 0.85 ? '#52c41a' : '#faad14' }}>{(val * 100).toFixed(0)}%</Text>
                                }
                            ]}
                        />
                    </Card>
                </Col>
                <Col xs={24} lg={8}>
                    <Card title="Production Distribution" bordered={false} style={{ borderRadius: 12 }}>
                        <div style={{ height: 400 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={operators.slice(0, 10)} layout="vertical">
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Bar dataKey="total_produced" fill={BRAND_BLUE} radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default Leaderboard;
