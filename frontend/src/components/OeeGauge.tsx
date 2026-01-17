import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Typography } from 'antd';

const { Text } = Typography;

interface GaugeProps {
    title: string;
    value: number; // 0 to 100 or 0 to 1
    description?: string;
    showPercent?: boolean;
}

const RADIAN = Math.PI / 180;

const OeeGauge: React.FC<GaugeProps> = ({ title, value, description, showPercent = true }) => {
    // Normalize value to 0-100 for gauge calculation, ensuring it doesn't exceed bounds visually
    const displayValue = Math.min(Math.max(value, 0), 100);
    // If value comes in as 0.85, convert to 85. If 85, keep 85. 
    // Usually OEE is 0.0 to 1.0 in backend, but dashboard often converts. 
    // Let's assume input is 0-100 based on usage in dashboard cards (e.g. 53.9)

    // Gauge Data (Zones)
    const data = [
        { name: 'Poor', value: 65, color: '#ff4d4f' },    // Red 0-65
        { name: 'Average', value: 20, color: '#faad14' }, // Yellow 65-85
        { name: 'Good', value: 15, color: '#52c41a' },    // Green 85-100
    ];

    // Needle Calculation
    const cx = 50;
    const cy = 50; // Center in % (relative to container) - but SVG uses pixels. Recharts ResponsiveContainer handles this?
    // Actually Recharts needs absolute pixels for needle math usually, OR we use the Pie's internal center.
    // Easier approach: Use a second Pie for the needle? No, use a custom function pointer.

    // Let's rely on cell colors.

    const needleValue = displayValue;
    const total = 100;
    const rotation = 180 * (1 - needleValue / total); // 180 (left) to 0 (right)?
    // Pie starts at 180 (9 o'clock) and goes clockwise to 0 (3 o'clock).
    // Recharts default: 0 is 3 o'clock. 
    // standard OEE gauge: Start 180 (9 oclock), End 0 (3 oclock).
    // Value 0 => Angle 180. Value 100 => Angle 0.
    // Angle = 180 - (val / 100) * 180

    const angle = 180 - (needleValue / 100) * 180;

    const renderNeedle = (cx: number, cy: number, iR: number, oR: number, color: string) => {
        const length = oR * 0.8;
        const sin = Math.sin(-RADIAN * angle);
        const cos = Math.cos(-RADIAN * angle);
        const xba = cx + 5 * sin;
        const yba = cy - 5 * cos;
        const xbb = cx - 5 * sin;
        const ybb = cy + 5 * cos;
        const xp = cx + length * cos;
        const yp = cy + length * sin;

        return [
            <circle cx={cx} cy={cy} r={8} fill={color} stroke="none" key="dot" />,
            <path d={`M${xba} ${yba}L${xbb} ${ybb}L${xp} ${yp}Z`} stroke="none" fill={color} key="path" />,
        ];
    };

    return (
        <div style={{ width: '100%', height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', height: '120px' }}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie
                            dataKey="value"
                            startAngle={180}
                            endAngle={0}
                            data={data}
                            cx="50%"
                            cy="90%" // Move down so we only see top half
                            outerRadius="120%" // maximize size
                            innerRadius="80%" // Donut thickness
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                            ))}
                        </Pie>
                        {/* Needle implementation via needle function? Recharts doesn't support generic SVG child easily inside PieChart unless custom.
                            Actually we can just overlay SVG or use a second transparent Pie line pointer.
                            But creating a custom component inside PieChart is tricky. 
                            Let's use the standard "Needle" trick: A Pie sector that is very thin?
                            Or just render the Needle SVG on top of ResponsiveContainer? 
                            
                            Wait, Recharts allows SVG elements as children of PieChart!
                        */}
                        <CustomNeedle cx="50%" cy="90%" length={80} angle={angle} color="#333" />
                        {/* We can't pass % strings to SVG math. We need exact pixels. 
                             This is hard with ResponsiveContainer.
                             Alternative: Use a Pie sector for the pointer value?
                        */}
                    </PieChart>
                </ResponsiveContainer>
            </div>
            {/* Custom Legend / Value Display */}
            <div style={{ marginTop: '-40px', textAlign: 'center', zIndex: 10 }}>
                <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>{title}</Text>
                <Text strong style={{ fontSize: '24px', color: '#1f1f1f' }}>
                    {displayValue.toFixed(1)}%
                </Text>
            </div>
        </div>
    );
};

// Recharts Custom Component hack requires exact pixels usually. 
// Let's try a simpler approach for the needle: A Pie with 1 tiny sector?
// Or better: Just use 'react-gauge-chart' logic if possible? No.

// Let's implement the needle using a second Pie layer that is transparent except for the needle?
// Actually, let's write a simple SVG gauge without recharts if Recharts is too complex for needles. 
// A pure SVG gauge is easier to make responsive. 

// PLAN B: Pure SVG + standard React. Cleaner, no heavy lib needed for just a gauge.
// 3 arcs, 1 line (needle).
const SvgGauge: React.FC<GaugeProps> = ({ title, value }) => {
    const radius = 80;
    const stroke = 12;
    const normalizedValue = Math.min(Math.max(value, 0), 100);
    const angle = 180 - (normalizedValue / 100) * 180;

    // Helper to describe arc
    const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
        const start = polarToCartesian(x, y, radius, endAngle);
        const end = polarToCartesian(x, y, radius, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
        return [
            "M", start.x, start.y,
            "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
        ].join(" ");
    };

    const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
        const angleInRadians = (angleInDegrees - 180) * Math.PI / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    };

    // Zones
    // Red: 0 to 65% (180 deg to 63 deg) -> Delta 117 deg
    // Yellow: 65 to 85% (63 deg to 27 deg) -> Delta 36 deg
    // Green: 85 to 100% (27 deg to 0 deg) -> Delta 27 deg

    // Angles are 0 (left) to 180 (right) in standard SVG math? 
    // Let's stick to my manual math: 
    // Left (Start) = 180 degrees. Top = 90. Right (End) = 0.

    const redPath = describeArc(100, 90, radius, 63, 180);
    const yellowPath = describeArc(100, 90, radius, 27, 63);
    const greenPath = describeArc(100, 90, radius, 0, 27);

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <svg viewBox="0 0 200 110" width="100%" height="120px" style={{ overflow: 'visible' }}>
                {/* Background Zones */}
                <path d={redPath} fill="none" stroke="#ff4d4f" strokeWidth={stroke} />
                <path d={yellowPath} fill="none" stroke="#faad14" strokeWidth={stroke} />
                <path d={greenPath} fill="none" stroke="#52c41a" strokeWidth={stroke} />

                {/* Needle */}
                <g transform={`translate(100, 90) rotate(${180 - angle})`}>
                    {/* 
                        If value 0 => angle 180 => rotate(0) ? No. 
                        My DescribeArc assumes 180 is left. 
                        SVG Rotate 0 is Right (3 o'clock). 
                        So if value 0 (left) we want -180 rotation to point left.
                        Let's verify.
                    */}
                    <line x1="0" y1="0" x2="-70" y2="0" stroke="#141414" strokeWidth="4" strokeLinecap='round' />
                    <circle cx="0" cy="0" r="6" fill="#141414" />
                </g>

                {/* Text Labels (0, 100) */}
                <text x="10" y="105" fontSize="12" fill="#8c8c8c">0%</text>
                <text x="170" y="105" fontSize="12" fill="#8c8c8c">100%</text>
            </svg>
            <div style={{ marginTop: '-20px', textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: '14px' }}>{title}</Text>
                <div>
                    <Text strong style={{ fontSize: '22px', color: '#1f1f1f' }}>
                        {normalizedValue.toFixed(1)}%
                    </Text>
                </div>
            </div>
        </div>
    );
};

export default SvgGauge;
