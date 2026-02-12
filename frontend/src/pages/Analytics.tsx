import React, { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, Typography, Select, Table, Tabs, Spin, Alert, Empty, DatePicker, Button, Space, message, Modal, Divider, Statistic, Tag } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { PrinterOutlined, DownloadOutlined, FilePdfOutlined, InfoCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { analyticsService } from '../services/api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

// Vibracoustic Brand Colors
const BRAND_BLUE = '#003366';

// Simple Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 40, background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 8, margin: 20 }}>
                    <Title level={4} type="danger">Something went wrong.</Title>
                    <Text type="secondary">Please retry or report this error:</Text>
                    <pre style={{ marginTop: 10, background: '#fff', padding: 10, borderRadius: 4, overflow: 'auto' }}>
                        {this.state.error?.toString()}
                    </pre>
                    <Button onClick={() => window.location.reload()} style={{ marginTop: 20 }}>Reload Page</Button>
                </div>
            );
        }

        return this.props.children;
    }
}

const AnalyticsContent: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [shiftData, setShiftData] = useState<any[]>([]);
    const [qualityData, setQualityData] = useState<any[]>([]);
    const [partData, setPartData] = useState<any[]>([]);
    const [downtimeData, setDowntimeData] = useState<any[]>([]);
    const [dateRange, setDateRange] = useState<any>([dayjs().subtract(30, 'days'), dayjs()]);

    // Report Modal
    const [isReportOpen, setIsReportOpen] = useState(false);

    useEffect(() => {
        fetchAllData();
    }, [dateRange]);

    const fetchAllData = async () => {
        setLoading(true);
        // Robust null safety for date formats
        const startDate = (dateRange && dateRange[0]) ? dateRange[0].format('YYYY-MM-DD') : undefined;
        const endDate = (dateRange && dateRange[1]) ? dateRange[1].format('YYYY-MM-DD') : undefined;

        try {
            // Parallelize requests for speed, but catch individually to avoid full failure
            const [shifts, quality, parts, downtime] = await Promise.allSettled([
                analyticsService.getComparison('shift', startDate, endDate),
                analyticsService.getQualityAnalysis(10, startDate, endDate),
                analyticsService.getComparison('part', startDate, endDate),
                analyticsService.getDowntimeAnalysis(10, startDate, endDate)
            ]);

            if (shifts.status === 'fulfilled') setShiftData(Array.isArray(shifts.value) ? shifts.value : []);
            if (quality.status === 'fulfilled') setQualityData(Array.isArray(quality.value) ? quality.value : []);
            if (parts.status === 'fulfilled') setPartData(Array.isArray(parts.value) ? parts.value : []);
            if (downtime.status === 'fulfilled') setDowntimeData(Array.isArray(downtime.value) ? downtime.value : []);

        } catch (globalError) {
            console.error("Global fetch error", globalError);
            message.error("Failed to load some analytics data");
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        // window.print(); // Old method
        setIsReportOpen(true);
    };

    // Simplified print handler relying on CSS media queries
    const printContent = () => {
        window.print();
    };

    // Better Approach: Use a dedicated CSS class for "print-only" and "no-print"
    // We will just open the browser print dialog, but style the page so ONLY the report shows.
    const triggerBrowserPrint = () => {
        window.print();
    };

    // Columns
    const shiftColumns = [
        { title: 'Shift', dataIndex: 'name', key: 'name' },
        {
            title: 'OEE',
            dataIndex: 'oee',
            key: 'oee',
            render: (val: number) => <Text strong style={{ color: val >= 0.85 ? '#52c41a' : '#faad14' }}>{(val * 100).toFixed(1)}%</Text>,
            sorter: (a: any, b: any) => a.oee - b.oee
        },
        { title: 'Availability', dataIndex: 'availability', key: 'avail', render: (val: number) => `${(val * 100).toFixed(1)}%` },
        { title: 'Performance', dataIndex: 'performance', key: 'perf', render: (val: number) => `${(val * 100).toFixed(1)}%` },
        { title: 'Quality', dataIndex: 'quality', key: 'qual', render: (val: number) => `${(val * 100).toFixed(1)}%` },
        { title: 'Samples', dataIndex: 'sample_size', key: 'samples' },
    ];

    const partColumns = [
        { title: 'Part Number', dataIndex: 'name', key: 'name', width: 200 },
        {
            title: 'OEE %',
            dataIndex: 'oee',
            key: 'oee',
            render: (text: number) => <span style={{ fontWeight: 'bold', color: text >= 0.85 ? '#52c41a' : '#faad14' }}>{(text * 100).toFixed(1)}%</span>,
            sorter: (a: any, b: any) => a.oee - b.oee
        },
        { title: 'Availability', dataIndex: 'availability', key: 'availability', render: (text: number) => `${(text * 100).toFixed(1)}%` },
        { title: 'Performance', dataIndex: 'performance', key: 'performance', render: (text: number) => `${(text * 100).toFixed(1)}%` },
        { title: 'Quality', dataIndex: 'quality', key: 'quality', render: (text: number) => `${(text * 100).toFixed(1)}%` },
        { title: 'Samples', dataIndex: 'sample_size', key: 'sample_size' },
    ];

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <Spin size="large" tip="Loading Analytics..." />
            </div>
        );
    }

    const avgOEE = shiftData.length > 0
        ? (shiftData.reduce((acc, item) => acc + (item.oee || 0), 0) / shiftData.length) * 100
        : 0;

    const totalDowntime = downtimeData.reduce((acc: number, item: any) => acc + (item.duration || 0), 0);

    // Calculate generic reject rate (1 - Avg Quality)
    const rejectRate = shiftData.length > 0
        ? (1 - (shiftData.reduce((acc, item) => acc + (item.quality || 0), 0) / shiftData.length)) * 100
        : 0;

    return (
        <div style={{ padding: '24px' }}>


            <div className="no-print" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
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
                        type="primary"
                        icon={<FilePdfOutlined />}
                        onClick={() => setIsReportOpen(true)}
                    >
                        Executive Report
                    </Button>
                </Space>
            </div>

            <Tabs defaultActiveKey="shift" type="card" size="large" className="no-print">
                <TabPane tab="Shift Overview" key="shift">
                    <Row gutter={[24, 24]}>
                        <Col span={24}>
                            <Card title="Shift Performance Comparison" bordered={false} style={{ width: '100%', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                <div style={{ height: 350, marginBottom: 24 }}>
                                    {shiftData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={shiftData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                                <Table
                                    dataSource={shiftData}
                                    columns={shiftColumns}
                                    pagination={false}
                                    rowKey="name"
                                    bordered
                                    size="small"
                                />
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
                                            <BarChart data={downtimeData} layout="vertical" margin={{ top: 20, right: 30, left: 100, bottom: 5 }}>
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
                                            { title: 'Parts Lost (Est.)', dataIndex: 'parts_lost', key: 'parts_lost', sorter: (a: any, b: any) => a.parts_lost - b.parts_lost, render: (val: number) => <Text strong type="danger">{val}</Text> },
                                            { title: 'Event Count', dataIndex: 'event_count', key: 'count' },
                                            { title: 'Avg Event (min)', dataIndex: 'avg_event_min', key: 'avg' },
                                            {
                                                title: (
                                                    <Space>
                                                        Downtime Pattern
                                                        <Tooltip title={
                                                            <div style={{ fontSize: '12px' }}>
                                                                <div style={{ marginBottom: '4px' }}><Tag color="orange">Micro-stop</Tag> Avg &lt; 10 min</div>
                                                                <div style={{ marginBottom: '4px' }}><Tag color="blue">Mixed</Tag> Avg 10-45 min</div>
                                                                <div><Tag color="red">Breakdown</Tag> Avg &gt; 45 min</div>
                                                            </div>
                                                        }>
                                                            <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'pointer' }} />
                                                        </Tooltip>
                                                    </Space>
                                                ),
                                                dataIndex: 'pattern',
                                                key: 'pattern',
                                                render: (val: string) => {
                                                    let color = 'default';
                                                    if (val === 'Micro-stop driven') color = 'orange';
                                                    if (val === 'Breakdown driven') color = 'red';
                                                    if (val === 'Mixed') color = 'blue';
                                                    return <Tag color={color}>{val}</Tag>;
                                                }
                                            }
                                        ]}
                                        expandable={{
                                            expandedRowRender: (record) => (
                                                <div style={{ margin: 0 }}>
                                                    <Title level={5}>Downtime Log for {record.machine}</Title>
                                                    <Table
                                                        dataSource={record.details}
                                                        rowKey={(r: any) => `${r.date}-${r.shift}-${r.reason}`}
                                                        pagination={{ pageSize: 5 }}
                                                        size="small"
                                                        columns={[
                                                            { title: 'Date', dataIndex: 'date', key: 'date' },
                                                            { title: 'Shift', dataIndex: 'shift', key: 'shift' },
                                                            { title: 'Part Number', dataIndex: 'part_number', key: 'part' },
                                                            { title: 'Reason', dataIndex: 'reason', key: 'reason', render: (text: string) => <Tag>{text}</Tag> },
                                                            { title: 'Duration (min)', dataIndex: 'minutes', key: 'minutes' }
                                                        ]}
                                                    />
                                                </div>
                                            ),
                                            rowExpandable: (record) => record.details && record.details.length > 0,
                                        }}
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
                                            <BarChart data={qualityData} layout="vertical" margin={{ top: 20, right: 30, left: 100, bottom: 5 }}>
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

            {/* Hidden Printable Section (Only visible in Modal or Print Mode) */}
            <Modal
                title="Executive Report Preview"
                open={isReportOpen}
                onCancel={() => setIsReportOpen(false)}
                width={800}
                footer={[
                    <Button key="close" onClick={() => setIsReportOpen(false)}>Close</Button>,
                    <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={printContent}>Print / Save PDF</Button>
                ]}
            >
                <div id="printable-section" style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
                    {/* Branded Report Header */}
                    <div style={{ marginBottom: 20, borderBottom: `2px solid ${BRAND_BLUE}`, paddingBottom: 15 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '2px solid #003366', paddingBottom: 16 }}>
                            <img src="/logo.png" alt="Company Logo" style={{ height: 120, maxWidth: 'none', paddingLeft: 0 }} />
                            <div style={{ textAlign: 'right' }}>
                                <Title level={2} style={{ margin: 0, color: '#003366', fontSize: 36 }}>Executive Summary</Title>
                                <Text type="secondary" style={{ fontSize: 18 }}>Period: {dateRange?.[0]?.format('MMM D') ?? 'All Time'} - {dateRange?.[1]?.format('MMM D, YYYY') ?? 'Present'}</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: 12 }}>Generated: {dayjs().format('MMMM D, YYYY HH:mm')}</Text>
                            </div>
                        </div>

                        <Row gutter={24} style={{ marginBottom: 32 }}>
                            <Col span={8} style={{ textAlign: 'center' }}>
                                <Statistic
                                    title="Avg OEE"
                                    value={avgOEE}
                                    precision={1}
                                    suffix="%"
                                    valueStyle={{ fontSize: 32, color: avgOEE >= 85 ? '#3f8600' : '#cf1322' }}
                                />
                                <Text type="secondary">Target: 85%</Text>
                            </Col>
                            <Col span={8} style={{ textAlign: 'center' }}>
                                <Statistic
                                    title="Total Downtime"
                                    value={totalDowntime / 60}
                                    precision={1}
                                    suffix=" hrs"
                                    valueStyle={{ fontSize: 32 }}
                                />
                                <Text type="secondary">{totalDowntime.toLocaleString()} minutes</Text>
                            </Col>
                            <Col span={8} style={{ textAlign: 'center' }}>
                                <Statistic
                                    title="Reject Rate"
                                    value={rejectRate}
                                    precision={1}
                                    suffix="%"
                                    valueStyle={{ fontSize: 32 }}
                                />
                            </Col>
                        </Row>

                        <Divider orientation="left">Shift Performance</Divider>
                        <Table
                            dataSource={shiftData}
                            columns={shiftColumns}
                            pagination={false}
                            bordered
                            size="small"
                            rowKey="name"
                        />

                        <Divider orientation="left">Top Downtime Drivers</Divider>
                        <Table
                            dataSource={downtimeData.slice(0, 5)}
                            columns={[
                                { title: 'Machine', dataIndex: 'machine' },
                                {
                                    title: 'Hours Lost',
                                    dataIndex: 'total_downtime',
                                    render: (val: number) => (val / 60).toFixed(1)
                                }
                            ]} pagination={false}
                            size="small"
                            rowKey="machine"
                        />

                        <Divider orientation="left">Quality Alerts (Top Rejects)</Divider>
                        <Table
                            dataSource={qualityData.slice(0, 5)}
                            columns={[
                                { title: 'Part Number', dataIndex: 'part_number' },
                                { title: 'Reject Rate', dataIndex: 'reject_rate', render: (v: number) => `${v}%` }
                            ]}
                            pagination={false}
                            size="small"
                            rowKey="part_number"
                        />

                        <div style={{ marginTop: 40, textAlign: 'center', color: '#999', fontSize: '12px' }}>
                            End of Report - Vibracoustic OEE Analytics
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// Wrapper component
const Analytics: React.FC = () => {
    return (
        <ErrorBoundary>
            <AnalyticsContent />
        </ErrorBoundary>
    );
};

export default Analytics;
