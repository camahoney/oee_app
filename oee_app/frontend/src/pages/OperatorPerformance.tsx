import React, { useState, useEffect } from 'react';
import { Card, Select, Table, Row, Col, Statistic, Alert, Typography, Spin, Tag, DatePicker } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { analyticsService } from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const OperatorPerformance: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [operators, setOperators] = useState<string[]>([]);
    const [partsList, setPartsList] = useState<string[]>([]);
    const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
    const [selectedPart, setSelectedPart] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<any>([dayjs().subtract(30, 'days'), dayjs()]);

    const [breakdownData, setBreakdownData] = useState<any>(null);
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [comparisonData, setComparisonData] = useState<any>(null);


    useEffect(() => {
        loadDropdowns();
    }, []);

    useEffect(() => {
        if (selectedOperator) {
            fetchHistory(selectedOperator);
            fetchBreakdown(selectedOperator);
        }
        if (selectedPart) fetchPartComparison(selectedPart);
    }, [dateRange, selectedOperator, selectedPart]);

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
        setLoading(true);
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
        } finally {
            setLoading(false);
        }
    };

    const fetchBreakdown = async (op: string) => {
        if (!op) return;
        try {
            const start = dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined;
            const end = dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined;
            const data = await analyticsService.getOperatorBreakdown(op, start, end);
            setBreakdownData(data);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchPartComparison = async (part: string) => {
        if (!part) return;
        setLoading(true);
        try {
            const start = dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined;
            const end = dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined;
            const data = await analyticsService.getPartPerformance(part, start, end);
            setComparisonData(data);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>Operator Performance</Title>
                <RangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    allowClear={false}
                />
            </div>

            <Row gutter={[24, 24]}>
                {/* Operator Selection & History */}
                <Col span={24}>
                    <Card bordered={false} style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <Text strong style={{ fontSize: 16 }}>Select Operator to Analyze: </Text>
                            <Select
                                showSearch
                                style={{ width: 300 }}
                                placeholder="Search operator..."
                                optionFilterProp="children"
                                value={selectedOperator}
                                onChange={(val) => { setSelectedOperator(val); }}
                            >
                                {operators.map(op => <Select.Option key={op} value={op}>{op}</Select.Option>)}
                            </Select>
                        </div>
                    </Card>
                </Col>

                {selectedOperator && breakdownData && (
                    <>
                        {/* Shift Comparison */}
                        <Col span={24} md={8}>
                            <Card title="Shift Performance (Day vs Night)" bordered={false} style={{ height: '100%' }}>
                                <div style={{ height: 250 }}>
                                    {breakdownData.shift_performance.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={breakdownData.shift_performance}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="name" />
                                                <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                                                <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                                                <Bar dataKey="oee" fill="#1890ff" name="Avg OEE" label={{ position: 'top', formatter: (v: number) => `${(v * 100).toFixed(0)}%` }} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : <div style={{ textAlign: 'center', marginTop: 100, color: '#ccc' }}>No Shift Data</div>}
                                </div>
                            </Card>
                        </Col>

                        {/* Part Proficiency */}
                        <Col span={24} md={16}>
                            <Card title="Part Proficiency (Top Parts)" bordered={false} style={{ height: '100%' }}>
                                <Table
                                    dataSource={breakdownData.part_performance}
                                    rowKey="name"
                                    size="small"
                                    pagination={{ pageSize: 5 }}
                                    columns={[
                                        { title: 'Part Number', dataIndex: 'name', key: 'name' },
                                        { title: 'Samples', dataIndex: 'samples', key: 'samples' },
                                        {
                                            title: 'Avg OEE',
                                            dataIndex: 'oee',
                                            key: 'oee',
                                            render: (val: number) => (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ width: 100, background: '#f5f5f5', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                                                        <div style={{ width: `${Math.min(val * 100, 100)}%`, background: val >= 0.85 ? '#52c41a' : '#faad14', height: '100%' }} />
                                                    </div>
                                                    <Text>{(val * 100).toFixed(1)}%</Text>
                                                </div>
                                            )
                                        }
                                    ]}
                                />
                            </Card>
                        </Col>
                    </>
                )}

                {/* Left Column: Individual History Table */}
                <Col span={24} xl={12}>
                    <Card title="Detailed History Logs" bordered={false}>
                        <Table
                            dataSource={historyData}
                            columns={[
                                { title: 'Date', dataIndex: 'date', key: 'date', render: (d: string) => dayjs(d).format('MM/DD/YYYY') },
                                { title: 'Machine', dataIndex: 'machine', key: 'machine' },
                                { title: 'Part', dataIndex: 'part_number', key: 'part_number' },
                                {
                                    title: 'OEE',
                                    dataIndex: 'oee',
                                    key: 'oee',
                                    render: (val: number) => (
                                        <Tag color={val >= 0.85 ? 'green' : val >= 0.6 ? 'orange' : 'red'}>
                                            {(val * 100).toFixed(1)}%
                                        </Tag>
                                    )
                                },
                            ]}
                            rowKey="id"
                            loading={loading && !!selectedOperator}
                            pagination={{ pageSize: 10 }}
                            size="small"
                        />
                    </Card>
                </Col>

                {/* Right Column: Peer Comparison */}
                <Col span={24} xl={12}>
                    <Card title="Peer Comparison (By Part)" bordered={false}>
                        <Alert
                            message="Compare how different operators perform on the same part."
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                        <div style={{ marginBottom: 16 }}>
                            <Text strong>Select Part: </Text>
                            <Select
                                showSearch
                                style={{ width: 250, marginLeft: 8 }}
                                placeholder="Search part..."
                                optionFilterProp="children"
                                value={selectedPart}
                                onChange={(val) => { setSelectedPart(val); fetchPartComparison(val); }}
                            >
                                {partsList.map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}
                            </Select>
                        </div>

                        {comparisonData ? (
                            <>
                                <Row gutter={16} style={{ marginBottom: 24, textAlign: 'center' }}>
                                    <Col span={12}>
                                        <Statistic title="Global Avg OEE" value={comparisonData.global_average_oee * 100} precision={1} suffix="%" valueStyle={{ color: '#cf1322' }} />
                                    </Col>
                                    <Col span={12}>
                                        <Statistic title="Total Runs" value={comparisonData.total_runs} />
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
                                            <XAxis type="number" unit="%" domain={[0, 100]} />
                                            <YAxis dataKey="operator" type="category" width={100} />
                                            <Tooltip formatter={(val: number) => [(val * 100).toFixed(1) + '%', 'Avg OEE']} />
                                            <Legend />
                                            <ReferenceLine x={comparisonData.global_average_oee * 100} stroke="red" strokeDasharray="3 3" label="Global Avg" />
                                            <Bar dataKey="average_oee" name="Operator Avg" fill="#1890ff">
                                                {
                                                    comparisonData.operators.map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={entry.average_oee >= comparisonData.global_average_oee ? '#52c41a' : '#faad14'} />
                                                    ))
                                                }
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </>
                        ) : (
                            <div style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                                Select a part to view comparison
                            </div>
                        )}
                    </Card>
                </Col>
            </Row>
        </div>
    );
};


export default OperatorPerformance;
