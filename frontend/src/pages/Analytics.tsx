import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Select, Table, Tabs, Spin, Alert, Empty, DatePicker, Button, Space, message } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PrinterOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { analyticsService } from '../services/api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

// Vibracoustic Brand Colors
const BRAND_BLUE = '#003366';

const Analytics: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [shiftData, setShiftData] = useState([]);
    const [qualityData, setQualityData] = useState([]);
    const [partData, setPartData] = useState([]);
    const [downtimeData, setDowntimeData] = useState([]);
    const [dateRange, setDateRange] = useState<any>([dayjs().subtract(30, 'days'), dayjs()]);

    useEffect(() => {
        fetchAllData();
    }, [dateRange]);

    const fetchAllData = async () => {
        setLoading(true);
        const startDate = dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined;
        const endDate = dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined;

        // Fetch independently so one failure doesn't break everything
        try {
            const shifts = await analyticsService.getComparison('shift', startDate, endDate);
            setShiftData(shifts);
        } catch (e) { console.error("Shift fetch failed", e); }

        try {
            const quality = await analyticsService.getQualityAnalysis(10, startDate, endDate);
            setQualityData(quality);
        } catch (e) { console.error("Quality fetch failed", e); }

        try {
            const parts = await analyticsService.getComparison('part', startDate, endDate);
            setPartData(parts);
        } catch (e) { console.error("Part fetch failed", e); }

        try {
            const downtime = await analyticsService.getDowntimeAnalysis(10, startDate, endDate);
            setDowntimeData(downtime);
        } catch (e) { console.error("Downtime fetch failed", e); }

        setLoading(false);
    };

    const handlePrint = () => {
        window.print();
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
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <Title level={2} style={{ color: BRAND_BLUE, marginBottom: 0 }}>Advanced Analytics</Title>
                    <Text type="secondary">Deep dive into production trends, downtime, and quality issues.</Text>
                </div>
                <Space>
                    <RangePicker
                        value={dateRange}
                        onChange={(dates) => setDateRange(dates)}
                        style={{ width: 260 }}
                    />
                    <Button
                        icon={<PrinterOutlined />}
                        onClick={handlePrint}
                    >
                        Print Analysis
                    </Button>
                </Space>
            </div>

            <Tabs defaultActiveKey="shift" type="card" size="large">
                <TabPane tab="Shift Overview" key="shift">
                    <Row gutter={[24, 24]}>
                        <Col span={24}>
                            <Card title="Shift Performance Comparison" bordered={false} style={{ width: '100%', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
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
                                    ) : <Empty description="No data for selected range" />}
                                </div>
                            </Card>
                        </Col>
                    </Row>
                </TabPane>

                <TabPane tab="Downtime Analysis" key="downtime">
                    <Row gutter={[24, 24]}>
                        <Col span={24}>
                            <Card title="Top Downtime by Machine (Pareto)" bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                <div style={{ height: 400 }}>
                                    {downtimeData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={downtimeData}
                                                layout="vertical"
                                                margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                <XAxis type="number" />
                                                <YAxis dataKey="machine" type="category" width={100} />
                                                <Tooltip formatter={(val: number) => `${val} min`} />
                                                <Legend />
                                                <Bar dataKey="total_downtime" name="Total Downtime (min)" fill="#ff4d4f" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : <Empty description="No downtime data available" />}
                                </div>
                                <div style={{ marginTop: 24 }}>
                                    <Table
                                        dataSource={downtimeData}
                                        rowKey="machine"
                                        columns={[
                                            { title: 'Machine', dataIndex: 'machine', key: 'machine' },
                                            { title: 'Total Downtime (min)', dataIndex: 'total_downtime', key: 'downtime', sorter: (a: any, b: any) => a.total_downtime - b.total_downtime, defaultSortOrder: 'descend' },
                                            { title: 'Event Count', dataIndex: 'event_count', key: 'count' }
                                        ]}
                                        pagination={false}
                                    />
                                </div>
                            </Card>
                        </Col>
                    </Row>
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

                <TabPane tab="Part Details" key="part">
                    <Card title="Detailed Part Performance" bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <Table
                            dataSource={partData}
                            columns={partColumns}
                            rowKey="name"
                            pagination={{ pageSize: 15 }}
                        />
                    </Card>
                </TabPane>
            </Tabs>
        </div>
    );
};

export default Analytics;
