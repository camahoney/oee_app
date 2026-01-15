import React from 'react';
import { Typography, Form, InputNumber, Button, Switch } from 'antd';

const { Title } = Typography;

const SettingsPage: React.FC = () => {
    return (
        <div>
            <Title level={2}>Settings</Title>
            <Form layout="vertical">
                <Form.Item label="Performance Threshold (%)">
                    <InputNumber min={0} max={100} defaultValue={25} />
                </Form.Item>
                <Form.Item label="Strict OEE Calculation" valuePropName="checked">
                    <Switch defaultChecked />
                </Form.Item>
                <Form.Item>
                    <Button type="primary">Save Settings</Button>
                </Form.Item>
            </Form>
        </div>
    );
};

export default SettingsPage;
