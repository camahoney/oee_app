import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

interface GaugeProps {
    title: string;
    value: number; // 0 to 100
}

const OeeGauge: React.FC<GaugeProps> = ({ title, value }) => {
    // Clamp value
    const normalizedValue = Math.min(Math.max(value, 0), 100);
    // Angle: 180 (Left) -> 0 (Right)
    const angle = 180 - (normalizedValue / 100) * 180;

    // Config
    const radius = 80;
    const cx = 100;
    const cy = 90;
    const strokeWidth = 14;

    // Helper for ticks
    const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
        const angleInRadians = (angleInDegrees - 180) * Math.PI / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    };

    const ticks = [0, 20, 40, 60, 80, 100];

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

                {/* Main Arc Background (Grey Shadow) */}
                <path d="M 20 90 A 80 80 0 0 1 180 90" fill="none" stroke="#f0f0f0" strokeWidth={strokeWidth} />

                {/* Gradient Value Arc */}
                {/* We draw the Full Arc with the gradient */}
                <path d="M 20 90 A 80 80 0 0 1 180 90" fill="none" stroke="url(#gaugeGradient)" strokeWidth={strokeWidth} strokeLinecap="round" />

                {/* Tick Marks */}
                {ticks.map(tick => {
                    const tickAngle = 180 - (tick / 100) * 180;
                    const start = polarToCartesian(cx, cy, radius - strokeWidth / 2 + 2, tickAngle);
                    const end = polarToCartesian(cx, cy, radius + strokeWidth / 2 - 2, tickAngle);
                    // Text pos
                    const textPos = polarToCartesian(cx, cy, radius - 20, tickAngle);

                    return (
                        <g key={tick}>
                            {/* White separator line inside arc */}
                            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#fff" strokeWidth="2" />
                            {/* Text Label */}
                            <text x={textPos.x} y={textPos.y} fontSize="10" fill="#bfbfbf" textAnchor="middle" dominantBaseline="middle">
                                {tick}%
                            </text>
                        </g>
                    )
                })}

                {/* Needle */}
                <g transform={`translate(${cx}, ${cy}) rotate(${angle})`} filter="url(#dropShadow)">
                    {/* SVG Rotate is clockwise. 0 is 3 o'clock (Right).
                        Val=0 -> angle=180 -> rotate(180) -> Points Left. Correct.
                        Val=100 -> angle=0 -> rotate(0) -> Points Right. Correct.
                        Needle design points RIGHT (0 deg) essentially.
                    */}
                    <path d="M 0 -4 L 75 0 L 0 4 Z" fill="#262626" />
                    <circle cx="0" cy="0" r="6" fill="#262626" stroke="#fff" strokeWidth="2" />
                </g>

            </svg>
            <div style={{ marginTop: '-25px', textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: '14px', letterSpacing: '0.5px' }}>{title}</Text>
                <div>
                    <Text strong style={{ fontSize: '26px', color: '#1f1f1f', lineHeight: 1 }}>
                        {normalizedValue.toFixed(1)}%
                    </Text>
                </div>
            </div>
        </div>
    );
};

export default OeeGauge;
