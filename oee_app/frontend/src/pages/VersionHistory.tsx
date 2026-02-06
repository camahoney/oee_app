import React, { useState, useEffect } from 'react';
import { Typography, Timeline, Card, Tag, Row, Col, Statistic, Tooltip } from 'antd';
import {
    ClockCircleOutlined,
    RocketOutlined,
    ToolOutlined,
    PrinterOutlined,
    LineChartOutlined,
    SafetyCertificateOutlined,
    TrophyOutlined,
    BugOutlined,
    DatabaseOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

const { Title, Paragraph, Text } = Typography;

interface VersionEntry {
    version: string;
    date: string;
    description: React.ReactNode;
    author: string;
    hours: number;
    icon?: React.ReactNode;
    color?: string;
    tags?: string[];
}

const HISTORY_DATA: VersionEntry[] = [
    {
        version: "v0.8.0",
        date: "2026-02-06",
        description: (
            <ul>
                <li><strong>Executive Reports:</strong> Developed a branded "Executive Summary" PDF modal with OEE/Downtime/Quality aggregation.</li>
                <li><strong>Print Optimization:</strong> Implemented <code>@media print</code> CSS to clean up UI (hide sidebars/buttons) for professional A4 printing.</li>
                <li><strong>Version History:</strong> Added this changelog tab to track project evolution.</li>
                <li><strong>UI Enhancements:</strong> Enlarged dashboard report headers and converted downtime metrics to Hours for readability.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 6,
        icon: <PrinterOutlined />,
        color: "blue",
        tags: ["Reporting", "UI", "Feature"]
    },
    {
        version: "v0.7.0",
        date: "2026-01-30",
        description: (
            <ul>
                <li><strong>Deployment Stability:</strong> Fixed 404 errors on the root path and resolved API "regex" deprecation warnings.</li>
                <li><strong>Database Persistence:</strong> Migrated from SQLite to PostgreSQL instructions for production reliability.</li>
                <li><strong>Health Check:</strong> Added <code>/health</code> and root endpoints for Render auto-deploy verification.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 4,
        icon: <SafetyCertificateOutlined />,
        color: "green",
        tags: ["Stability", "Backend"]
    },
    {
        version: "v0.6.0",
        date: "2026-01-24",
        description: (
            <ul>
                <li><strong>Weekly OEE Tab:</strong> New analysis view to track performance week-over-week.</li>
                <li><strong>Weighted Math:</strong> Implemented weighted averages for OEE calculation (sum of parts vs total target) rather than simple arithmetic means.</li>
                <li><strong>Search Fixes:</strong> Updated "Rates" list to sort by newest first.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 6,
        icon: <LineChartOutlined />,
        color: "blue",
        tags: ["Analytics", "New Feature"]
    },
    {
        version: "v0.5.0",
        date: "2026-01-20",
        description: (
            <ul>
                <li><strong>Dashboard 2.0:</strong> Added 7-day sparkline charts to main KPI gauges.</li>
                <li><strong>Smart Insights:</strong> Rule-based text generation (e.g., "Availability is the main loss driver") to assist supervisors.</li>
                <li><strong>Zero-Metric Fix:</strong> "Self-Healing" logic for reports initiating with 0 count to prevent empty gauges.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 8,
        icon: <RocketOutlined />,
        color: "purple",
        tags: ["Dashboard", "UX"]
    },
    {
        version: "v0.4.0",
        date: "2026-01-17",
        description: (
            <ul>
                <li><strong>Data Integrity:</strong> Implemented "Day vs Night" shift breakdown logic.</li>
                <li><strong>Permissions:</strong> Hardcoded default Admin User ID for uploads to simplify deployment usage.</li>
                <li><strong>Exports:</strong> Added CSV/Excel export for raw production data.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 5,
        icon: <DatabaseOutlined />,
        color: "red",
        tags: ["Fix", "Data"]
    },
    {
        version: "v0.3.0",
        date: "2026-01-16",
        description: "Launched 'Shop Floor Leaderboard'. Added fair ranking toggle (Volume vs. Efficiency) and poster print mode.",
        author: "Dev Team",
        hours: 6,
        icon: <TrophyOutlined />,
        color: "gold",
        tags: ["Gamification", "New Feature"]
    },
    {
        version: "v0.2.0",
        date: "2026-01-16",
        description: "Advanced Analytics Module: Added Date Range Picker, Downtime Pareto Charts, and detailed Quality breakdown.",
        author: "Dev Team",
        hours: 6,
        icon: <LineChartOutlined />,
        color: "cyan",
        tags: ["Analytics"]
    },
    {
        version: "v0.1.0",
        date: "2026-01-15",
        description: "Initial Release. Core OEE Dashboard, Excel/CSV Upload, Master Rate Table, and basic Calculation Engine.",
        author: "Dev Team",
        hours: 12,
        icon: <RocketOutlined />,
        color: "green",
        tags: ["Launch"]
    }
];

const VersionHistory: React.FC = () => {
    const [timeActive, setTimeActive] = useState("");
    const startDate = dayjs("2026-01-15");

    useEffect(() => {
        const calculateTime = () => {
            const now = dayjs();
            const diff = dayjs.duration(now.diff(startDate));
            const days = Math.floor(diff.asDays());
            const hours = diff.hours();
            const minutes = diff.minutes();
            setTimeActive(`${days}d ${hours}h ${minutes}m`);
        };

        calculateTime();
        const timer = setInterval(calculateTime, 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);

    return (
        <div style={{ padding: '24px', width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
            <div style={{ marginBottom: 32 }}>
                <Title level={2}><ClockCircleOutlined /> Versions & Updates</Title>
                <Paragraph style={{ fontSize: 16, color: '#666' }}>
                    Tracking the rapid evolution of the OEE Analytics Dashboard.
                </Paragraph>
            </div>

            <Row gutter={16} style={{ marginBottom: 32 }}>
                <Col span={8}>
                    <Card bordered={false} style={{ background: '#f0f5ff' }}>
                        <Statistic
                            title="Project Started"
                            value="Jan 15, 2026"
                            prefix={<RocketOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card bordered={false} style={{ background: '#f6ffed' }}>
                        <Statistic
                            title="Updates Released"
                            value={HISTORY_DATA.length}
                            prefix={<ToolOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card bordered={false} style={{ background: '#fff7e6' }}>
                        <Statistic
                            title="Time Active"
                            value={timeActive}
                            prefix={<ClockCircleOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            <Card title="Update Log" bordered={false} style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}>
                <Timeline mode="left">
                    {HISTORY_DATA.map((item) => (
                        <Timeline.Item
                            key={item.version}
                            color={item.color}
                            dot={item.icon}
                            label={<Text strong style={{ fontSize: 14 }}>{item.date}</Text>}
                        >
                            <div style={{ paddingBottom: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                    <Text strong style={{ fontSize: 18, color: '#1890ff' }}>{item.version}</Text>
                                    {item.tags?.map(tag => <Tag key={tag} color={item.color}>{tag}</Tag>)}
                                </div>

                                <div style={{ fontSize: 15, color: '#444', marginBottom: 8 }}>
                                    {typeof item.description === 'string' ? <p>{item.description}</p> : item.description}
                                </div>

                                <div style={{ fontSize: 12, color: '#888', display: 'flex', gap: 16, background: '#fafafa', padding: '4px 8px', borderRadius: 4, width: 'fit-content' }}>
                                    <Tooltip title="Developer">
                                        <span><ToolOutlined /> {item.author}</span>
                                    </Tooltip>
                                    <Tooltip title="Estimated Effort">
                                        <span><ClockCircleOutlined /> ~{item.hours} hrs</span>
                                    </Tooltip>
                                </div>
                            </div>
                        </Timeline.Item>
                    ))}
                </Timeline>
            </Card>
        </div>
    );
};

export default VersionHistory;
