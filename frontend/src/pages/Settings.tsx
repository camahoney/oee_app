import React, { useEffect, useState } from 'react';
import { Typography, Form, InputNumber, Button, Switch, message, Divider, Spin } from 'antd';
import { settingsService } from '../services/api';

const { Title, Text } = Typography;

const SettingsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
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

            // Override with DB values
            data.forEach(s => {
                if (s.key === 'performance_threshold') values[s.key] = Number(s.value);
                if (s.key === 'oee_target') values[s.key] = Number(s.value);
                if (s.key === 'availability_target') values[s.key] = Number(s.value);
                if (s.key === 'performance_target') values[s.key] = Number(s.value);
                if (s.key === 'quality_target') values[s.key] = Number(s.value);
                if (s.key === 'show_oee_over_100_warning') values[s.key] = s.value.toLowerCase() === 'true';
                if (s.key === 'threshold_downtime_min') values[s.key] = Number(s.value);
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

                <Title level={4}>System Maintenance</Title>
                <div style={{ background: '#fff1f0', padding: '16px', borderRadius: '8px', border: '1px solid #ffa39e', marginBottom: '24px' }}>
                    <p style={{ marginBottom: '16px', color: '#cf1322' }}>
                        <b>Emergency Tools:</b> Use these only if you are experiencing system data issues.
                    </p>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <Button
                            danger
                            onClick={async () => {
                                try {
                                    message.loading({ content: 'Running Migration...', key: 'fixdb' });
                                    // Use raw fetch to ensure we hit the configured API endpoint
                                    // But we can use the 'api' instance from services/api
                                    const { default: api } = await import('../services/api');
                                    const res = await api.get('/fix-db');
                                    message.success({ content: `Fix Complete: ${JSON.stringify(res.data.status)}`, key: 'fixdb', duration: 5 });
                                    if (res.data.logs && res.data.logs.length > 0) {
                                        alert("Logs:\n" + res.data.logs.join("\n"));
                                    }
                                } catch (e) {
                                    message.error({ content: `Fix Failed: ${e}`, key: 'fixdb' });
                                }
                            }}
                        >
                            🛠️ Run Database Auto-Fix
                        </Button>
                        <Button
                            onClick={async () => {
                                try {
                                    message.loading({ content: 'Checking DB...', key: 'debugdb' });
                                    const { default: api } = await import('../services/api');
                                    const res = await api.get('/debug-db');
                                    message.success({ content: 'Status Loaded', key: 'debugdb' });
                                    alert(JSON.stringify(res.data, null, 2));
                                } catch (e) {
                                    message.error({ content: `Check Failed: ${e}`, key: 'debugdb' });
                                }
                            }}
                        >
                            🔍 Check DB Status
                        </Button>
                    </div>
                </div>

                <Divider />

                <Title level={4}>System Maintenance</Title>
                <div style={{ background: '#fff1f0', padding: '16px', borderRadius: '8px', border: '1px solid #ffa39e', marginBottom: '24px' }}>
                    <p style={{ marginBottom: '16px', color: '#cf1322' }}>
                        <b>Emergency Tools:</b> Use these only if you are experiencing system data issues.
                    </p>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <Button
                            danger
                            onClick={async () => {
                                try {
                                    message.loading({ content: 'Running Migration...', key: 'fixdb' });
                                    const { default: api } = await import('../services/api');
                                    const res = await api.get('/fix-db');
                                    message.success({ content: `Fix Complete: ${JSON.stringify(res.data.status)}`, key: 'fixdb', duration: 5 });
                                    if (res.data.logs && res.data.logs.length > 0) {
                                        alert("Logs:\n" + res.data.logs.join("\n"));
                                    }
                                } catch (e) {
                                    message.error({ content: `Fix Failed: ${e}`, key: 'fixdb' });
                                }
                            }}
                        >
                            🛠️ Run Database Auto-Fix
                        </Button>
                        <Button
                            onClick={async () => {
                                try {
                                    message.loading({ content: 'Checking DB...', key: 'debugdb' });
                                    const { default: api } = await import('../services/api');
                                    const res = await api.get('/debug-db');
                                    message.success({ content: 'Status Loaded', key: 'debugdb' });
                                    alert(JSON.stringify(res.data, null, 2));
                                } catch (e) {
                                    message.error({ content: `Check Failed: ${e}`, key: 'debugdb' });
                                }
                            }}
                        >
                            🔍 Check DB Status
                        </Button>
                    </div>
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
