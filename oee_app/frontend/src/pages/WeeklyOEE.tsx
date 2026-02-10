import React, { useState, useEffect } from 'react';
import {
    Layout,
    Typography,
    Card,
    Row,
    Col,
    DatePicker,
    Select,
    Table,
    Statistic,
    Tooltip,
    Alert,
    Button
} from 'antd';
import {
    InfoCircleOutlined,
    BarChartOutlined,
    LineChartOutlined,
    QuestionCircleOutlined,
    DownloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { analyticsService } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const WeeklyOEE: React.FC = () => {
    // State
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().startOf('week'),
        dayjs().endOf('week')
    ]);
    const [shift, setShift] = useState<string>('All');
    const [loading, setLoading] = useState<boolean>(false);
    const [data, setData] = useState<any>(null);

    // Fetch Data
    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await analyticsService.getWeeklySummary(
                dateRange[0].format('YYYY-MM-DD'),
                dateRange[1].format('YYYY-MM-DD'),
                shift
            );
            setData(result);
        } catch (error) {
            console.error("Failed to fetch weekly summary", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [dateRange, shift]);

    // Columns for Operator Table
    const columns = [
        {
            title: 'Operator',
            dataIndex: 'operator',
            key: 'operator',
            render: (text: string) => <Text strong>{text}</Text>,
            sorter: (a: any, b: any) => a.operator.localeCompare(b.operator),
        },
        {
            title: 'Weighted OEE',
            dataIndex: 'weighted_oee',
            key: 'weighted_oee',
            render: (val: number) => (
                <Text type={val < 65 ? 'danger' : val > 85 ? 'success' : undefined}>
                    {(val * 100).toFixed(1)}%
                </Text>
            ),
            sorter: (a: any, b: any) => a.weighted_oee - b.weighted_oee,
            defaultSortOrder: 'descend' as const,
        },
        {
            title: 'Simple Avg OEE',
            dataIndex: 'simple_oee',
            key: 'simple_oee',
            render: (val: number) => `${(val * 100).toFixed(1)}%`,
            sorter: (a: any, b: any) => a.simple_oee - b.simple_oee,
        },
        {
            title: 'Contribution',
            dataIndex: 'contribution_pct',
            key: 'contribution_pct',
            render: (val: number) => <Text>{val.toFixed(1)}%</Text>,
            sorter: (a: any, b: any) => a.contribution_pct - b.contribution_pct,
        },
        {
            title: 'Total Parts',
            dataIndex: 'total_parts',
            key: 'total_parts',
            sorter: (a: any, b: any) => a.total_parts - b.total_parts,
        },
        {
            title: 'Run Time (min)',
            dataIndex: 'total_run_time',
            key: 'total_run_time',
            render: (val: number) => val.toFixed(0),
        },
        {
            title: 'Shifts',
            dataIndex: 'shift_count',
            key: 'shift_count',
        },
    ];

    return (
        <div style={{ padding: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>
                        <BarChartOutlined /> Weekly OEE Analysis
                    </Title>
                    <Text type="secondary">Weighted averages based on production volume</Text>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                    <Select
                        value={shift}
                        onChange={setShift}
                        style={{ width: 120 }}
                    >
                        <Option value="All">All Shifts</Option>
                        <Option value="Day">Day</Option>
                        <Option value="Night">Night</Option>
                    </Select>
                    <RangePicker
                        value={dateRange}
                        onChange={(dates) => {
                            if (dates && dates[0] && dates[1]) {
                                setDateRange([dates[0], dates[1]]);
                            }
                        }}
                    />
                    <Button
                        icon={<DownloadOutlined />}
                        onClick={() => window.print()}
                    >
                        Export
                    </Button>
                </div>
            </div>

            {/* Educational Alert */}
            <Alert
                message="Why Weighted Average?"
                description="Simple averages can be misleading. A shift producing 10 parts at 100% OEE shouldn't carry the same weight as a shift producing 10,000 parts at 50% OEE. Weighted OEE accounts for volume, giving you a truer picture of overall efficiency."
                type="info"
                showIcon
                closable
                style={{ marginBottom: 24 }}
            />

            {/* KPI Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={6}>
                    <Card bordered={false} style={{ height: '100%', textAlign: 'left' }}> {/* Explicit Left Align */}
                        <Statistic
                            title={
                                <Tooltip title="Sum(OEE * Parts) / Total Parts">
                                    Weighted OEE <QuestionCircleOutlined />
                                </Tooltip>
                            }
                            value={data?.overall?.weighted_oee * 100}
                            precision={1}
                            suffix="%"
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={6}>
                    <Card bordered={false} style={{ height: '100%', textAlign: 'left' }}>
                        <Statistic
                            title={<Text type="secondary">Simple Average (Legacy)</Text>}
                            value={data?.overall?.simple_oee * 100}
                            precision={1}
                            suffix="%"
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={6}>
                    <Card bordered={false} style={{ height: '100%', textAlign: 'left' }}>
                        <Statistic
                            title="Total Parts Produced"
                            value={data?.overall?.total_parts}
                            groupSeparator=","
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={6}>
                    <Card bordered={false} style={{ height: '100%', textAlign: 'left' }}>
                        <Statistic
                            title="Total Run Time (Min)"
                            value={data?.overall?.total_run_time}
                            groupSeparator=","
                            precision={0}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Trend Chart */}
            <Card title={<><LineChartOutlined /> Weekly Trend: Weighted vs Simple</>} style={{ marginBottom: 24 }}>
                <div style={{ height: 350, width: '100%' }}>
                    <ResponsiveContainer>
                        <LineChart data={data?.daily_trend || []} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis domain={[0, 1]} tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} />
                            <RechartsTooltip formatter={(val: number) => `${(val * 100).toFixed(1)}%`} />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="weighted_oee"
                                name="Weighted OEE"
                                stroke="#1890ff"
                                strokeWidth={3}
                                activeDot={{ r: 8 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="simple_oee"
                                name="Simple Avg"
                                stroke="#ff4d4f"
                                strokeDasharray="5 5"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Operator Breakdown Table */}
            <Card title="Operator Efficiency Breakdown (Weighted)" bordered={false}>
                <Table
                    columns={columns}
                    dataSource={data?.operators}
                    rowKey="operator"
                    loading={loading}
                    pagination={{ pageSize: 20 }}
                />
            </Card>
        </div>
    );
};

export default WeeklyOEE;
