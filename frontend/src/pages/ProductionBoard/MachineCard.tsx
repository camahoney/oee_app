import React, { useState } from 'react';
import { Card, Select, Input, Typography, Space, Button, Popconfirm, Dropdown } from 'antd';
import { DeleteOutlined, EditOutlined, CheckOutlined, DownOutlined, ToolOutlined, InboxOutlined, SyncOutlined, CalendarOutlined, PoweroffOutlined } from '@ant-design/icons';
import { ProductionMachine, MachineStatus, STATUS_COLORS } from './types';

const { Text } = Typography;

interface MachineCardProps {
    machine: ProductionMachine;
    categoryId: string;
    isEditMode?: boolean;
    availableOperators: string[];
    onStatusChange: (categoryId: string, machineId: string, status: MachineStatus, notes?: string, operator?: string) => void;
    onRemove?: (categoryId: string, machineId: string) => void;
    onRename?: (categoryId: string, machineId: string, newName: string) => void;
}

const MachineCard: React.FC<MachineCardProps> = ({
    machine,
    categoryId,
    isEditMode = false,
    onStatusChange,
    onRemove,
    onRename,
    availableOperators
}) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState(machine.name);

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
            bodyStyle={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', flex: 1, gap: '10px' }}
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
                        <Text strong style={{ fontSize: '16px', fontWeight: 600, color: '#262626', letterSpacing: '0.2px' }}>{machine.name}</Text>
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
                >
                    <div style={{
                        backgroundColor: cardColor,
                        color: '#fff',
                        padding: '0 14px',
                        height: '40px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontWeight: 700,
                        fontSize: '14px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                    }}>
                        <Space size="small">
                            {getStatusIcon(machine.status)}
                            <span style={{ letterSpacing: '0.5px' }}>{machine.status === 'MAINT' ? 'MAINT!' : machine.status}</span>
                        </Space>
                        <DownOutlined style={{ fontSize: '11px', opacity: 0.8 }} />
                    </div>
                </Dropdown>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '4px' }}>
                <div style={{ flex: 1, marginRight: '8px' }}>
                    <Select
                        showSearch
                        allowClear
                        placeholder="Select Operator"
                        size="middle"
                        bordered={false}
                        value={machine.operator && availableOperators.includes(machine.operator) ? machine.operator : undefined}
                        onChange={(value) => onStatusChange(categoryId, machine.id, machine.status, machine.notes, value)}
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
        </Card >
    );
};

export default MachineCard;
