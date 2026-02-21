import React, { useState } from 'react';
import { Row, Col, Layout, Spin, Button } from 'antd';
import { useBoardState } from './useBoardState';
import { MachineStatus } from './types';

import TopHeader from './TopHeader';
import SummaryBar from './SummaryBar';
import CategoryColumn from './CategoryColumn';
import ShiftNotesPanel from './ShiftNotesPanel';
import './ProductionBoard.css';

const { Content } = Layout;

const ProductionBoard: React.FC = () => {
    const {
        state,
        loading,
        saving,
        refresh,
        updateMachineStatus,
        updateShiftNotes,
        setShift,
        addCategory,
        removeCategory,
        renameCategory,
        addMachine,
        removeMachine,
        renameMachine,
        availableOperators
    } = useBoardState();

    // Local ephemeral UI state
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<MachineStatus | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    if (loading || !state) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '60vh' }}>
                <Spin size="large" tip="Loading Production Board..." />
            </div>
        );
    }

    return (
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
                {/* Machine Board Area (Takes up 3/4 of space on large screens) */}
                <Col xs={24} lg={18}>
                    <Row gutter={[16, 16]}>
                        {state.categories.map((category, index) => (
                            <Col xs={24} md={8} key={category.id}>
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
                                />
                            </Col>
                        ))}
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

                {/* Shift Notes Panel Area (Takes up 1/4 of space on large screens) */}
                <Col xs={24} lg={6}>
                    <ShiftNotesPanel
                        notes={state.shiftNotes}
                        onNotesChange={updateShiftNotes}
                    />
                </Col>
            </Row>
        </Content>
    );
};

export default ProductionBoard;

