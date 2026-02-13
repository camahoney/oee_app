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
    DatabaseOutlined,
    TeamOutlined,
    BulbOutlined
} from '@ant-design/icons';
import { Divider } from 'antd';
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
        version: "v1.2.0",
        date: "2026-02-13",
        description: (
            <ul>
                <li><strong>Dashboard Fix:</strong> Dashboard now finds the latest report with actual calculated metrics, preventing blank/zero displays.</li>
                <li><strong>Recalculate Tool:</strong> Added /recalculate-all endpoint to fix any orphaned reports missing metrics.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 2,
        icon: <RocketOutlined />,
        color: "green",
        tags: ["Feature", "Critical Fix"]
    },
    {
        version: "v1.1.5",
        date: "2026-02-13",
        description: "Patch: Enhanced upload robustness to handle empty/null downtime event data without crashing.",
        author: "Dev Team",
        hours: 1,
        icon: <BugOutlined />,
        color: "red",
        tags: ["Hotfix", "Backend"]
    },
    {
        version: "v1.1.4",
        date: "2026-02-13",
        description: (
            <ul>
                <li><strong>Critical Fix:</strong> Resolved upload errors by repairing missing database columns (`downtime_events`).</li>
                <li><strong>System Maintenance:</strong> Added "Fix Database" and "Debug Database" tools to the Settings page for self-healing capabilities.</li>
                <li><strong>Transaction Safety:</strong> Improved database migration logic to handle partial updates without crashing.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 2,
        icon: <BugOutlined />,
        color: "red",
        tags: ["Hotfix", "Stability"]
    },
    {
        version: "v1.1.1",
        date: "2026-02-12",
        description: (
            <ul>
                <li><strong>Parts Lost (Est):</strong> New metric to quantify lost production opportunity (Downtime / Cycle Time).</li>
                <li><strong>Interactive Breakdown:</strong> Expandable table rows to view detailed logs of every downtime event per machine.</li>
                <li><strong>Contextual Tooltips:</strong> Added hover explanations for Downtime Patterns (Micro-stop vs Breakdown).</li>
                <li><strong>Quality Personnel Removal:</strong> Excluded specific operators (Shirley Brown, Ison Elliot) from leaderboards as they are quality personnel, not machine operators.</li>
                <li><strong>Downtime Configuration:</strong> Added "High Downtime Threshold" setting to the Settings page.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 2,
        icon: <LineChartOutlined />,
        color: "red",
        tags: ["Analytics", "UX"]
    },
    {
        version: "v1.1.0",
        date: "2026-02-12",
        description: (
            <ul>
                <li><strong>Downtime Patterns:</strong> Automated classification of "Micro-stop" vs "Breakdown" driven machines based on average event length.</li>
                <li><strong>Granular Parsing:</strong> Enhanced parser to extract specific downtime reasons and durations from nested report rows.</li>
                <li><strong>Visual Analytics:</strong> Added new columns for "Avg Event (min)" and color-coded "Pattern" tags in the Downtime Analysis tab.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 4,
        icon: <LineChartOutlined />,
        color: "orange",
        tags: ["Analytics", "Feature"]
    },
    {
        version: "v1.0.0",
        date: "2026-02-11",
        description: (
            <ul>
                <li><strong>Shift Action Log:</strong> specialized sidebar card aggregating shift-specific issues, rate reviews, and recurring downtime for managers.</li>
                <li><strong>Smart Insights:</strong> Automated analysis of production runs to flag "Running Slow," "Quality Slips," and "Perfect Runs."</li>
                <li><strong>Rate Checks:</strong> Global performance comparison to identify if standard rates are set too high or too low.</li>
                <li><strong>Visual Indicators:</strong> Added intuitive icons (🐢, 🚀, 🌟, ⚠️) to the Dashboard activity log for instant troubleshooting.</li>
                <li><strong>Layout Stability:</strong> Fixed critical dashboard rendering bugs and optimized component structure for faster load times.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 6,
        icon: <BulbOutlined />,
        color: "purple",
        tags: ["Major", "AI/Insights"]
    },
    {
        version: "v0.9.5",
        date: "2026-02-10",
        description: (
            <ul>
                <li><strong>Authentication Removal:</strong> Removed login screen and enabled direct dashboard access for streamlined usability.</li>
                <li><strong>Deployment Stability:</strong> Resolved Netlify build errors and fixed database migration order for robust Render deployments.</li>
                <li><strong>KPI Configuration:</strong> Added customizable thresholds for Availability, Performance, and Quality in Settings to drive dashboard gauges.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 4,
        icon: <RocketOutlined />,
        color: "green",
        tags: ["Feature", "Auth", "Fix"]
    },
    {
        version: "v0.9.0",
        date: "2026-02-06",
        description: (
            <ul>
                <li><strong>System Stability:</strong> Implemented global Error Boundaries in Analytics to trap crashes and display helpful debug info instead of white screens.</li>
                <li><strong>UI Redesign:</strong> Complete overhaul of the "Version History" tab with a premium gradient header, shadow cards, and timeline cards.</li>
                <li><strong>Analytics Fixes:</strong> Patched critical null-pointer crash on date range selection.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 4,
        icon: <SafetyCertificateOutlined />,
        color: "blue",
        tags: ["Polish", "Stability"]
    },
    {
        version: "v0.8.0",
        date: "2026-02-06",
        description: (
            <ul>
                <li><strong>Executive Reports:</strong> Developed a branded "Executive Summary" PDF modal with OEE/Downtime/Quality aggregation.</li>
                <li><strong>Print Optimization:</strong> Implemented <code>@media print</code> CSS to clean up UI (hide sidebars/buttons) for professional A4 printing.</li>
                <li><strong>UI Enhancements:</strong> Enlarged dashboard report headers and converted downtime metrics to Hours for readability.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 6,
        icon: <PrinterOutlined />,
        color: "cyan",
        tags: ["Reporting", "UI"]
    },
    {
        version: "v0.7.5",
        date: "2026-02-04",
        description: "Implemented 'Leaderboard Fairness' logic toggles (Volume vs Efficiency) and designed the high-contrast 'Hall of Fame' print poster for shop floor display.",
        author: "Dev Team",
        hours: 5,
        icon: <TrophyOutlined />,
        color: "gold",
        tags: ["Gamification", "Print"]
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
        version: "v0.6.5",
        date: "2026-01-28",
        description: "Optimized Operator Performance page with 'Shift Breakdown' (Day/Night) analysis and 'Part Proficiency' tables.",
        author: "Dev Team",
        hours: 5,
        icon: <TeamOutlined />,
        color: "purple",
        tags: ["Analytics", "Operators"]
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
        color: "geekblue",
        tags: ["Dashboard", "UX"]
    },
    {
        version: "v0.4.5",
        date: "2026-01-18",
        description: "Added CSV/Excel Export functionality for raw production data and fixed 'Add Rate' button button bugs.",
        author: "Dev Team",
        hours: 3,
        icon: <DatabaseOutlined />,
        color: "volcano",
        tags: ["Data", "Export"]
    },
    {
        version: "v0.4.0",
        date: "2026-01-17",
        description: (
            <ul>
                <li><strong>Data Integrity:</strong> Implemented "Day vs Night" shift breakdown logic.</li>
                <li><strong>Permissions:</strong> Hardcoded default Admin User ID for uploads to simplify deployment usage.</li>
                <li><strong>Calc Engine:</strong> Fixed retroactive rate calculation to run in background tasks.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 5,
        icon: <ToolOutlined />,
        color: "red",
        tags: ["Fix", "Backend"]
    },
    {
        version: "v0.3.0",
        date: "2026-01-16",
        description: "Launched 'Shop Floor Leaderboard' with podium visual styles and operator ranking system.",
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
        <div style={{ background: '#f0f2f5', minHeight: '100vh', paddingBottom: 40 }}>
            {/* Premium Header */}
            <div style={{ background: 'linear-gradient(135deg, #001529 0%, #003366 100%)', padding: '40px 24px 80px', color: 'white' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 12 }}>
                            <RocketOutlined style={{ fontSize: 32, color: '#40a9ff' }} />
                        </div>
                        <div>
                            <Title level={1} style={{ color: 'white', margin: 0, fontSize: 32 }}>Version History</Title>
                            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16 }}>Tracking the evolution of the OEE Analytics Platform</Text>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: 1200, margin: '-40px auto 0', padding: '0 24px' }}>
                {/* Stats Cards */}
                <Row gutter={[24, 24]} style={{ marginBottom: 40 }}>
                    <Col xs={24} md={8}>
                        <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', height: '100%' }}>
                            <Statistic
                                title={<Text type="secondary">Project Started</Text>}
                                value="Jan 15, 2026"
                                valueStyle={{ fontWeight: 600, color: '#003366' }}
                                prefix={<SafetyCertificateOutlined style={{ color: '#52c41a' }} />}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} md={8}>
                        <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', height: '100%' }}>
                            <Statistic
                                title={<Text type="secondary">Total Updates</Text>}
                                value={HISTORY_DATA.length}
                                valueStyle={{ fontWeight: 600, color: '#1890ff' }}
                                prefix={<RocketOutlined />}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} md={8}>
                        <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', height: '100%' }}>
                            <Statistic
                                title={<Text type="secondary">System Uptime</Text>}
                                value={timeActive}
                                valueStyle={{ fontWeight: 600, color: '#722ed1' }}
                                prefix={<ClockCircleOutlined />}
                            />
                        </Card>
                    </Col>
                </Row>

                {/* Timeline */}
                <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <div style={{ padding: '24px 0 0' }}>
                        <Timeline mode="left">
                            {HISTORY_DATA.map((item, index) => (
                                <Timeline.Item
                                    key={item.version}
                                    color={item.color}
                                    dot={item.icon}
                                    style={{ paddingBottom: index === HISTORY_DATA.length - 1 ? 0 : 40 }}
                                    label={<div style={{ fontWeight: 500, fontSize: 14, color: '#8c8c8c' }}>{item.date}</div>}
                                >
                                    <div style={{ marginLeft: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                                            <Tag color={item.color} style={{ fontSize: 16, padding: '4px 12px', fontWeight: 600 }}>{item.version}</Tag>
                                            {item.tags?.map(tag => <Tag key={tag} style={{ borderRadius: 12 }}>{tag}</Tag>)}
                                        </div>

                                        <div style={{ background: '#f9f9f9', padding: '16px 20px', borderRadius: 12, borderLeft: `4px solid ${item.color === 'blue' ? '#1890ff' : item.color === 'green' ? '#52c41a' : '#d9d9d9'}` }}>
                                            <div style={{ fontSize: 15, color: '#262626', lineHeight: 1.6 }}>
                                                {typeof item.description === 'string' ? <p style={{ margin: 0 }}>{item.description}</p> : item.description}
                                            </div>

                                            <Divider style={{ margin: '16px 0' }} />

                                            <div style={{ display: 'flex', gap: 24, fontSize: 13, color: '#8c8c8c' }}>
                                                <span><TeamOutlined /> {item.author}</span>
                                                <span><ClockCircleOutlined /> ~{item.hours} hrs effort</span>
                                            </div>
                                        </div>
                                    </div>
                                </Timeline.Item>
                            ))}
                        </Timeline>
                    </div>
                </Card>

                <div style={{ textAlign: 'center', marginTop: 40, color: '#bfbfbf' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Vibracoustic OEE Analytics Platform • v1.0.0</Text>
                </div>
            </div>
        </div>
    );
};

export default VersionHistory;
