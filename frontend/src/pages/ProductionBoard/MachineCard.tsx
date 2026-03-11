import React, { useState, useEffect, useMemo } from 'react';
import { Card, Select, Input, Typography, Space, Button, Popconfirm, Dropdown, Spin } from 'antd';
import { DeleteOutlined, EditOutlined, CheckOutlined, DownOutlined, ToolOutlined, InboxOutlined, SyncOutlined, CalendarOutlined, PoweroffOutlined, DragOutlined } from '@ant-design/icons';
import { ProductionMachine, MachineStatus, STATUS_COLORS } from './types';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const { Text } = Typography;

interface MachineCardProps {
    machine: ProductionMachine;
    categoryId: string;
    isEditMode?: boolean;
    availableOperators: string[];
    assignedOperators: string[];
    machinePartsHistory: Record<string, string[]>;
    manualAllowedParts: Record<string, string[]>;
    onStatusChange: (categoryId: string, machineId: string, status: MachineStatus, notes?: string, operator?: string | null, part?: string | null) => void;
    onRemove?: (categoryId: string, machineId: string) => void;
    onRename?: (categoryId: string, machineId: string, newName: string) => void;
    dragHandleProps?: any;
}

const MachineCard: React.FC<MachineCardProps> = ({
    machine,
    categoryId,
    isEditMode = false,
    onStatusChange,
    onRemove,
    onRename,
    availableOperators,
    assignedOperators,
    machinePartsHistory,
    manualAllowedParts,
    dragHandleProps
}) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState(machine.name);
    const { isViewer } = useAuth();

    const [suggestedOperator, setSuggestedOperator] = useState<string | null>(null);
    const [suggestStats, setSuggestStats] = useState<{ oee: number, qual: number, runs: number } | null>(null);
    const [isSuggesting, setIsSuggesting] = useState(false);

    // Combine Historical and Manual Parts
    const combinedParts = useMemo(() => {
        const historyParts = machinePartsHistory[machine.name] || [];
        const manualParts = manualAllowedParts[machine.name] || [];

        // Deduplicate across both sources
        const allParts = new Set([...historyParts, ...manualParts]);

        return Array.from(allParts)
            .sort((a, b) => a.localeCompare(b))
            .map(p => ({ label: p, value: p }));
    }, [machine.name, machinePartsHistory, manualAllowedParts]);

    // Normalize operator name from DB format ("3415  Spencer,Vangie") to match roster format ("Cortney Rentfro")
    const normalizeOperatorName = (dbName: string): string[] => {
        // Strip leading employee ID (digits + spaces)
        const stripped = dbName.replace(/^\d+\s+/, '').trim();
        const variants: string[] = [stripped.toLowerCase()];

        // Handle "Last,First" → "First Last"
        if (stripped.includes(',')) {
            const [last, first] = stripped.split(',').map(s => s.trim());
            if (first && last) {
                variants.push(`${first} ${last}`.toLowerCase());
                variants.push(`${first.charAt(0)}${first.slice(1).toLowerCase()} ${last.charAt(0)}${last.slice(1).toLowerCase()}`);
            }
        }
        // Handle "First Last" as-is
        variants.push(stripped.toLowerCase());
        return variants;
    };

    const matchesRoster = (dbOperator: string, rosterList: string[]): string | null => {
        const variants = normalizeOperatorName(dbOperator);
        for (const rosterName of rosterList) {
            const rosterLower = rosterName.toLowerCase().trim();
            for (const variant of variants) {
                if (variant === rosterLower) return rosterName;
                // Also check if last names match (for partial matches like "Rob" vs "Robert")
                const rosterParts = rosterLower.split(' ');
                const variantParts = variant.split(' ');
                if (rosterParts.length >= 2 && variantParts.length >= 2 &&
                    rosterParts[rosterParts.length - 1] === variantParts[variantParts.length - 1]) {
                    return rosterName;
                }
            }
        }
        return null;
    };

    // Stable key for assigned operators — prevents re-triggering when state changes but same operators are assigned
    const assignedKey = useMemo(() => JSON.stringify([...assignedOperators].sort()), [assignedOperators]);

    // Track previous part to only fire API when part genuinely changes
    const prevPartRef = React.useRef<string | undefined>(machine.part);

    // Fetch Auto-Suggest Operator when Part changes
    useEffect(() => {
        // Only fire when part actually changes (not on every render)
        if (machine.part === prevPartRef.current) return;
        prevPartRef.current = machine.part;

        if (!machine.part || machine.part.trim() === '') {
            setSuggestedOperator(null);
            setSuggestStats(null);
            return;
        }

        let isMounted = true;

        const fetchSuggestion = async () => {
            setIsSuggesting(true);
            try {
                const res = await api.get(`/metrics/suggest-operator?machine=${encodeURIComponent(machine.name)}&part=${encodeURIComponent(machine.part!)}`);
                if (isMounted) {
                    // Backend returns a ranked list of operators
                    const ranked = Array.isArray(res.data) ? res.data : [];
                    const currentAssigned: string[] = JSON.parse(assignedKey);

                    // Find the best operator who is:
                    // 1. Matches someone in the current shift's employee list (fuzzy name match)
                    // 2. That shift employee is NOT already assigned to another machine
                    let foundMatch = false;
                    for (const r of ranked) {
                        const rosterName = matchesRoster(r.operator, availableOperators);
                        if (rosterName && !currentAssigned.includes(rosterName)) {
                            // Auto-apply the best operator if no operator is currently set
                            if (!machine.operator) {
                                onStatusChange(categoryId, machine.id, machine.status, machine.notes, rosterName, machine.part);
                            }
                            setSuggestedOperator(rosterName);
                            setSuggestStats({
                                oee: r.avg_oee,
                                qual: r.avg_quality,
                                runs: r.historical_runs
                            });
                            foundMatch = true;
                            break;
                        }
                    }
                    if (!foundMatch) {
                        setSuggestedOperator(null);
                        setSuggestStats(null);
                    }
                }
            } catch (err) {
                if (isMounted) {
                    setSuggestedOperator(null);
                    setSuggestStats(null);
                }
            } finally {
                if (isMounted) setIsSuggesting(false);
            }
        };

        fetchSuggestion();

        return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [machine.part, machine.name, availableOperators, assignedKey]);

    // Status options conforming strictly to the requested order
    const statusOptions: { label: string, value: MachineStatus }[] = [
        { label: 'RUNNING', value: 'RUNNING' },
        { label: 'NO MATERIAL', value: 'NO MATERIAL' },
        { label: 'MOLD CHANGE', value: 'MOLD CHANGE' },
        { label: 'NOT SCHEDULED', value: 'NOT SCHEDULED' },
        { label: 'MAINT!', value: 'MAINT' },
        { label: 'STARTUP', value: 'STARTUP' }
    ];

    const cardColor = STATUS_COLORS[machine.status];
    const isStartup = machine.status === 'STARTUP';

    const getStatusIcon = (status: MachineStatus) => {
        switch (status) {
            case 'RUNNING':
                return <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#fff', boxShadow: '0 0 4px rgba(255,255,255,0.8)' }} />;
            case 'MAINT':
                return <ToolOutlined style={{ fontSize: '14px' }} />;
            case 'NO MATERIAL':
                return <InboxOutlined style={{ fontSize: '14px' }} />;
            case 'MOLD CHANGE':
                return <SyncOutlined style={{ fontSize: '14px' }} />;
            case 'NOT SCHEDULED':
                return <CalendarOutlined style={{ fontSize: '14px' }} />;
            case 'STARTUP':
                return <PoweroffOutlined style={{ fontSize: '14px' }} />;
            default:
                return null;
        }
    };

    return (
        <Card
            className={isEditMode ? 'machine-card-wrapper edit-mode-active-card' : 'machine-card-wrapper'}
            size="small"
            style={{
                marginBottom: 0,
                border: `1px solid ${isStartup ? '#e8e8e8' : '#f0f0f0'}`,
                borderRadius: '8px',
                backgroundColor: isStartup ? '#fcfcfc' : '#ffffff',
                opacity: machine.status === 'NOT SCHEDULED' ? 0.75 : 1,
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
            }}
            bodyStyle={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', flex: 1, gap: '6px' }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                {isEditMode && isEditingName ? (
                    <Space size="small" style={{ width: '100%' }}>
                        <Input
                            size="small"
                            value={editNameValue}
                            onChange={e => setEditNameValue(e.target.value)}
                            onPressEnter={() => {
                                if (onRename) {
                                    onRename(categoryId, machine.id, editNameValue);
                                }
                                setIsEditingName(false);
                            }}
                        />
                        <Button
                            size="small"
                            icon={<CheckOutlined />}
                            type="primary"
                            onClick={() => {
                                if (onRename) {
                                    onRename(categoryId, machine.id, editNameValue);
                                }
                                setIsEditingName(false);
                            }}
                        />
                    </Space>
                ) : (
                    <>
                        <Space align="center" size="small">
                            {isEditMode && dragHandleProps && (
                                <div {...dragHandleProps} style={{ cursor: 'grab', color: '#bfbfbf', display: 'flex', alignItems: 'center' }}>
                                    <DragOutlined />
                                </div>
                            )}
                            <Text strong style={{ fontSize: '15px', fontWeight: 600, color: '#262626', letterSpacing: '0.1px' }}>{machine.name}</Text>
                        </Space>
                        {isEditMode && (
                            <Space size="small">
                                <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setIsEditingName(true)} style={{ padding: 0, width: '24px', height: '24px' }} />
                                {onRemove && (
                                    <Popconfirm title="Delete machine?" onConfirm={() => onRemove(categoryId, machine.id)}>
                                        <Button size="small" type="text" danger icon={<DeleteOutlined />} style={{ padding: 0, width: '24px', height: '24px' }} />
                                    </Popconfirm>
                                )}
                            </Space>
                        )}
                    </>
                )}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Dropdown
                    menu={{
                        items: statusOptions.map(opt => ({
                            key: opt.value,
                            label: opt.label,
                            onClick: () => onStatusChange(categoryId, machine.id, opt.value, machine.notes)
                        }))
                    }}
                    trigger={['click']}
                    disabled={isViewer}
                >
                    <div style={{
                        backgroundColor: cardColor,
                        color: '#fff',
                        padding: '0 8px',
                        height: '32px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontWeight: 700,
                        fontSize: '11px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                        overflow: 'hidden'
                    }}>
                        <Space size={6} style={{ overflow: 'hidden' }}>
                            {getStatusIcon(machine.status)}
                            <span style={{ letterSpacing: '0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{machine.status === 'MAINT' ? 'MAINT!' : machine.status}</span>
                        </Space>
                        <DownOutlined style={{ fontSize: '10px', opacity: 0.8, flexShrink: 0, marginLeft: '4px' }} />
                    </div>
                </Dropdown>
            </div>

            {/* Part Running UI */}
            <div style={{ padding: '0px 0', marginTop: '4px' }}>
                <Select
                    showSearch
                    allowClear
                    placeholder="Part Running"
                    size="small"
                    bordered={false}
                    disabled={isViewer}
                    value={machine.part}
                    onChange={(value) => onStatusChange(categoryId, machine.id, machine.status, machine.notes, machine.operator, value === undefined ? null : value)}
                    style={{ width: '100%', backgroundColor: '#f0f2f5', borderRadius: '4px', fontSize: '12px' }}
                    options={combinedParts}
                    filterOption={(input, option) =>
                        String(option?.value || '').toLowerCase().includes(input.toLowerCase())
                    }
                />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '4px' }}>
                <div style={{ flex: 1, marginRight: '8px' }}>
                    <Select
                        showSearch
                        allowClear
                        placeholder="Select Operator"
                        size="middle"
                        bordered={false}
                        disabled={isViewer}
                        value={machine.operator && availableOperators.includes(machine.operator) ? machine.operator : undefined}
                        onChange={(value) => onStatusChange(categoryId, machine.id, machine.status, machine.notes, value === undefined ? null : value)}
                        style={{ width: '100%', backgroundColor: '#f4f6f8', borderRadius: '4px' }}
                        options={availableOperators.map(op => ({ value: op, label: op }))}
                        filterOption={(input, option) =>
                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                    />
                </div>
                {isEditMode ? (
                    <Input
                        placeholder="Notes"
                        size="small"
                        bordered={false}
                        value={machine.notes || ''}
                        onChange={(e) => onStatusChange(categoryId, machine.id, machine.status, e.target.value, machine.operator)}
                        style={{ textAlign: 'right', fontSize: '12px', padding: 0, width: '80px' }}
                    />
                ) : (
                    <Text type="secondary" style={{ fontSize: '12px', maxWidth: '80px', textAlign: 'right' }} ellipsis={{ tooltip: machine.notes }}>
                        {machine.notes || ''}
                    </Text>
                )}
            </div>

            {/* Auto-Suggest UI */}
            {isSuggesting && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#8c8c8c', paddingLeft: '4px', marginTop: '4px' }}>
                    <Spin size="small" /> Analyzing history...
                </div>
            )}
            {!isSuggesting && !isViewer && suggestedOperator && machine.operator !== suggestedOperator && (
                <div style={{
                    backgroundColor: '#fffbe6',
                    border: '1px solid #ffe58f',
                    borderRadius: '4px',
                    padding: '4px 6px',
                    marginTop: '4px',
                    fontSize: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong style={{ color: '#d48806' }}>⭐ Suggestion</Text>
                        <Button
                            type="link"
                            size="small"
                            style={{ padding: 0, height: 'auto', fontSize: '10px', lineHeight: 1 }}
                            onClick={() => onStatusChange(categoryId, machine.id, machine.status, machine.notes, suggestedOperator, machine.part)}
                        >
                            Apply
                        </Button>
                    </div>
                    <Text style={{ color: '#ad6800' }}>
                        {suggestedOperator} (Avg OEE: {((suggestStats?.oee || 0) * 100).toFixed(1)}%)
                    </Text>
                </div>
            )}
        </Card >
    );
};

export default MachineCard;
