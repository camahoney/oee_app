import React, { useMemo } from 'react';
import { Row, Col, Card, Typography } from 'antd';
import { ProductionBoardState, STATUS_COLORS, MachineStatus } from './types';

const { Text, Title } = Typography;

interface SummaryBarProps {
    categories: ProductionBoardState['categories'];
    onStatusFilter?: (status: MachineStatus | null) => void;
    activeFilter?: MachineStatus | null;
}

const SummaryBar: React.FC<SummaryBarProps> = ({ categories, onStatusFilter, activeFilter }) => {

    // Calculate counts for each status
    const counts = useMemo(() => {
        const initialCounts: Record<MachineStatus, number> = {
            'RUNNING': 0,
            'NO MATERIAL': 0,
            'MOLD CHANGE': 0,
            'NOT SCHEDULED': 0,
            'MAINT': 0,
            'STARTUP': 0
        };

        categories.forEach(cat => {
            cat.machines.forEach(mac => {
                if (initialCounts[mac.status] !== undefined) {
                    initialCounts[mac.status]++;
                }
            });
        });

        return initialCounts;
    }, [categories]);

    const handleCardClick = (status: MachineStatus) => {
        if (onStatusFilter) {
            onStatusFilter(activeFilter === status ? null : status);
        }
    };

    const statuses: MachineStatus[] = ['RUNNING', 'NO MATERIAL', 'MOLD CHANGE', 'NOT SCHEDULED', 'MAINT', 'STARTUP'];

    return (
        <div style={{ marginBottom: 24, display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {statuses.map(status => {
                const isActive = activeFilter === status;
                const isDimmed = activeFilter && !isActive;
                const baseColor = STATUS_COLORS[status];

                return (
                    <div
                        key={status}
                        className="summary-tile"
                        onClick={() => handleCardClick(status)}
                        style={{
                            backgroundColor: isActive ? baseColor : `${baseColor}15`,
                            color: isActive ? '#fff' : baseColor,
                            border: `1px solid ${isActive ? baseColor : `${baseColor}40`}`,
                            opacity: isDimmed ? 0.5 : 1,
                            boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px' }}>{status}</span>
                            <div style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: isActive ? '#fff' : baseColor,
                                boxShadow: isActive ? '0 0 0 2px rgba(255,255,255,0.3)' : `0 0 0 2px ${baseColor}30`
                            }} />
                        </div>
                        <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1 }}>
                            {counts[status]}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default SummaryBar;
