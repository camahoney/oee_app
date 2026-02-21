import React, { useState, useMemo } from 'react';
import { Row, Col, Layout, Spin, Button } from 'antd';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useBoardState } from './useBoardState';
import { MachineStatus } from './types';

import TopHeader from './TopHeader';
import SummaryBar from './SummaryBar';
import CategoryColumn from './CategoryColumn';
import './ProductionBoard.css';

const { Content } = Layout;

const ProductionBoard: React.FC = () => {
    const {
        state,
        loading,
        saving,
        refresh,
        updateMachineStatus,
        setShift,
        addCategory,
        removeCategory,
        renameCategory,
        addMachine,
        removeMachine,
        renameMachine,
        reorderMachine,
        availableOperators,
        machinePartsHistory,
        manualAllowedParts
    } = useBoardState();

    // Local ephemeral UI state
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<MachineStatus | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const categoryId = active.data.current?.categoryId;
        if (categoryId) {
            reorderMachine(categoryId, active.id as string, over.id as string);
        }
    };

    if (loading || !state) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '60vh' }}>
                <Spin size="large" tip="Loading Production Board..." />
            </div>
        );
    }

    // Compute the list of operators already assigned to machines
    const assignedOperators = useMemo(() => {
        if (!state) return [];
        const assigned: string[] = [];
        state.categories.forEach(cat => {
            cat.machines.forEach(mac => {
                if (mac.operator && mac.operator.trim() !== '') {
                    assigned.push(mac.operator.trim());
                }
            });
        });
        return assigned;
    }, [state]);

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <Content className="production-board-bg" style={{ padding: '0 24px' }}>
                <TopHeader
                    currentShift={state.currentShift}
                    onShiftChange={setShift}
                    lastUpdated={state.lastUpdated}
                    onRefresh={refresh}
                    onSearch={setSearchTerm}
                    saving={saving}
                    isEditMode={isEditMode}
                    onEditModeChange={setIsEditMode}
                />

                <SummaryBar
                    categories={state.categories}
                    activeFilter={statusFilter}
                    onStatusFilter={setStatusFilter}
                />

                <Row gutter={[24, 24]} style={{ paddingBottom: 40 }}>
                    {/* Machine Board Area */}
                    <Col span={24}>
                        <Row gutter={[16, 16]}>
                            {state.categories.map((category, index) => {
                                let colSpan = 8;
                                const name = category.name.toLowerCase();
                                if (name.includes('inj')) colSpan = 9;
                                else if (name.includes('assy') || name.includes('assembl')) colSpan = 9;
                                else if (name.includes('comp')) colSpan = 6;

                                return (
                                    <Col xs={24} md={colSpan} key={category.id}>
                                        <CategoryColumn
                                            category={category}
                                            index={index}
                                            isEditMode={isEditMode}
                                            onStatusChange={updateMachineStatus}
                                            activeFilter={statusFilter}
                                            searchTerm={searchTerm}
                                            onAddMachine={addMachine}
                                            onRemoveMachine={removeMachine}
                                            onRenameMachine={renameMachine}
                                            onRemoveCategory={removeCategory}
                                            onRenameCategory={renameCategory}
                                            availableOperators={availableOperators}
                                            assignedOperators={assignedOperators}
                                            machinePartsHistory={machinePartsHistory}
                                            manualAllowedParts={manualAllowedParts}
                                        />
                                    </Col>
                                );
                            })}
                        </Row>
                        {isEditMode && (
                            <div style={{ marginTop: 16 }}>
                                <Button
                                    type="dashed"
                                    block
                                    onClick={() => addCategory('New Category')}
                                >
                                    + Add Category
                                </Button>
                            </div>
                        )}
                    </Col>
                </Row>
            </Content>
        </DndContext>
    );
};

export default ProductionBoard;
