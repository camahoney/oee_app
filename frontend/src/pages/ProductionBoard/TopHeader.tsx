import React from 'react';
import { Row, Col, Radio, Input, Button, Typography, Space, Switch, Tag } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { ProductionBoardState } from './types';
import { useAuth } from '../../context/AuthContext';

const { Title, Text } = Typography;

interface TopHeaderProps {
    currentShift: ProductionBoardState['currentShift'];
    onShiftChange: (shift: ProductionBoardState['currentShift']) => void;
    lastUpdated: string;
    onRefresh: () => void;
    onSearch: (value: string) => void;
    saving: boolean;
    isEditMode: boolean;
    onEditModeChange: (checked: boolean) => void;
}

const TopHeader: React.FC<TopHeaderProps> = ({ currentShift, onShiftChange, lastUpdated, onRefresh, onSearch, saving, isEditMode, onEditModeChange }) => {
    const { canManage, user, isSupervisor } = useAuth();

    return (
        <div style={{ marginBottom: 16, backgroundColor: '#ffffff', padding: '16px 24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Row justify="space-between" align="middle">
                <Col>
                    <Space size="large">
                        <Space align="center">
                            <Title level={3} style={{ margin: 0 }}>Production Board</Title>
                            {isEditMode && <Tag color="blue" style={{ marginLeft: 8, fontSize: '14px', padding: '2px 8px' }}>Edit Mode Active</Tag>}
                        </Space>
                        <Radio.Group
                            value={currentShift}
                            onChange={(e) => onShiftChange(e.target.value)}
                            optionType="button"
                            buttonStyle="solid"
                            options={[
                                { value: '1st Shift', label: '1st Shift', disabled: isSupervisor && user?.shiftScope !== '1st Shift' },
                                { value: '2nd Shift', label: '2nd Shift', disabled: isSupervisor && user?.shiftScope !== '2nd Shift' },
                                { value: '3rd Shift', label: '3rd Shift', disabled: isSupervisor && user?.shiftScope !== '3rd Shift' },
                            ]}
                        />
                    </Space>
                </Col>
                <Col>
                    <Space size="middle">
                        <Input
                            placeholder="Find machine..."
                            prefix={<SearchOutlined />}
                            onChange={(e) => onSearch(e.target.value)}
                            style={{ width: 200 }}
                        />
                        <Text type="secondary">
                            {saving ? 'Saving...' : `Last Updated: ${new Date(lastUpdated).toLocaleTimeString()}`}
                        </Text>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={onRefresh}
                            loading={saving}
                        >
                            Refresh
                        </Button>
                        {canManage && (
                            <Space>
                                <Text>Edit Mode:</Text>
                                <Switch checked={isEditMode} onChange={onEditModeChange} />
                            </Space>
                        )}
                    </Space>
                </Col>
            </Row>
        </div>
    );
};

export default TopHeader;
