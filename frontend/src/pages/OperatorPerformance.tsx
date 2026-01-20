import React, { useState, useEffect } from 'react';
import { Card, Select, Table, Row, Col, Statistic, Alert, Typography, Spin, Tag, DatePicker } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
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
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [comparisonData, setComparisonData] = useState<any>(null);
    const [dateRange, setDateRange] = useState<any>([dayjs().subtract(30, 'days'), dayjs()]);

    useEffect(() => {
        loadDropdowns();
    }, []);

    useEffect(() => {
        if (selectedOperator) fetchHistory(selectedOperator);
        if (selectedPart) fetchPartComparison(selectedPart);
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
                {/* Left Column: Individual History */}
                <Col span={24} xl={12}>
                    <Card title="Individual History" bordered={false}>
                        <div style={{ marginBottom: 16 }}>
                            <Text strong>Select Operator: </Text>
                            <Select
                                showSearch
                                style={{ width: 250, marginLeft: 8 }}
                                placeholder="Search operator..."
                                optionFilterProp="children"
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
                                <div style={{ height: 350 }}>
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
                                            <Bar dataKey="average_oee" fill="#1890ff" name="Operator Avg" />
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
