import React, { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, Typography, Select, Table, Tabs, Spin, Alert, Empty, DatePicker, Button, Space, message, Modal, Divider, Statistic } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { PrinterOutlined, DownloadOutlined, FilePdfOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { analyticsService } from '../services/api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

// Vibracoustic Brand Colors
const BRAND_BLUE = '#003366';

const Analytics: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [shiftData, setShiftData] = useState<any[]>([]);
    const [qualityData, setQualityData] = useState<any[]>([]);
    const [partData, setPartData] = useState<any[]>([]);
    const [downtimeData, setDowntimeData] = useState<any[]>([]);
    const [dateRange, setDateRange] = useState<any>([dayjs().subtract(30, 'days'), dayjs()]);

    // New State for Operator Analysis
    const [operators, setOperators] = useState<string[]>([]);
    const [partsList, setPartsList] = useState<string[]>([]);
    const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
    const [selectedPart, setSelectedPart] = useState<string | null>(null);
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [comparisonData, setComparisonData] = useState<any>(null);

    // Report Modal
    const [isReportOpen, setIsReportOpen] = useState(false);

    useEffect(() => {
        fetchAllData();
    }, [dateRange]);

    const loadDropdowns = async () => {
        try {
            const ops = await analyticsService.getComparison('operator');
            setOperators(ops.map((o: any) => o.name).filter(Boolean).sort());

            const pts = await analyticsService.getComparison('part');
            setPartsList(pts.map((p: any) => p.name).filter(Boolean).sort());
        } catch (error) {
            console.error(error);
        }
    };

    const fetchHistory = async (op: string) => {
        if (!op) return;
        try {
            const start = dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined;
            const end = dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined;
            const data = await analyticsService.getHistory({
                operator: op,
                start_date: start,
                end_date: end,
                limit: 500
            });
            setHistoryData(data);
        } catch (error) {
            message.error("Failed to load history");
        }
    };

    const fetchPartComparison = async (part: string) => {
        if (!part) return;
        try {
            const start = dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined;
            const end = dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined;
            const data = await analyticsService.getPartPerformance(part, start, end);
            setComparisonData(data);
        } catch (error) {
            message.error("Failed to load comparison");
        }
    };

    const fetchAllData = async () => {
        setLoading(true);
        const startDate = dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined;
        const endDate = dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined;

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
        // window.print(); // Old method
        setIsReportOpen(true);
    };

    // Explicit trigger for react-to-print inside modal
    // Note: In a real app we might install 'react-to-print', but here we can just use window.print with a specific CSS media query
    // For simplicity without adding dependencies, we'll use a CSS-based Print approach on the Modal content.
    const printContent = () => {
        const content = document.getElementById('printable-report');
        if (content) {
            const pri = (document.getElementById('ifmcontentstoprint') as HTMLIFrameElement).contentWindow;
            if (pri) {
                pri.document.open();
                pri.document.write(content.innerHTML);
                pri.document.close();
                pri.focus();
                pri.print();
            } else {
                // Fallback
                const originalContents = document.body.innerHTML;
                document.body.innerHTML = content.innerHTML;
                window.print();
                document.body.innerHTML = originalContents;
                window.location.reload(); // Reload to restore event listeners
            }
        }
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

    return (
        <div style={{ padding: '24px' }}>
            {/* Styles for Printing - Hides everything except the report when printing */}
            <style>
                {`
                    @media print {
                        body * { visibility: hidden; }
                        #printable-section, #printable-section * { visibility: visible; }
                        #printable-section { position: absolute; left: 0; top: 0; width: 100%; }
                        .no-print { display: none !important; }
                    }
                `}
            </style>

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

                <TabPane tab="Operator Analysis" key="operator">
                    <Tabs type="line">
                        <TabPane tab="Operator History" key="op-history">
                            <Card title="Operator Daily History" bordered={false}>
                                <div style={{ marginBottom: 16 }}>
                                    <Text strong>Select Operator: </Text>
                                    <Select
                                        showSearch
                                        style={{ width: 300, marginLeft: 8 }}
                                        placeholder="Search operator..."
                                        optionFilterProp="children"
                                        onDropdownVisibleChange={(open) => {
                                            if (open && operators.length === 0) loadDropdowns();
                                        }}
                                        value={selectedOperator}
                                        onChange={(val) => { setSelectedOperator(val); fetchHistory(val); }}
                                    >
                                        {operators.map(op => <Select.Option key={op} value={op}>{op}</Select.Option>)}
                                    </Select>
                                </div>
                                <Table
                                    dataSource={historyData}
                                    columns={[
                                        { title: 'Date', dataIndex: 'date', key: 'date', render: (d: string) => dayjs(d).format('MM/DD/YYYY') },
                                        { title: 'Machine', dataIndex: 'machine', key: 'machine' },
                                        { title: 'Part', dataIndex: 'part_number', key: 'part_number' },
                                        { title: 'Shift', dataIndex: 'shift', key: 'shift' },
                                        { title: 'OEE', dataIndex: 'oee', key: 'oee', render: (val: number) => <Tag color={val >= 0.85 ? 'green' : val >= 0.6 ? 'orange' : 'red'}>{(val * 100).toFixed(1)}%</Tag> },
                                    ]}
                                    rowKey="id"
                                    pagination={{ pageSize: 20 }}
                                />
                            </Card>
                        </TabPane>
                        <TabPane tab="Peer Comparison" key="op-peer">
                            <Card title="Operator Performance vs Part Average" bordered={false}>
                                <Alert message="Select a part to see how different operators compare against the running average." type="info" showIcon style={{ marginBottom: 16 }} />
                                <div style={{ marginBottom: 16 }}>
                                    <Text strong>Select Part: </Text>
                                    <Select
                                        showSearch
                                        style={{ width: 300, marginLeft: 8 }}
                                        placeholder="Search part..."
                                        optionFilterProp="children"
                                        onDropdownVisibleChange={(open) => {
                                            if (open && partsList.length === 0) loadDropdowns();
                                        }}
                                        value={selectedPart}
                                        onChange={(val) => { setSelectedPart(val); fetchPartComparison(val); }}
                                    >
                                        {partsList.map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}
                                    </Select>
                                </div>
                                {comparisonData && (
                                    <>
                                        <Row gutter={16} style={{ marginBottom: 24 }}>
                                            <Col span={8}>
                                                <Statistic title="Global Average OEE" value={comparisonData.global_average_oee * 100} precision={1} suffix="%" />
                                            </Col>
                                            <Col span={8}>
                                                <Statistic title="Total Runs Analyzed" value={comparisonData.total_runs} />
                                            </Col>
                                        </Row>
                                        <div style={{ height: 400 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={comparisonData.operators}
                                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                                    layout="horizontal"
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="operator" />
                                                    <YAxis unit="%" domain={[0, 100]} />
                                                    <Tooltip formatter={(val: number) => [(val * 100).toFixed(1) + '%', 'Avg OEE']} />
                                                    <Legend />
                                                    <ReferenceLine y={comparisonData.global_average_oee} stroke="red" strokeDasharray="3 3" label="Global Avg" isFront />
                                                    <Bar dataKey="average_oee" fill="#1890ff" name="Operator Average OEE" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                )}
                            </Card>
                        </TabPane>
                    </Tabs>
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
                    <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={triggerBrowserPrint}>Print / Save PDF</Button>
                ]}
            >
                <div id="printable-section" style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                        <Title level={3} style={{ color: BRAND_BLUE }}>Vibracoustic Executive Summary</Title>
                        <Text type="secondary">Generated on {dayjs().format('MMMM D, YYYY')}</Text>
                        <br />
                        <Text strong>Period: {dateRange[0].format('MMM D')} - {dateRange[1].format('MMM D, YYYY')}</Text>
                    </div>

                    <Divider orientation="left">Production Overview</Divider>
                    <Row gutter={16} style={{ textAlign: 'center' }}>
                        {/* Simple Average of Shifts for Headline */}
                        <Col span={6}><Statistic title="Avg OEE" value={shiftData.reduce((acc, c) => acc + c.oee, 0) / (shiftData.length || 1) * 100} precision={1} suffix="%" /></Col>
                        <Col span={6}><Statistic title="Total Downtime" value={downtimeData.reduce((acc, c) => acc + c.total_downtime, 0)} suffix=" min" /></Col>
                        <Col span={6}><Statistic title="Reject Rate" value={qualityData.reduce((acc, c) => acc + c.reject_rate, 0) / (qualityData.length || 1)} precision={1} suffix="%" /></Col>
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
                            { title: 'Minutes Lost', dataIndex: 'total_downtime' }
                        ]}
                        pagination={false}
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
            </Modal>
        </div>
    );
};

export default Analytics;
