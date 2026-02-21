import React, { useEffect, useState } from 'react';
import { Typography, Form, InputNumber, Button, Switch, message, Spin, Select, Collapse, Card, Badge, Tag, Space } from 'antd';
import {
    SettingOutlined,
    TeamOutlined,
    ToolOutlined,
    DashboardOutlined,
    AimOutlined,
    AlertOutlined,
    SaveOutlined,
    CheckCircleOutlined,
} from '@ant-design/icons';
import api, { settingsService } from '../services/api';

const { Title, Text } = Typography;

const SettingsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [machineNames, setMachineNames] = useState<string[]>([]);
    const [machineHistoryParts, setMachineHistoryParts] = useState<Record<string, string[]>>({});
    const [form] = Form.useForm();

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const data = await settingsService.getAll();
            const values: Record<string, any> = {};

            // Defaults
            values['performance_threshold'] = 25;
            values['oee_target'] = 85;
            values['availability_target'] = 90;
            values['performance_target'] = 95;
            values['quality_target'] = 99;
            values['show_oee_over_100_warning'] = true;
            values['threshold_downtime_min'] = 20;
            values['shift_employees_day'] = [];
            values['shift_employees_second'] = [];
            values['shift_employees_third'] = [];

            // Override with DB values
            data.forEach(s => {
                if (s.key === 'performance_threshold') values[s.key] = Number(s.value);
                if (s.key === 'oee_target') values[s.key] = Number(s.value);
                if (s.key === 'availability_target') values[s.key] = Number(s.value);
                if (s.key === 'performance_target') values[s.key] = Number(s.value);
                if (s.key === 'quality_target') values[s.key] = Number(s.value);
                if (s.key === 'show_oee_over_100_warning') values[s.key] = s.value.toLowerCase() === 'true';
                if (s.key === 'threshold_downtime_min') values[s.key] = Number(s.value);
                if (s.key === 'shift_employees_day') values[s.key] = JSON.parse(s.value || '[]');
                if (s.key === 'shift_employees_second') values[s.key] = JSON.parse(s.value || '[]');
                if (s.key === 'shift_employees_third') values[s.key] = JSON.parse(s.value || '[]');
            });

            // Parse production board state for machine names
            const prodStateObj = data.find(s => s.key === 'production_board_state');
            const machinesFound: string[] = [];
            if (prodStateObj && prodStateObj.value) {
                try {
                    const parsedState = JSON.parse(prodStateObj.value);
                    if (parsedState.categories && Array.isArray(parsedState.categories)) {
                        parsedState.categories.forEach((cat: any) => {
                            if (cat.machines && Array.isArray(cat.machines)) {
                                cat.machines.forEach((m: any) => {
                                    if (m.name) machinesFound.push(m.name);
                                });
                            }
                        });
                    }
                } catch (e) { }
            }
            machinesFound.sort((a, b) => a.localeCompare(b));
            setMachineNames(machinesFound);

            // Fetch parts history
            let fetchedHistory: Record<string, string[]> = {};
            try {
                const partsHistoryRes = await api.get('/metrics/machine-parts-history');
                if (partsHistoryRes.data) {
                    fetchedHistory = partsHistoryRes.data;
                    setMachineHistoryParts(partsHistoryRes.data);
                }
            } catch (e) { }

            // Fetch machine_allowed_parts
            const allowedPartsObj = data.find(s => s.key === 'machine_allowed_parts');
            let allowedParts: Record<string, string[]> = {};
            if (allowedPartsObj && allowedPartsObj.value) {
                try {
                    allowedParts = JSON.parse(allowedPartsObj.value);
                } catch (e) { }
            }

            // Merge historical + manual parts
            machinesFound.forEach(mName => {
                const manual = allowedParts[mName] || [];
                const history = fetchedHistory[mName] || [];
                const merged = [...manual];
                history.forEach(p => {
                    if (!merged.includes(p)) merged.push(p);
                });
                values[`allowed_parts_${mName}`] = merged;
            });

            form.setFieldsValue(values);
        } catch (error) {
            console.error("Failed to load settings", error);
            message.error("Failed to load settings.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSave = async (values: any) => {
        try {
            setSaving(true);
            await settingsService.update('performance_threshold', String(values.performance_threshold), 'Percentage deviation allowed for Performance validation');
            await settingsService.update('oee_target', String(values.oee_target), 'Target OEE Percentage for Color Coding');
            await settingsService.update('availability_target', String(values.availability_target), 'Target Availability Percentage');
            await settingsService.update('performance_target', String(values.performance_target), 'Target Performance Percentage');
            await settingsService.update('quality_target', String(values.quality_target), 'Target Quality Percentage');
            await settingsService.update('show_oee_over_100_warning', String(values.show_oee_over_100_warning), 'Enable warning for OEE > 100%');
            await settingsService.update('threshold_downtime_min', String(values.threshold_downtime_min), 'High Downtime Threshold (min)');

            await settingsService.update('shift_employees_day', JSON.stringify(values.shift_employees_day || []), 'List of employees for Day Shift');
            await settingsService.update('shift_employees_second', JSON.stringify(values.shift_employees_second || []), 'List of employees for 2nd Shift');
            await settingsService.update('shift_employees_third', JSON.stringify(values.shift_employees_third || []), 'List of employees for 3rd Shift');

            const allowedPartsToSave: Record<string, string[]> = {};
            machineNames.forEach(mName => {
                const parts = values[`allowed_parts_${mName}`];
                if (parts && parts.length > 0) {
                    allowedPartsToSave[mName] = parts;
                }
            });
            await settingsService.update('machine_allowed_parts', JSON.stringify(allowedPartsToSave), 'Manually allowed parts per machine');

            message.success('Settings saved successfully');
        } catch (error) {
            console.error("Save failed", error);
            message.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    // Group machines by category prefix for organized display
    const groupedMachines = React.useMemo(() => {
        const groups: Record<string, string[]> = {};
        machineNames.forEach(name => {
            const prefix = name.replace(/\s*\d+$/, '').trim() || 'Other';
            if (!groups[prefix]) groups[prefix] = [];
            groups[prefix].push(name);
        });
        return groups;
    }, [machineNames]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '60vh' }}>
                <Spin size="large" tip="Loading Settings..." />
            </div>
        );
    }

    return (
        <div style={{ padding: '24px 32px', maxWidth: '960px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                    <SettingOutlined style={{ fontSize: '28px', color: '#1e3a8a' }} />
                    <Title level={2} style={{ margin: 0, color: '#1e293b', fontWeight: 700 }}>Application Settings</Title>
                </div>
                <Text type="secondary" style={{ fontSize: '14px', marginLeft: '40px' }}>
                    Configure analytics, operator schedules, and machine parts across all modules.
                </Text>
            </div>

            <Form form={form} layout="vertical" onFinish={handleSave}>
                <Collapse
                    defaultActiveKey={[]}
                    expandIconPosition="end"
                    bordered={false}
                    style={{ background: 'transparent' }}
                    items={[
                        {
                            key: 'analytics',
                            label: (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <DashboardOutlined style={{ fontSize: '18px', color: '#1e3a8a' }} />
                                    <span style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Analytics &amp; Thresholds</span>
                                    <Tag color="blue" style={{ marginLeft: '4px', fontSize: '11px' }}>6 settings</Tag>
                                </div>
                            ),
                            style: {
                                marginBottom: '16px',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                background: '#ffffff',
                                overflow: 'hidden',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            },
                            children: (
                                <div style={{ padding: '8px 8px 0' }}>
                                    {/* Target KPIs */}
                                    <div style={{
                                        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                        borderRadius: '10px',
                                        padding: '20px 24px',
                                        marginBottom: '20px',
                                        border: '1px solid #e2e8f0',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                            <AimOutlined style={{ color: '#059669', fontSize: '16px' }} />
                                            <Text strong style={{ fontSize: '14px', color: '#334155' }}>Dashboard Target Scores</Text>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <Form.Item label="OEE Target" name="oee_target" tooltip="Scores below this value will be colored Red. Scores above will be Green." rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0 }}>
                                                <InputNumber min={1} max={100} addonAfter="%" style={{ width: '100%' }} />
                                            </Form.Item>
                                            <Form.Item label="Availability Target" name="availability_target" tooltip="Target percentage for Availability KPI." rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0 }}>
                                                <InputNumber min={1} max={100} addonAfter="%" style={{ width: '100%' }} />
                                            </Form.Item>
                                            <Form.Item label="Performance Target" name="performance_target" tooltip="Target percentage for Performance KPI." rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0 }}>
                                                <InputNumber min={1} max={100} addonAfter="%" style={{ width: '100%' }} />
                                            </Form.Item>
                                            <Form.Item label="Quality Target" name="quality_target" tooltip="Target percentage for Quality KPI." rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0 }}>
                                                <InputNumber min={1} max={100} addonAfter="%" style={{ width: '100%' }} />
                                            </Form.Item>
                                        </div>
                                    </div>

                                    {/* Threshold Controls */}
                                    <div style={{
                                        background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                                        borderRadius: '10px',
                                        padding: '20px 24px',
                                        marginBottom: '20px',
                                        border: '1px solid #fde68a',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                            <AlertOutlined style={{ color: '#d97706', fontSize: '16px' }} />
                                            <Text strong style={{ fontSize: '14px', color: '#334155' }}>Alert Thresholds</Text>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <Form.Item label="Performance Validation (%)" name="performance_threshold" tooltip="Deviation from 100% allowed before flagging. E.g. 25% means flags at <75% and >125%." rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0 }}>
                                                <InputNumber min={5} max={50} addonAfter="%" style={{ width: '100%' }} />
                                            </Form.Item>
                                            <Form.Item label="High Downtime Threshold" name="threshold_downtime_min" tooltip="Minimum downtime minutes to trigger a 'High Downtime' insight." rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0 }}>
                                                <InputNumber min={1} max={120} addonAfter="min" style={{ width: '100%' }} />
                                            </Form.Item>
                                        </div>
                                    </div>

                                    {/* Display Toggle */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: '#f8fafc',
                                        borderRadius: '10px',
                                        padding: '16px 24px',
                                        border: '1px solid #e2e8f0',
                                        marginBottom: '8px',
                                    }}>
                                        <div>
                                            <Text strong style={{ color: '#334155' }}>Show OEE &gt; 100% Warnings</Text>
                                            <br />
                                            <Text type="secondary" style={{ fontSize: '12px' }}>Flag OEE scores over 100% (often due to incorrect rate standards)</Text>
                                        </div>
                                        <Form.Item name="show_oee_over_100_warning" valuePropName="checked" style={{ marginBottom: 0 }}>
                                            <Switch />
                                        </Form.Item>
                                    </div>
                                </div>
                            ),
                        },
                        {
                            key: 'operators',
                            label: (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <TeamOutlined style={{ fontSize: '18px', color: '#7c3aed' }} />
                                    <span style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Production Shift Operators</span>
                                    <Tag color="purple" style={{ marginLeft: '4px', fontSize: '11px' }}>3 shifts</Tag>
                                </div>
                            ),
                            style: {
                                marginBottom: '16px',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                background: '#ffffff',
                                overflow: 'hidden',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            },
                            children: (
                                <div style={{ padding: '8px 8px 0' }}>
                                    <Text type="secondary" style={{ display: 'block', marginBottom: '20px', fontSize: '13px' }}>
                                        Type a name and press <Text keyboard>Enter</Text> to add an employee. Operators are assigned to machines on the Production Board.
                                    </Text>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {[
                                            { key: 'shift_employees_day', label: 'Day Shift', icon: '☀️' },
                                            { key: 'shift_employees_second', label: '2nd Shift', icon: '🌤️' },
                                            { key: 'shift_employees_third', label: '3rd Shift', icon: '🌙' },
                                        ].map(shift => (
                                            <div key={shift.key} style={{
                                                background: '#f8fafc',
                                                borderRadius: '10px',
                                                padding: '16px 20px',
                                                border: '1px solid #e2e8f0',
                                            }}>
                                                <Form.Item label={<span>{shift.icon} {shift.label}</span>} name={shift.key} style={{ marginBottom: 0 }}>
                                                    <Select
                                                        mode="tags"
                                                        style={{ width: '100%' }}
                                                        placeholder="Type a name and press Enter..."
                                                        tokenSeparators={[',']}
                                                    />
                                                </Form.Item>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            key: 'parts',
                            label: (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <ToolOutlined style={{ fontSize: '18px', color: '#059669' }} />
                                    <span style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Machine Parts Configuration</span>
                                    <Tag color="green" style={{ marginLeft: '4px', fontSize: '11px' }}>{machineNames.length} machines</Tag>
                                </div>
                            ),
                            style: {
                                marginBottom: '16px',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                background: '#ffffff',
                                overflow: 'hidden',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            },
                            children: (
                                <div style={{ padding: '8px 8px 0' }}>
                                    <Text type="secondary" style={{ display: 'block', marginBottom: '20px', fontSize: '13px' }}>
                                        Parts from report history are auto-populated. Add or remove part numbers to control what appears on the Production Board dropdowns.
                                    </Text>

                                    {machineNames.length === 0 ? (
                                        <div style={{
                                            textAlign: 'center',
                                            padding: '40px',
                                            background: '#f8fafc',
                                            borderRadius: '10px',
                                            border: '1px dashed #cbd5e1',
                                        }}>
                                            <ToolOutlined style={{ fontSize: '32px', color: '#94a3b8', marginBottom: '8px' }} />
                                            <br />
                                            <Text type="secondary">No machines detected. Add machines to the Production Board first.</Text>
                                        </div>
                                    ) : (
                                        Object.entries(groupedMachines).map(([prefix, machines]) => (
                                            <div key={prefix} style={{ marginBottom: '20px' }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    marginBottom: '12px',
                                                    paddingBottom: '8px',
                                                    borderBottom: '2px solid #e2e8f0',
                                                }}>
                                                    <Text strong style={{ fontSize: '14px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                        {prefix}
                                                    </Text>
                                                    <Badge count={machines.length} style={{ backgroundColor: '#94a3b8' }} />
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                                                    {machines.map(mName => {
                                                        const partsCount = (form.getFieldValue(`allowed_parts_${mName}`) || []).length;
                                                        return (
                                                            <div key={mName} style={{
                                                                background: '#f8fafc',
                                                                borderRadius: '10px',
                                                                padding: '14px 16px',
                                                                border: '1px solid #e2e8f0',
                                                                transition: 'border-color 0.2s',
                                                            }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                                    <Text strong style={{ fontSize: '13px', color: '#1e293b' }}>{mName}</Text>
                                                                    {partsCount > 0 && (
                                                                        <Tag color="cyan" style={{ fontSize: '10px', lineHeight: '16px', padding: '0 6px', margin: 0 }}>
                                                                            {partsCount} parts
                                                                        </Tag>
                                                                    )}
                                                                </div>
                                                                <Form.Item name={`allowed_parts_${mName}`} style={{ marginBottom: 0 }}>
                                                                    <Select
                                                                        mode="tags"
                                                                        style={{ width: '100%' }}
                                                                        placeholder="Add part number..."
                                                                        tokenSeparators={[',']}
                                                                        size="small"
                                                                        maxTagCount="responsive"
                                                                    />
                                                                </Form.Item>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ),
                        },
                    ]}
                />

                {/* Save Button */}
                <div style={{
                    position: 'sticky',
                    bottom: 0,
                    background: 'linear-gradient(180deg, transparent 0%, #f8fafc 20%, #f8fafc 100%)',
                    padding: '20px 0 8px',
                    zIndex: 10,
                }}>
                    <Form.Item style={{ marginBottom: 0 }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={saving}
                            size="large"
                            icon={<SaveOutlined />}
                            style={{
                                width: '100%',
                                height: '48px',
                                borderRadius: '10px',
                                fontWeight: 600,
                                fontSize: '15px',
                                background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
                                border: 'none',
                                boxShadow: '0 4px 14px rgba(30,58,138,0.3)',
                            }}
                        >
                            Save All Changes
                        </Button>
                    </Form.Item>
                </div>
            </Form>
        </div>
    );
};

export default SettingsPage;
