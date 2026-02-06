import React from 'react';
import { Typography, Timeline, Card, Tag, Divider, Row, Col, Statistic } from 'antd';
import {
    ClockCircleOutlined,
    RocketOutlined,
    ToolOutlined,
    PrinterOutlined,
    LineChartOutlined,
    SafetyCertificateOutlined,
    TrophyOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Paragraph, Text } = Typography;

interface VersionEntry {
    version: string;
    date: string;
    description: string;
    author: string; // "System" or specific developer
    hours: number;
    icon?: React.ReactNode;
    color?: string;
    tags?: string[];
}

const HISTORY_DATA: VersionEntry[] = [
    {
        version: "v0.8.0",
        date: "2025-02-06",
        description: "Added professional print layouts for Dashboard and Analytics. Created 'Executive Summary' PDF report with company logo.",
        author: "Dev Team",
        hours: 3,
        icon: <PrinterOutlined />,
        color: "blue",
        tags: ["Reporting", "UI"]
    },
    {
        version: "v0.7.0",
        date: "2025-01-30",
        description: "Deployment stability improvements. Fixed '404' errors on startup and resolved API system warnings.",
        author: "Dev Team",
        hours: 4,
        icon: <SafetyCertificateOutlined />,
        color: "green",
        tags: ["Stability", "Backend"]
    },
    {
        version: "v0.6.0",
        date: "2025-01-24",
        description: "Introduced 'Weekly OEE' analysis tab. Added weighted averages to correctly calculate weekly performance trends.",
        author: "Dev Team",
        hours: 6,
        icon: <LineChartOutlined />,
        color: "blue",
        tags: ["Analytics", "New Feature"]
    },
    {
        version: "v0.5.0",
        date: "2025-01-20",
        description: "Dashboard 2.0 Enhancements: Added 7-day sparklines, 'Key Strategic Insights' text generation, and rule-based drivers.",
        author: "Dev Team",
        hours: 5,
        icon: <RocketOutlined />,
        color: "purple",
        tags: ["Dashboard", "UX"]
    },
    {
        version: "v0.4.0",
        date: "2025-01-17",
        description: "Critical data fixes: 'Self-Healing' for zero-count reports, default upload permissions, and 'Day vs Night' shift breakdown.",
        author: "Dev Team",
        hours: 4,
        icon: <ToolOutlined />,
        color: "red",
        tags: ["Fix", "Data"]
    },
    {
        version: "v0.3.0",
        date: "2025-01-16",
        description: "Launched 'Shop Floor Leaderboard'. Added fair ranking toggle (Volume vs. Efficiency) and poster print mode.",
        author: "Dev Team",
        hours: 6,
        icon: <TrophyOutlined />,
        color: "gold",
        tags: ["Gamification", "New Feature"]
    },
    {
        version: "v0.2.0",
        date: "2025-01-16",
        description: "Advanced Analytics Module: Added Date Range Picker, Downtime Pareto Charts, and detailed Quality breakdown.",
        author: "Dev Team",
        hours: 6,
        icon: <LineChartOutlined />,
        color: "cyan",
        tags: ["Analytics"]
    },
    {
        version: "v0.1.0",
        date: "2025-01-15",
        description: "Initial Release. Core OEE Dashboard, Excel/CSV Upload, Master Rate Table, and basic Calculation Engine.",
        author: "Dev Team",
        hours: 12,
        icon: <RocketOutlined />,
        color: "green",
        tags: ["Launch"]
    }
];

const VersionHistory: React.FC = () => {
    const totalHours = HISTORY_DATA.reduce((acc, curr) => acc + curr.hours, 0);
    const startDate = dayjs("2025-01-15");
    const daysRunning = dayjs().diff(startDate, 'day');

    return (
        <div style={{ padding: '24px', maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ marginBottom: 32 }}>
                <Title level={2}><ClockCircleOutlined /> Versions & Updates</Title>
                <Paragraph style={{ fontSize: 16, color: '#666' }}>
                    A living log of improvements, fixes, and new features added to the OEE Analytics Dashboard.
                </Paragraph>
            </div>

            <Row gutter={16} style={{ marginBottom: 32 }}>
                <Col span={8}>
                    <Card>
                        <Statistic title="Project Started" value="Jan 15, 2025" prefix={<RocketOutlined />} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic title="Updates Released" value={HISTORY_DATA.length} prefix={<ToolOutlined />} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic title="Days Active" value={daysRunning} prefix={<ClockCircleOutlined />} />
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
                            label={<Text type="secondary">{item.date}</Text>}
                        >
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <Text strong style={{ fontSize: 16 }}>{item.version}</Text>
                                    {item.tags?.map(tag => <Tag key={tag} color={item.color}>{tag}</Tag>)}
                                </div>
                                <Paragraph style={{ margin: 0, color: '#333' }}>
                                    {item.description}
                                </Paragraph>
                                <div style={{ marginTop: 4, fontSize: 12, color: '#888', display: 'flex', gap: 16 }}>
                                    <span><ToolOutlined /> {item.author}</span>
                                    <span><ClockCircleOutlined /> ~{item.hours} hrs</span>
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
