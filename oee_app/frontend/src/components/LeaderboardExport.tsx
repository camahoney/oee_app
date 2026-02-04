
import React from 'react';

const BRAND_BLUE = '#003366';
const GOLD = '#FFD700';
const SILVER = '#C0C0C0';
const BRONZE = '#CD7F32';

interface LeaderboardExportProps {
    data: any[];
    metric: 'volume' | 'oee' | 'yield';
    dateRange: string;
}

export const LeaderboardExport: React.FC<LeaderboardExportProps> = ({ data, metric, dateRange }) => {

    const getMetricLabel = () => {
        if (metric === 'volume') return 'Top Producers by Volume';
        if (metric === 'oee') return 'Top Performers by Efficiency';
        return 'Quality Champions (Yield)';
    };

    const getValue = (op: any) => {
        if (metric === 'volume') return op.total_produced.toLocaleString();
        if (metric === 'oee') return (op.oee * 100).toFixed(0) + '%';
        // Yield
        return ((op.total_good / (op.total_produced || 1)) * 100).toFixed(1) + '%';
    };

    return (
        <div id="printable-leaderboard" style={{ padding: '40px', fontFamily: 'Arial, sans-serif', backgroundColor: 'white' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 40, borderBottom: `4px solid ${BRAND_BLUE}`, paddingBottom: 20 }}>
                <h1 style={{ color: BRAND_BLUE, fontSize: '42px', margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>Production Leaderboard</h1>
                <h3 style={{ color: '#666', marginTop: 10, fontSize: '24px' }}>{getMetricLabel()}</h3>
                <p style={{ color: '#999', fontSize: '18px' }}>Period: {dateRange}</p>
            </div>

            {/* Top 3 Podium (Simplified for Print) */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', marginBottom: 50, gap: '40px' }}>
                {/* 2nd Place */}
                {data[1] && (
                    <div style={{ textAlign: 'center', width: '200px' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: 10 }}>{data[1].name}</div>
                        <div style={{
                            height: '140px',
                            backgroundColor: SILVER,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '8px 8px 0 0',
                            color: 'white',
                            fontSize: '48px',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}>2</div>
                        <div style={{ marginTop: 10, fontSize: '20px', fontWeight: 'bold', color: '#555' }}>
                            {getValue(data[1])}
                        </div>
                    </div>
                )}

                {/* 1st Place */}
                {data[0] && (
                    <div style={{ textAlign: 'center', width: '240px' }}>
                        <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: 10, color: BRAND_BLUE }}>{data[0].name}</div>
                        <div style={{
                            height: '180px',
                            backgroundColor: GOLD,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '8px 8px 0 0',
                            color: 'white',
                            fontSize: '64px',
                            fontWeight: 'bold',
                            boxShadow: '0 6px 12px rgba(0,0,0,0.15)',
                            border: '4px solid #fff'
                        }}>1</div>
                        <div style={{ marginTop: 10, fontSize: '28px', fontWeight: 'bold', color: BRAND_BLUE }}>
                            {getValue(data[0])}
                        </div>
                    </div>
                )}

                {/* 3rd Place */}
                {data[2] && (
                    <div style={{ textAlign: 'center', width: '200px' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: 10 }}>{data[2].name}</div>
                        <div style={{
                            height: '120px',
                            backgroundColor: BRONZE,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '8px 8px 0 0',
                            color: 'white',
                            fontSize: '48px',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}>3</div>
                        <div style={{ marginTop: 10, fontSize: '20px', fontWeight: 'bold', color: '#555' }}>
                            {getValue(data[2])}
                        </div>
                    </div>
                )}
            </div>

            {/* List Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '18px' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '2px solid #ddd' }}>
                        <th style={{ padding: '15px', textAlign: 'left', width: '80px' }}>Rank</th>
                        <th style={{ padding: '15px', textAlign: 'left' }}>Operator</th>
                        <th style={{ padding: '15px', textAlign: 'right' }}>Volume</th>
                        <th style={{ padding: '15px', textAlign: 'right' }}>Good Parts</th>
                        <th style={{ padding: '15px', textAlign: 'right' }}>{metric === 'yield' ? 'Yield Rate' : 'OEE Score'}</th>
                    </tr>
                </thead>
                <tbody>
                    {data.slice(3).map((op, idx) => (
                        <tr key={op.name} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '12px', fontWeight: 'bold', color: '#666' }}>#{op.displayRank}</td>
                            <td style={{ padding: '12px', fontWeight: 'bold' }}>{op.name}</td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>{op.total_produced?.toLocaleString()}</td>
                            <td style={{ padding: '12px', textAlign: 'right', color: '#3f8600' }}>
                                {op.total_good?.toLocaleString()}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                                {metric === 'yield'
                                    ? ((op.total_good / (op.total_produced || 1)) * 100).toFixed(1) + '%'
                                    : (op.oee * 100).toFixed(0) + '%'
                                }
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div style={{ marginTop: 40, textAlign: 'center', color: '#999', fontSize: '14px', borderTop: '1px solid #eee', paddingTop: 20 }}>
                Vibracoustic Performance Analytics &bull; Values based on machine data
            </div>
        </div>
    );
};
