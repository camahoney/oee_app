import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

interface GaugeProps {
    title: string;
    value: number; // 0 to 100
    target?: number; // Optional target percentage
}

const OeeGauge: React.FC<GaugeProps> = ({ title, value, target }) => {
    // Clamp value
    const normalizedValue = Math.min(Math.max(value, 0), 100);

    // Angle Start: 180 (Left)
    // Angle End: 360 (Right)
    // Range: 180 degrees
    const angle = 180 + (normalizedValue / 100) * 180;

    // Config
    const radius = 80;
    const cx = 100;
    const cy = 90;
    const strokeWidth = 14;

    // Helper for ticks - Standard Trig
    // SVG Cos: 180->Left(-1), 270->Up(0), 360->Right(1)
    // SVG Sin: 180->0, 270->Up(-1), 360->0
    const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
        const angleInRadians = angleInDegrees * Math.PI / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    };

    const ticks = [0, 20, 40, 60, 80, 100];

    // Determine value color based on target
    let valueColor = '#1f1f1f'; // Default Black/Dark Grey
    if (target !== undefined) {
        if (value >= target) {
            valueColor = '#52c41a'; // Green (Good)
        } else {
            valueColor = '#ff4d4f'; // Red (Bad)
        }
    }

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <svg viewBox="0 0 200 110" width="100%" height="140px" style={{ overflow: 'visible' }}>
                <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ff4d4f" />   {/* Red (Left) */}
                        <stop offset="50%" stopColor="#faad14" />  {/* Yellow */}
                        <stop offset="100%" stopColor="#52c41a" /> {/* Green (Right) */}
                    </linearGradient>
                    <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
                        <feOffset dx="1" dy="2" result="offsetblur" />
                        <feComponentTransfer>
                            <feFuncA type="linear" slope="0.3" />
                        </feComponentTransfer>
                        <feMerge>
                            <feMergeNode />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Main Arc Background (Track) */}
                <path d="M 20 90 A 80 80 0 0 1 180 90" fill="none" stroke="#f0f0f0" strokeWidth={strokeWidth} />

                {/* Gradient Value Arc (Full range for background color effect) */}
                <path d="M 20 90 A 80 80 0 0 1 180 90" fill="none" stroke="url(#gaugeGradient)" strokeWidth={strokeWidth} strokeLinecap="round" />

                {/* Tick Marks */}
                {ticks.map(tick => {
                    // Map 0..100 to 180..360
                    const tickAngle = 180 + (tick / 100) * 180;

                    // Lines
                    const start = polarToCartesian(cx, cy, radius - strokeWidth / 2 + 2, tickAngle);
                    const end = polarToCartesian(cx, cy, radius + strokeWidth / 2 - 2, tickAngle);

                    // Text Labels
                    const textPos = polarToCartesian(cx, cy, radius - 20, tickAngle);

                    return (
                        <g key={tick}>
                            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#fff" strokeWidth="2" />
                            <text x={textPos.x} y={textPos.y} fontSize="10" fill="#bfbfbf" textAnchor="middle" dominantBaseline="middle">
                                {tick}%
                            </text>
                        </g>
                    )
                })}

                {/* Needle */}
                <g transform={`translate(${cx}, ${cy}) rotate(${angle})`} filter="url(#dropShadow)">
                    {/* 
                        Needle Geometry: Drawn pointing to 0 degrees (Right).
                        When angle=180 (0% Val), `rotate(180)` flips it to point Left. Correct.
                        When angle=270 (50% Val), `rotate(270)` points Up. Correct.
                        When angle=360 (100% Val), `rotate(360)` points Right. Correct.
                    */}
                    <path d="M 0 -4 L 75 0 L 0 4 Z" fill="#262626" />
                    <circle cx="0" cy="0" r="6" fill="#262626" stroke="#fff" strokeWidth="2" />
                </g>

            </svg>
            <div style={{ marginTop: '-25px', textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: '14px', letterSpacing: '0.5px' }}>{title}</Text>
                <div>
                    <Text strong style={{ fontSize: '26px', color: valueColor, lineHeight: 1 }}>
                        {normalizedValue.toFixed(1)}%
                    </Text>
                    {target && (
                        <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '4px' }}>
                            Target: {target}%
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OeeGauge;
