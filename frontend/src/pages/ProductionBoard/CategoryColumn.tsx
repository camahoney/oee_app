import React, { useState } from 'react';
import { Typography, Button, Input, Space, Popconfirm } from 'antd';
import { DeleteOutlined, EditOutlined, CheckOutlined } from '@ant-design/icons';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { ProductionCategory, MachineStatus } from './types';
import SortableMachineCard from './SortableMachineCard';

const { Title } = Typography;

interface CategoryColumnProps {
    category: ProductionCategory;
    index: number;
    isEditMode: boolean;
    onStatusChange: (categoryId: string, machineId: string, status: MachineStatus, notes?: string, operator?: string) => void;
    activeFilter?: MachineStatus | null;
    availableOperators: string[];
    searchTerm?: string;
    onAddMachine: (categoryId: string, name: string) => void;
    onRemoveMachine: (categoryId: string, machineId: string) => void;
    onRenameMachine: (categoryId: string, machineId: string, newName: string) => void;
    onRemoveCategory: (categoryId: string) => void;
    onRenameCategory: (categoryId: string, newName: string) => void;
}

const CategoryColumn: React.FC<CategoryColumnProps> = ({
    category,
    index,
    isEditMode,
    onStatusChange,
    activeFilter,
    searchTerm,
    onAddMachine,
    onRemoveMachine,
    onRenameMachine,
    onRemoveCategory,
    onRenameCategory,
    availableOperators
}) => {

    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState(category.name);

    // Filter machines based on active filter and search term
    const visibleMachines = category.machines.filter(mac => {
        if (activeFilter && mac.status !== activeFilter) return false;
        if (searchTerm && !mac.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    const HEADER_COLORS = ['#1e3a8a', '#4c1d95', '#064e3b', '#7c2d12', '#831843', '#0f766e'];
    const headerColor = HEADER_COLORS[index % HEADER_COLORS.length];

    return (
        <div style={{
            backgroundColor: '#f4f6f8',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid #e8e8e8',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Colored Header */}
            <div style={{
                background: `linear-gradient(90deg, ${headerColor} 0%, ${headerColor}CC 100%)`,
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
                {isEditMode && isEditingName ? (
                    <Space>
                        <Input
                            value={editNameValue}
                            onChange={e => setEditNameValue(e.target.value)}
                            onPressEnter={() => {
                                onRenameCategory(category.id, editNameValue);
                                setIsEditingName(false);
                            }}
                        />
                        <Button
                            icon={<CheckOutlined />}
                            type="primary"
                            onClick={() => {
                                onRenameCategory(category.id, editNameValue);
                                setIsEditingName(false);
                            }}
                        />
                    </Space>
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <Title level={4} style={{ margin: 0, color: '#ffffff', fontSize: '16px', fontWeight: 700, letterSpacing: '0.5px' }}>
                            {category.name}
                        </Title>
                        <Space size="middle">
                            <div style={{
                                backgroundColor: 'rgba(0,0,0,0.25)',
                                padding: '4px 12px',
                                borderRadius: '16px',
                                color: '#fff',
                                fontSize: '13px',
                                fontWeight: 600
                            }}>
                                {category.machines.length} machines
                            </div>
                            {isEditMode && (
                                <>
                                    <Button type="text" style={{ color: '#fff' }} icon={<EditOutlined />} onClick={() => setIsEditingName(true)} />
                                    <Popconfirm title="Delete category?" onConfirm={() => onRemoveCategory(category.id)}>
                                        <Button type="text" danger icon={<DeleteOutlined />} />
                                    </Popconfirm>
                                </>
                            )}
                        </Space>
                    </div>
                )}
            </div>

            {/* Machines Grid */}
            <div style={{ padding: '8px', flex: 1, overflowY: 'auto' }}>
                <SortableContext items={visibleMachines.map(m => m.id)} strategy={rectSortingStrategy}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: category.name.toLowerCase().includes('comp') ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                        gap: '8px'
                    }}>
                        {visibleMachines.map(machine => (
                            <SortableMachineCard
                                key={machine.id}
                                machine={machine}
                                categoryId={category.id}
                                isEditMode={isEditMode}
                                onStatusChange={onStatusChange}
                                onRename={onRenameMachine}
                                onRemove={onRemoveMachine}
                                availableOperators={availableOperators}
                            />
                        ))}
                    </div>
                </SortableContext>

                {visibleMachines.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8c8c8c', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px dashed #e8e8e8' }}>
                        <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#595959' }}>No machines scheduled</p>
                        <p style={{ margin: '8px 0 0 0', fontSize: '12px' }}>Use Edit Mode to add machines</p>
                    </div>
                )}

                {isEditMode && (
                    <Button
                        type="dashed"
                        block
                        onClick={() => onAddMachine(category.id, 'New Machine')}
                        style={{ marginTop: 12 }}
                    >
                        + Add Machine
                    </Button>
                )}
            </div>
        </div>
    );
};

export default CategoryColumn;
