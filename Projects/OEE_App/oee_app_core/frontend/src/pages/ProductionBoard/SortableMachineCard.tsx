import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import MachineCard from './MachineCard';
import { ProductionMachine, MachineStatus } from './types';

interface SortableMachineCardProps {
    machine: ProductionMachine;
    categoryId: string;
    isEditMode: boolean;
    availableOperators: string[];
    onStatusChange: (categoryId: string, machineId: string, status: MachineStatus, notes?: string, operator?: string) => void;
    onRemove?: (categoryId: string, machineId: string) => void;
    onRename?: (categoryId: string, machineId: string, newName: string) => void;
}

const SortableMachineCard: React.FC<SortableMachineCardProps> = (props) => {
    // Only pass data if we want to know what category it's in during DragEnd
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: props.machine.id, data: { categoryId: props.categoryId } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 999 : 'auto',
    };

    return (
        <div ref={setNodeRef} style={style}>
            <MachineCard
                {...props}
                dragHandleProps={{ ...attributes, ...listeners }}
            />
        </div>
    );
};

export default SortableMachineCard;
