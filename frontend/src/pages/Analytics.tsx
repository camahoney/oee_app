import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Select, Table, Tabs, Spin, Alert, Empty } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { analyticsService } from '../services/api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

// Vibracoustic Brand Colors
const BRAND_BLUE = '#003366';
const BRAND_LIGHT_BLUE = '#e6f7ff';

const Analytics: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [shiftData, setShiftData] = useState([]);
    const [qualityData, setQualityData] = useState([]);
    const [partData, setPartData] = useState([]);

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        // Fetch independently so one failure doesn't break everything
        try {
            const shifts = await analyticsService.getComparison('shift');
            setShiftData(shifts);
        } catch (e) { console.error("Shift fetch failed", e); }

        try {
            const quality = await analyticsService.getQualityAnalysis(10);
            setQualityData(quality);
        } catch (e) { console.error("Quality fetch failed", e); }

        try {
            const parts = await analyticsService.getComparison('part');
            setPartData(parts);
        } catch (e) { console.error("Part fetch failed", e); }

        setLoading(false);
    };

    // Columns for Part Analysis Table
    const partColumns = [
        { title: 'Part Number', dataIndex: 'name', key: 'name', width: 200 },
        {
            title: 'OEE %',
            dataIndex: 'oee',
            key: 'oee',
            render: (text: number) => <span style={{ fontWeight: 'bold', color: text >= 0.85 ? '#52c41a' : '#faad14' }}>{(text * 100).toFixed(1)}%</span>,
            sorter: (a: any, b: any) => a.oee - b.oee
        },
        {
            title: 'Availability',
            dataIndex: 'availability',
            key: 'availability',
            render: (text: number) => `${(text * 100).toFixed(1)}%`
        },
        {
            title: 'Performance',
            dataIndex: 'performance',
            key: 'performance',
            render: (text: number) => `${(text * 100).toFixed(1)}%`
        },
        {
            title: 'Quality',
            dataIndex: 'quality',
            key: 'quality',
            render: (text: number) => `${(text * 100).toFixed(1)}%`
        },
        { title: 'Samples', dataIndex: 'sample_size', key: 'sample_size' },
    ];

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <Spin size="large" tip="Loading Analytics..." />
            </div>
        );
    }

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '24px' }}>
                <Title level={2} style={{ color: BRAND_BLUE, marginBottom: 0 }}>Advanced Analytics</Title>
                <Text type="secondary">Deep dive into production performance, shift comparisons, and quality trends.</Text>
            </div>

            <Tabs defaultActiveKey="shift" type="card" size="large">
                <TabPane tab="Shift Comparison" key="shift">
                    <Row gutter={[24, 24]}>
                        <Col span={24}>
                            <Card title="Shift Performance Overview" bordered={false} style={{ width: '100%', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                <div style={{ height: 400 }}>
                                    {shiftData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={shiftData}
                                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="name" />
                                                <YAxis tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} domain={[0, 1]} />
                                                <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                                                <Legend />
                                                <Bar dataKey="oee" name="OEE" fill={BRAND_BLUE} />
                                                <Bar dataKey="availability" name="Availability" fill="#1890ff" />
                                                <Bar dataKey="performance" name="Performance" fill="#faad14" />
                                                <Bar dataKey="quality" name="Quality" fill="#52c41a" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : <Empty description="No shift data available" />}
                                </div>
                            </Card>
                        </Col>
                    </Row>
                </TabPane>

                <TabPane tab="Part Analysis" key="part">
                    <Card title="Performance by Part Number" bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <Table
                            dataSource={partData}
                            columns={partColumns}
                            rowKey="name"
                            pagination={{ pageSize: 10 }}
                        />
                    </Card>
                </TabPane>

                <TabPane tab="Quality Insights" key="quality">
                    <Row gutter={[24, 24]}>
                        <Col span={24}>
                            <Card title="Top Rejected Parts (Pareto)" bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                <div style={{ height: 400 }}>
                                    {qualityData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={qualityData}
                                                layout="vertical"
                                                margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                <XAxis type="number" />
                                                <YAxis dataKey="part_number" type="category" width={150} />
                                                <Tooltip />
                                                <Legend />
                                                <Bar dataKey="total_rejects" name="Total Rejects" fill="#ff4d4f" />
                                                <Bar dataKey="total_produced" name="Total Produced" fill="#d9d9d9" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : <Empty description="No quality data available" />}
                                </div>
                                <div style={{ marginTop: 24 }}>
                                    <Table
                                        dataSource={qualityData}
                                        rowKey="part_number"
                                        columns={[
                                            { title: 'Part Number', dataIndex: 'part_number', key: 'part' },
                                            { title: 'Total Rejects', dataIndex: 'total_rejects', key: 'rejects', sorter: (a: any, b: any) => a.total_rejects - b.total_rejects, defaultSortOrder: 'descend' },
                                            { title: 'Total Produced', dataIndex: 'total_produced', key: 'total' },
                                            {
                                                title: 'Reject Rate',
                                                dataIndex: 'reject_rate',
                                                key: 'rate',
                                                render: (val: number) => <span style={{ color: val > 5 ? '#ff4d4f' : '#595959', fontWeight: val > 5 ? 'bold' : 'normal' }}>{val}%</span>
                                            }
                                        ]}
                                        pagination={false}
                                    />
                                </div>
                            </Card>
                        </Col>
                    </Row>
                </TabPane>
            </Tabs>
        </div>
    );
};

export default Analytics;
