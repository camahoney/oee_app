import React, { useEffect, useState } from 'react';
import { Typography, Form, InputNumber, Button, Switch, message, Divider, Spin, Select } from 'antd';
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
            // Convert array of settings to key-value map for form
            const values: Record<string, any> = {};

            // Set defaults first
            values['performance_threshold'] = 25;
            values['oee_target'] = 85;
            values['availability_target'] = 90;
            values['performance_target'] = 95;
            values['quality_target'] = 99;
            values['show_oee_over_100_warning'] = true;
            values['threshold_downtime_min'] = 20;

            // Arrays for Select tags mode
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

                // Parse JSON array for employee lists
                if (s.key === 'shift_employees_day') values[s.key] = JSON.parse(s.value || '[]');
                if (s.key === 'shift_employees_second') values[s.key] = JSON.parse(s.value || '[]');
                if (s.key === 'shift_employees_third') values[s.key] = JSON.parse(s.value || '[]');
            });

            // Fetch production_board_state to get machine list dynamically
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

            // Merge historical + manual parts and set as form defaults
            machinesFound.forEach(mName => {
                const manual = allowedParts[mName] || [];
                const history = fetchedHistory[mName] || [];
                // Deduplicate: manual parts first, then history parts not already in manual
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
            // Save logic: update each setting one by one (or bulk endpoint if existed, but loop is fine here for 3 items)
            await settingsService.update('performance_threshold', String(values.performance_threshold), 'Percentage deviation allowed for Performance validation');
            await settingsService.update('oee_target', String(values.oee_target), 'Target OEE Percentage for Color Coding');
            await settingsService.update('availability_target', String(values.availability_target), 'Target Availability Percentage');
            await settingsService.update('performance_target', String(values.performance_target), 'Target Performance Percentage');
            await settingsService.update('quality_target', String(values.quality_target), 'Target Quality Percentage');
            await settingsService.update('show_oee_over_100_warning', String(values.show_oee_over_100_warning), 'Enable warning for OEE > 100%');
            await settingsService.update('threshold_downtime_min', String(values.threshold_downtime_min), 'High Downtime Threshold (min)');

            // Save JSON array strings for employee lists
            await settingsService.update('shift_employees_day', JSON.stringify(values.shift_employees_day || []), 'List of employees for Day Shift');
            await settingsService.update('shift_employees_second', JSON.stringify(values.shift_employees_second || []), 'List of employees for 2nd Shift');
            await settingsService.update('shift_employees_third', JSON.stringify(values.shift_employees_third || []), 'List of employees for 3rd Shift');

            // Save manual parts array map
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

    if (loading) {
        return <div style={{ textAlign: 'center', marginTop: 50 }}><Spin size="large" /></div>;
    }

    return (
        <div style={{ padding: '24px', maxWidth: '800px' }}>
            <Title level={2}>Application Settings</Title>
            <Text type="secondary">Configure analytics thresholds and dashboard behaviors.</Text>
            <Divider />

            <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
            >
                <Title level={4}>Analytics Thresholds</Title>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Form.Item
                        label="Performance Validation Threshold (%)"
                        name="performance_threshold"
                        tooltip="Deviation from 100% allowed before flagging 'Low Output' or 'High Output'. E.g. 25% means flags at <75% and >125%."
                        rules={[{ required: true, message: 'Please enter a threshold' }]}
                    >
                        <InputNumber min={5} max={50} addonAfter="%" style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        label="High Downtime Threshold (min)"
                        name="threshold_downtime_min"
                        tooltip="Minimum downtime minutes to trigger a 'High Downtime' insight."
                        rules={[{ required: true, message: 'Please enter a threshold' }]}
                    >
                        <InputNumber min={1} max={120} addonAfter="min" style={{ width: '100%' }} />
                    </Form.Item>
                </div>

                <Title level={4} style={{ marginTop: 24 }}>Dashboard Display Targets</Title>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Form.Item
                        label="OEE Target Score (%)"
                        name="oee_target"
                        tooltip="Scores below this value will be colored Red. Scores above will be Green."
                        rules={[{ required: true, message: 'Please enter a target' }]}
                    >
                        <InputNumber min={1} max={100} addonAfter="%" style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        label="Availability Target (%)"
                        name="availability_target"
                        tooltip="Target percentage for Availability KPI."
                        rules={[{ required: true, message: 'Please enter a target' }]}
                    >
                        <InputNumber min={1} max={100} addonAfter="%" style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        label="Performance Target (%)"
                        name="performance_target"
                        tooltip="Target percentage for Performance KPI."
                        rules={[{ required: true, message: 'Please enter a target' }]}
                    >
                        <InputNumber min={1} max={100} addonAfter="%" style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                        label="Quality Target (%)"
                        name="quality_target"
                        tooltip="Target percentage for Quality KPI."
                        rules={[{ required: true, message: 'Please enter a target' }]}
                    >
                        <InputNumber min={1} max={100} addonAfter="%" style={{ width: '100%' }} />
                    </Form.Item>
                </div>

                <Divider />

                <Title level={4}>General Display</Title>
                <Form.Item
                    label="Show OEE > 100% Warnings"
                    name="show_oee_over_100_warning"
                    valuePropName="checked"
                    tooltip="If enabled, OEE scores > 100% (often due to bad Rate Standards) will show an Orange warning icon."
                >
                    <Switch />
                </Form.Item>

                <Divider />

                <Title level={4}>Production Board Shift Operators</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                    Type a name and press Enter to add an employee to a shift roster.
                </Text>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                    <Form.Item
                        label="Day Shift Employees"
                        name="shift_employees_day"
                    >
                        <Select
                            mode="tags"
                            style={{ width: '100%' }}
                            placeholder="e.g. John Doe, Jane Smith"
                            tokenSeparators={[',']}
                        />
                    </Form.Item>
                    <Form.Item
                        label="2nd Shift Employees"
                        name="shift_employees_second"
                    >
                        <Select
                            mode="tags"
                            style={{ width: '100%' }}
                            placeholder="e.g. John Doe, Jane Smith"
                            tokenSeparators={[',']}
                        />
                    </Form.Item>
                    <Form.Item
                        label="3rd Shift Employees"
                        name="shift_employees_third"
                    >
                        <Select
                            mode="tags"
                            style={{ width: '100%' }}
                            placeholder="e.g. John Doe, Jane Smith"
                            tokenSeparators={[',']}
                        />
                    </Form.Item>
                </div>

                <Divider />

                <Title level={4}>Manual Allowed Parts</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                    Type a part number and press Enter to allow it on a specific machine. Notes: Historically run parts are automatically shown alongside manually added ones.
                </Text>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {machineNames.length === 0 ? (
                        <Text type="secondary">No machines detected on Production Board.</Text>
                    ) : (
                        machineNames.map(mName => {
                            const historyTags = machineHistoryParts[mName] || [];
                            return (
                                <div key={mName} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <Form.Item
                                        label={`${mName}`}
                                        name={`allowed_parts_${mName}`}
                                        style={{ marginBottom: 0 }}
                                    >
                                        <Select
                                            mode="tags"
                                            style={{ width: '100%' }}
                                            placeholder={`e.g. 12345`}
                                            tokenSeparators={[',']}
                                        />
                                    </Form.Item>
                                    {historyTags.length > 0 && (
                                        <div style={{ fontSize: '11px', color: '#8c8c8c', lineHeight: 1.4 }}>
                                            <span style={{ marginRight: '4px' }}>Historically seen:</span>
                                            {historyTags.map(tag => (
                                                <Typography.Text key={tag} code style={{ fontSize: '10px', padding: '0 4px', margin: '2px' }}>{tag}</Typography.Text>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <Form.Item style={{ marginTop: 32 }}>
                    <Button type="primary" htmlType="submit" loading={saving} size="large">
                        Save Changes
                    </Button>
                </Form.Item>
            </Form>
        </div>
    );
};

export default SettingsPage;
