import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Statistic, List, Tag, Spin, message, Button, Tooltip, Dropdown, Menu } from 'antd';
import { FieldTimeOutlined, ThunderboltOutlined, SafetyCertificateOutlined, ArrowLeftOutlined, WarningOutlined, PrinterOutlined, AppstoreOutlined, BarsOutlined, DownloadOutlined, FileExcelOutlined, FileTextOutlined, DownOutlined } from '@ant-design/icons';
import { AreaChart, Area, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import OeeGauge from '../components/OeeGauge';
import { reportService } from '../services/api';
import { useSearchParams, useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
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

    const handlePrint = () => {
        window.print();
    };

    const handleExport = async (format: 'csv' | 'xlsx') => {
        if (!reportId) return;
        try {
            message.loading({ content: `Exporting ${format.toUpperCase()}...`, key: 'exportMsg' });
            const blob = await reportService.exportReport(Number(reportId), format);

            // Create download link
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `report_${reportId}_export.${format}`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);

            message.success({ content: 'Export successful!', key: 'exportMsg' });
        } catch (error) {
            console.error("Export failed:", error);
            message.error({ content: 'Failed to export report.', key: 'exportMsg' });
        }
    };

    // Helper to format sparkline data
    const getTrendData = (key: string) => {
        if (!stats || !stats.sparkline_data || !stats.sparkline_data[key]) return [];
        return stats.sparkline_data[key].map((val: number, i: number) => ({
            index: i,
            value: val,
            label: stats.sparkline_data.labels ? stats.sparkline_data.labels[i] : ''
        }));
    };

    const exportMenu = (
        <Menu
            items={[
                {
                    key: 'csv',
                    label: 'Export as CSV',
                    icon: <FileTextOutlined />,
                    onClick: () => handleExport('csv')
                },
                {
                    key: 'xlsx',
                    label: 'Export as Excel',
                    icon: <FileExcelOutlined />,
                    onClick: () => handleExport('xlsx')
                }
            ]}
        />
    );

    if (loading) {
        return <div style={{ textAlign: 'center', marginTop: 50 }}><Spin size="large" /></div>;
    }

    if (!stats) {
        return <div>No data available.</div>;
    }

    // Vibracoustic Branding Colors
    const BRAND_BLUE = '#003366';
    // const BRAND_GREY_BLUE = '#8FAABB';

    return (
        <div style={{ padding: '16px 24px', background: '#f0f2f5', minHeight: '100vh' }}>
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    {/* Print Header */}
                    <div className="print-only" style={{ marginBottom: 24, borderBottom: `2px solid ${BRAND_BLUE}`, paddingBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <img src="/logo.png" alt="Vibracoustic Logo" style={{ height: 60 }} />
                            <div style={{ textAlign: 'right' }}>
                                <Title level={3} style={{ margin: 0, color: BRAND_BLUE }}>Production Dashboard Report</Title>
                                <Text>Generated: {new Date().toLocaleString()}</Text>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Title level={2} style={{ marginBottom: 0, color: BRAND_BLUE, fontSize: '28px', lineHeight: '1.2' }}>
                            {reportId ? `Report Details (ID: ${reportId})` : 'Latest Production Report'}
                        </Title>
                        {stats && <Tag color="blue">{stats.report_date || 'No Date'} | {stats.db_row_count || 0} Records</Tag>}
                    </div>
                    <Text type="secondary" style={{ fontSize: '16px' }}>
                        {reportId ? 'Historical Analysis View' : (stats?.report_date ? `Showing data from upload on ${stats.report_date}` : 'Most recent production data')}
                    </Text>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="no-print" style={{ marginRight: '8px' }}>
                        <Button
                            icon={<BarsOutlined />}
                            type={viewMode === 'list' ? 'primary' : 'default'}
                            onClick={() => setViewMode('list')}
                        />
                        <Button
                            icon={<AppstoreOutlined />}
                            type={viewMode === 'grid' ? 'primary' : 'default'}
                            onClick={() => setViewMode('grid')}
                        />
                    </div>
                    {reportId && (
                        <Dropdown overlay={exportMenu} placement="bottomRight" className="no-print">
                            <Button icon={<DownloadOutlined />}>
                                Export <DownOutlined />
                            </Button>
                        </Dropdown>
                    )}
                    <Button
                        icon={<PrinterOutlined />}
                        onClick={handlePrint}
                        size="middle"
                        className="no-print"
                    >
                        Print Report
                    </Button>
                    {reportId && (
                        <Button
                            type="primary"
                            ghost
                            icon={<ArrowLeftOutlined />}
                            onClick={() => navigate('/reports')}
                            size="middle"
                            style={{ borderColor: BRAND_BLUE, color: BRAND_BLUE }}
                            className="no-print"
                        >
                            Back
                        </Button>
                    )}
                </div>
            </div>

            {/* Key Insights Section */}
            {stats && stats.insights && stats.insights.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <Card title="Key Strategic Insights" bordered={false} bodyStyle={{ padding: '12px 24px' }} headStyle={{ color: BRAND_BLUE, fontWeight: 'bold' }}>
                        <List
                            dataSource={stats.insights}
                            split={false}
                            renderItem={(item: any) => (
                                <List.Item style={{ padding: '8px 0', justifyContent: 'flex-start', borderBottom: '1px solid #f0f0f0' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                                        <ThunderboltOutlined style={{ color: '#faad14', fontSize: '16px', marginRight: 12, marginTop: '4px' }} />
                                        <Text style={{ fontSize: '15px' }}>{item}</Text>
                                    </div>
                                </List.Item>
                            )}
                        />
                    </Card>
                </div>
            )}

            <Row gutter={[24, 24]}>
                <Col span={6} xs={24} sm={12} lg={6}>
                    <Card hoverable bordered={false} style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderTop: `4px solid ${BRAND_BLUE}` }}>
                        <OeeGauge title="OEE Score" value={stats.oee} target={stats.targets?.oee} />
                        <div style={{ height: 40, marginTop: 16 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={getTrendData('oee')}>
                                    <Area type="monotone" dataKey="value" stroke={BRAND_BLUE} fill={BRAND_BLUE} fillOpacity={0.1} strokeWidth={2} />
                                    <RechartsTooltip formatter={(val: number) => (val * 100).toFixed(1) + '%'} labelFormatter={() => ''} contentStyle={{ fontSize: 12 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ textAlign: 'center', fontSize: 10, color: '#999' }}>7-Day Trend</div>
                    </Card>
                </Col>
                <Col span={6} xs={24} sm={12} lg={6}>
                    <Card hoverable bordered={false} style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderTop: `4px solid ${BRAND_BLUE}` }}>
                        <OeeGauge title="Availability" value={stats.availability} target={stats.targets?.availability} />
                        <div style={{ height: 40, marginTop: 16 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={getTrendData('availability')}>
                                    <Area type="monotone" dataKey="value" stroke="#52c41a" fill="#52c41a" fillOpacity={0.1} strokeWidth={2} />
                                    <RechartsTooltip formatter={(val: number) => (val * 100).toFixed(1) + '%'} labelFormatter={() => ''} contentStyle={{ fontSize: 12 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ textAlign: 'center', fontSize: 10, color: '#999' }}>7-Day Trend</div>
                    </Card>
                </Col>
                <Col span={6} xs={24} sm={12} lg={6}>
                    <Card hoverable bordered={false} style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderTop: `4px solid ${BRAND_BLUE}` }}>
                        <OeeGauge title="Performance" value={stats.performance} target={stats.targets?.performance} />
                        <div style={{ height: 40, marginTop: 16 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={getTrendData('performance')}>
                                    <Area type="monotone" dataKey="value" stroke="#1890ff" fill="#1890ff" fillOpacity={0.1} strokeWidth={2} />
                                    <RechartsTooltip formatter={(val: number) => (val * 100).toFixed(1) + '%'} labelFormatter={() => ''} contentStyle={{ fontSize: 12 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ textAlign: 'center', fontSize: 10, color: '#999' }}>7-Day Trend</div>
                    </Card>
                </Col>
                <Col span={6} xs={24} sm={12} lg={6}>
                    <Card hoverable bordered={false} style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderTop: `4px solid ${BRAND_BLUE}` }}>
                        <OeeGauge title="Quality" value={stats.quality} target={stats.targets?.quality} />
                        <div style={{ height: 40, marginTop: 16 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={getTrendData('quality')}>
                                    <Area type="monotone" dataKey="value" stroke="#faad14" fill="#faad14" fillOpacity={0.1} strokeWidth={2} />
                                    <RechartsTooltip formatter={(val: number) => (val * 100).toFixed(1) + '%'} labelFormatter={() => ''} contentStyle={{ fontSize: 12 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ textAlign: 'center', fontSize: 10, color: '#999' }}>7-Day Trend</div>
                    </Card>
                </Col>
            </Row>

            <div style={{ marginTop: 32 }}>
                <Card
                    title={<Title level={4} style={{ margin: 0, color: BRAND_BLUE }}>{reportId ? 'Report Activity Log' : 'Recent Activity Log'}</Title>}
                    bordered={false}
                    style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                >
                    <List
                        itemLayout="vertical"
                        size="large"
                        pagination={{
                            pageSize: 10, // Optimized for performance (was 2000)
                            position: 'bottom',
                            showSizeChanger: true
                        }}
                        dataSource={stats.recent_activity || []}
                        renderItem={(item: any) => {
                            // 3. Metric Drivers Logic
                            const metrics = [
                                { name: 'A', val: item.availability || 0, label: 'Availability' },
                                { name: 'P', val: item.performance || 0, label: 'Performance' },
                                { name: 'Q', val: item.quality || 0, label: 'Quality' }
                            ];
                            // Find lowest metric to highlight as the "Driver"
                            const lowest = metrics.reduce((prev, curr) => prev.val < curr.val ? prev : curr);

                            // 2. Target vs Actual Logic
                            const target = item.target_count || 0;
                            const good = item.good_count || 0;
                            const isOnTrack = target > 0 ? (good >= target * 0.9) : true;

                            if (viewMode === 'grid') {
                                return (
                                    <List.Item>
                                        <Card
                                            hoverable
                                            style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', height: '100%' }}
                                            bodyStyle={{ padding: '16px' }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                <div>
                                                    <Text strong style={{ fontSize: '16px', color: BRAND_BLUE }}>{item.operator || 'Unknown Operator'}</Text>
                                                    {item.warning && <Tag color="warning" style={{ marginLeft: '8px', borderRadius: '4px' }}>Missing Rate</Tag>}
                                                    {item.good_count === 0 && <Tag color="default" style={{ marginLeft: '8px' }}>No Production</Tag>}
                                                    <div style={{ fontSize: '12px', color: '#595959', marginTop: '4px' }}>
                                                        {item.part_number} &bull; {item.machine}
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: item.oee > 1.0 ? '#faad14' : BRAND_BLUE }}>
                                                        {(item.oee * 100).toFixed(1)}%
                                                        {item.oee > 1.0 && (
                                                            <Tooltip title="OEE > 100% usually indicates the Rate Standard is too low (easy).">
                                                                <WarningOutlined style={{ fontSize: '14px', marginLeft: '4px', color: '#faad14' }} />
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                    <Text type="secondary" style={{ fontSize: '12px' }}>OEE</Text>
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
                                                <div style={lowest.name === 'A' ? { borderBottom: '2px solid #ff4d4f', paddingBottom: '4px' } : {}}>
                                                    <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Run/Down</Text>
                                                    <div style={{ fontWeight: '600', fontSize: '14px', marginTop: '2px' }}>
                                                        {((item.run_time_min || 0) / 60).toFixed(1)}h / <span style={{ color: item.downtime_min > 30 ? '#ff4d4f' : 'inherit' }}>{(item.downtime_min || 0).toFixed(1)}m</span>
                                                    </div>
                                                </div>
                                                <div style={lowest.name === 'P' ? { borderBottom: '2px solid #ff4d4f', paddingBottom: '4px' } : {}}>
                                                    <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Perf.</Text>
                                                    <div style={{ fontWeight: '600', fontSize: '14px', marginTop: '2px', color: lowest.name === 'P' ? '#ff4d4f' : 'inherit' }}>
                                                        {((item.performance || 0) * 100).toFixed(0)}%
                                                    </div>
                                                </div>
                                                <div style={lowest.name === 'Q' ? { borderBottom: '2px solid #ff4d4f', paddingBottom: '4px' } : {}}>
                                                    <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Qual.</Text>
                                                    <div style={{ fontWeight: '600', fontSize: '14px', marginTop: '2px', color: lowest.name === 'Q' ? '#ff4d4f' : 'inherit' }}>
                                                        {((item.quality || 0) * 100).toFixed(1)}%
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ marginTop: '12px', borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
                                                <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Actual / Target</Text>
                                                <div style={{ fontWeight: '600', fontSize: '14px', marginTop: '2px' }}>
                                                    <span style={{ color: isOnTrack ? '#52c41a' : '#faad14' }}>{item.good_count}</span>
                                                    <span style={{ color: '#bfbfbf', margin: '0 4px' }}>/</span>
                                                    <span>{item.target_count > 0 ? item.target_count : '-'}</span>
                                                    {item.target_count > 0 && item.reject_count > 0 && (
                                                        <span style={{ fontSize: '10px', color: '#ff4d4f', marginLeft: '4px' }}>({item.reject_count} Rejects)</span>
                                                    )}
                                                </div>
                                            </div>
                                        </Card>
                                    </List.Item>
                                );
                            }

                            return (
                                <List.Item
                                    key={item.id}
                                    style={{ padding: '24px 0', borderBottom: '1px solid #f0f0f0' }}
                                    extra={
                                        <div style={{ textAlign: 'right', minWidth: '150px' }}>
                                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: item.oee > 1.0 ? '#faad14' : BRAND_BLUE }}>
                                                {(item.oee * 100).toFixed(1)}%
                                                {item.oee > 1.0 && (
                                                    <Tooltip title="OEE > 100% usually indicates the Rate Standard is too low (easy).">
                                                        <WarningOutlined style={{ fontSize: '16px', marginLeft: '8px', color: '#faad14' }} />
                                                    </Tooltip>
                                                )}
                                            </div>
                                            <Text type="secondary">OEE Score</Text>
                                        </div>
                                    }
                                >
                                    <List.Item.Meta
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '18px', fontWeight: '600', color: BRAND_BLUE }}>{item.operator || 'Unknown Operator'}</span>
                                                {item.warning && <Tag color="warning" style={{ borderRadius: '4px' }}>Missing Rate</Tag>}
                                                {item.good_count === 0 && <Tag color="default">No Production</Tag>}
                                            </div>
                                        }
                                        description={
                                            <div>
                                                <div style={{ fontSize: '14px', marginBottom: '16px', color: '#595959' }}>
                                                    <strong>Part:</strong> {item.part_number} &bull; <strong>Machine:</strong> {item.machine} &bull; <strong>Date:</strong> {item.date} &bull; <strong>Shift:</strong> {item.shift}
                                                </div>

                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(5, 1fr)',
                                                    gap: '24px',
                                                    maxWidth: '900px'
                                                }}>
                                                    {/* Availability */}
                                                    <div style={lowest.name === 'A' ? { borderBottom: '2px solid #ff4d4f', paddingBottom: '4px' } : {}}>
                                                        <Text type="secondary" style={{ fontSize: '12px', textTransform: 'uppercase' }}>Run / Down</Text>
                                                        <div style={{ fontWeight: '600', fontSize: '16px', marginTop: '4px' }}>
                                                            {((item.run_time_min || 0) / 60).toFixed(1)}h / <span style={{ color: item.downtime_min > 30 ? '#ff4d4f' : 'inherit' }}>{(item.downtime_min || 0).toFixed(1)}m</span>
                                                        </div>
                                                    </div>

                                                    {/* Performance */}
                                                    <div style={lowest.name === 'P' ? { borderBottom: '2px solid #ff4d4f', paddingBottom: '4px' } : {}}>
                                                        <Text type="secondary" style={{ fontSize: '12px', textTransform: 'uppercase' }}>Performance</Text>
                                                        <div style={{ fontWeight: '600', fontSize: '16px', marginTop: '4px', color: lowest.name === 'P' ? '#ff4d4f' : 'inherit' }}>
                                                            {((item.performance || 0) * 100).toFixed(0)}%
                                                        </div>
                                                    </div>

                                                    {/* Quality */}
                                                    <div style={lowest.name === 'Q' ? { borderBottom: '2px solid #ff4d4f', paddingBottom: '4px' } : {}}>
                                                        <Text type="secondary" style={{ fontSize: '12px', textTransform: 'uppercase' }}>Quality</Text>
                                                        <div style={{ fontWeight: '600', fontSize: '16px', marginTop: '4px', color: lowest.name === 'Q' ? '#ff4d4f' : 'inherit' }}>
                                                            {((item.quality || 0) * 100).toFixed(1)}%
                                                        </div>
                                                    </div>

                                                    {/* Actual vs Target */}
                                                    <div style={{ gridColumn: 'span 2' }}>
                                                        <Text type="secondary" style={{ fontSize: '12px', textTransform: 'uppercase' }}>Actual / Target</Text>
                                                        <div style={{ fontWeight: '600', fontSize: '16px', marginTop: '4px' }}>
                                                            <span style={{ color: isOnTrack ? '#52c41a' : '#faad14' }}>{item.good_count}</span>
                                                            <span style={{ color: '#bfbfbf', margin: '0 8px' }}>/</span>
                                                            <span>{item.target_count > 0 ? item.target_count : '-'}</span>
                                                            {item.target_count > 0 && item.reject_count > 0 && (
                                                                <span style={{ fontSize: '12px', color: '#ff4d4f', marginLeft: '8px' }}>({item.reject_count} Rejects)</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    />
                                </List.Item>
                            )
                        }}
                    />
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
