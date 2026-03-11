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
    BulbOutlined,
    FilterOutlined,
    CompressOutlined,
    UserSwitchOutlined
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
        version: "v1.6.1",
        date: "2026-03-10",
        description: (
            <ul>
                <li><strong>Non-Compact Print — Full Stats for All Employees:</strong> Fixed the non-compact print mode to display the full rich dashboard layout (operator, part/machine/date/shift, run/down times, performance, quality, actual vs target, OEE score, and analysis insight tags) for every employee — not just the first page. All operators now print across as many pages as needed.</li>
                <li><strong>Production Board Auto-Suggest Fix:</strong> Resolved a bug where the operator auto-suggest would briefly appear then collapse when selecting a part number. Root cause was an unstable <code>assignedOperators</code> dependency that re-triggered the suggestion on every state change. Stabilized with ref tracking and a serialized dependency key.</li>
                <li><strong>Auto-Apply Best Performer:</strong> The operator auto-suggest now automatically populates the best available operator when a part is selected (instead of requiring a manual "Apply" click). The suggestion still shows as informational if an operator was already manually assigned.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 1.5,
        icon: <PrinterOutlined />,
        color: "blue",
        tags: ["Bug Fix", "Print", "Production Board"]
    },
    {
        version: "v1.6.0",
        date: "2026-03-05",
        description: (
            <ul>
                <li><strong>User Login System:</strong> Implemented role-based authentication with Admin and Manager roles, secure JWT tokens, and a login page to protect sensitive operations like rate editing and report uploads.</li>
                <li><strong>Report Upload Fix:</strong> Resolved a <code>ForeignKeyViolation</code> crash that prevented production reports from being uploaded. The backend was hardcoding a non-existent user ID — now correctly allows uploads without requiring a linked user.</li>
                <li><strong>Rate Editing Fix:</strong> Fixed a 500 Server Error when managers tried to save rate changes. A deprecated Pydantic field iteration (<code>RateEntry.__fields__</code>) was replaced with a stable dictionary-based update method.</li>
                <li><strong>Database Recovery:</strong> Recovered full database schema and production data after an accidental deletion, restoring all historical reports and rate configurations.</li>
                <li><strong>Codebase Audit:</strong> Secured the <code>SECRET_KEY</code> by moving it to environment variables, removed debug endpoints, and cleaned up redundant code paths.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 4,
        icon: <SafetyCertificateOutlined />,
        color: "red",
        tags: ["Security", "Critical Fix", "Backend"]
    },
    {
        version: "v1.5.0",
        date: "2026-02-21",
        description: (
            <ul>
                <li><strong>Smart Operator Suggestions:</strong> Backend now returns a ranked list of ALL operators scored by OEE × Quality × Experience from both <code>oeemetric</code> and <code>reportentry</code> tables. Frontend filters by shift roster and availability to suggest the best unassigned operator per machine.</li>
                <li><strong>Per-Shift Operator Persistence:</strong> Each shift (1st, 2nd, 3rd) now stores its own operator assignments independently. Switching shifts swaps to that shift's saved operators — parts and machine status remain shared across all shifts.</li>
                <li><strong>Fuzzy Name Matching:</strong> Operator suggestion now handles database names like "3415 Spencer,Vangie" and matches them to roster names like "Vangie Spencer" using ID stripping, Last/First flipping, and last-name fallback.</li>
                <li><strong>Clear Operators Button:</strong> New "Clear Operators" button in each category header (with confirmation) — clears all operator assignments for the current shift while keeping parts intact. Perfect for shift changeover.</li>
                <li><strong>1st Shift Rename:</strong> "Day Shift" renamed to "1st Shift" across the entire application with automatic migration of existing data.</li>
                <li><strong>OEE Display Fix:</strong> Operator suggestion tooltip now correctly shows OEE as a percentage (e.g., 100.7%) instead of raw decimal (1.0068%).</li>
                <li><strong>Settings Collapsed:</strong> Settings page accordion sections now start collapsed by default for a cleaner initial view.</li>
                <li><strong>Full-Stats Print Mode:</strong> When "Compact Print" is toggled OFF, printing the dashboard now includes the full Activity Log cards with Run/Down, Performance, Quality, and Actual vs Target stats for every operator.</li>
                <li><strong>Part Dropdown Cleanup:</strong> Removed "History" and "Manual" tags from the Part Running dropdown for a cleaner look.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 7,
        icon: <UserSwitchOutlined />,
        color: "green",
        tags: ["Feature", "Production Board", "Intelligence"]
    },
    {
        version: "v1.4.0",
        date: "2026-02-21",
        description: (
            <ul>
                <li><strong>Board Compaction:</strong> Optimized padding and metrics on the Production Board, fitting more machines on a single screen without scrolling.</li>
                <li><strong>Grid Layout Stability:</strong> Converted the reactive flex layout to a dynamic but fixed column model (3-3-2) to prevent machine cards from wrapping unexpectedly.</li>
                <li><strong>Feature Toggle:</strong> Removed the Shift Notes sidebar panel entirely to favor horizontal width for machine cards.</li>
                <li><strong>Drag-and-Drop Structure:</strong> Added `dnd-kit` implementation allowing managers to freely re-order machine cards within their respective category columns while in Edit Mode.</li>
                <li><strong>UI Polish:</strong> Applied shadow lifts to category columns, immersive background gradients, and prevented component overflow rendering issues on smaller monitors.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 4,
        icon: <CompressOutlined />,
        color: "blue",
        tags: ["UX", "Feature", "Layout"]
    },
    {
        version: "v1.3.0",
        date: "2026-02-18",
        description: (
            <ul>
                <li><strong>Run Modes:</strong> Added support for different operating contexts (Standard, Combo, Team) to allow dynamic rate targets based on staffing levels.</li>
                <li><strong>Auto-Migration:</strong> Implemented robust startup database migration to automatically handle schema updates for new features.</li>
                <li><strong>Deployment Stability:</strong> Fixed static asset path resolution issues ensuring reliable production builds.</li>
                <li><strong>Cleanup:</strong> Removed "Weekly OEE" module to streamline dashboard navigation.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 5,
        icon: <RocketOutlined />,
        color: "green",
        tags: ["Feature", "Backend", "Fix"]
    },
    {
        version: "v1.2.0",
        date: "2026-02-13",
        description: (
            <ul>
                <li><strong>Shift Filter (Analytics):</strong> Multi-select shift filter on the Analytics page — filter all charts, tables, KPIs, and exports by Shift 1, 2, 3.  Empty selection defaults to "All Shifts."</li>
                <li><strong>Auto-Recalc Hardening:</strong> Rate-change recalculation now uses per-report transactions, structured logging (<code>[RECALC]</code>), and gated triggers so only rate-impacting field changes fire recalcs.</li>
                <li><strong>Condensed Dashboard Print:</strong> New "Compact Print Mode" toggle (default ON) renders a full-operator print table, hides sparkline charts and sidebar insights, and uses dense 10px rows with repeated headers across pages.</li>
                <li><strong>Version Consolidation:</strong> Merged interim releases into a single v1.1.4 entry and updated API version string.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 6,
        icon: <RocketOutlined />,
        color: "blue",
        tags: ["Release", "Analytics", "Print"]
    },
    {
        version: "v1.1.4",
        date: "2026-02-13",
        description: (
            <ul>
                <li><strong>Critical Fix:</strong> Resolved upload errors by repairing missing database columns (`downtime_events`) and fixing NaN data serialization.</li>
                <li><strong>Dashboard Fix:</strong> Dashboard now correctly identifies the latest report with metrics, preventing zero-data views.</li>
                <li><strong>System Tools:</strong> Added "Fix Database", "Debug Database", and "/recalculate-all" tools for system health.</li>
                <li><strong>Robustness:</strong> Enhanced upload handling to gracefully manage empty/null values without crashing.</li>
            </ul>
        ),
        author: "Dev Team",
        hours: 7,
        icon: <RocketOutlined />,
        color: "green",
        tags: ["Release", "Critical Fixes"]
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
                    <Text type="secondary" style={{ fontSize: 12 }}>Vibracoustic OEE Analytics Platform • v1.6.0</Text>
                </div>
            </div>
        </div>
    );
};

export default VersionHistory;
