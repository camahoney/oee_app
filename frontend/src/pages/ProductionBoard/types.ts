export type MachineStatus = 'RUNNING' | 'NO MATERIAL' | 'MOLD CHANGE' | 'NOT SCHEDULED' | 'MAINT' | 'STARTUP';

export const STATUS_COLORS: Record<MachineStatus, string> = {
    'RUNNING': '#52c41a', // Ant Design Green
    'NO MATERIAL': '#1890ff', // Ant Design Blue
    'MOLD CHANGE': '#faad14', // Ant Design Yellow
    'NOT SCHEDULED': '#eb2f96', // Ant Design Pink
    'MAINT': '#f5222d', // Ant Design Red
    'STARTUP': '#bfbfbf', // Ant Design Gray
};

export interface ProductionMachine {
    id: string;
    name: string;
    status: MachineStatus;
    notes?: string;
    operator?: string;
    part?: string;
    sinceTime?: string; // ISO String or Local Time string
}

export interface ProductionCategory {
    id: string;
    name: string;
    machines: ProductionMachine[];
}

export interface ShiftNotes {
    topIssues: string;
    materialShortages: string;
    escalations: string;
    actions: string;
    generalNotes: string;
}

export interface ProductionBoardState {
    categories: ProductionCategory[];
    shiftNotes: ShiftNotes;
    currentShift: 'Day Shift' | '2nd Shift' | '3rd Shift';
    lastUpdated: string; // ISO String
}

// Initial Default State if database is empty
export const DEFAULT_BOARD_STATE: ProductionBoardState = {
    categories: [
        {
            id: 'cat-injection',
            name: 'Injection',
            machines: [
                { id: 'inj-1', name: 'Injection 1', status: 'NOT SCHEDULED' },
                { id: 'inj-2', name: 'Injection 2', status: 'NOT SCHEDULED' }
            ]
        },
        {
            id: 'cat-assembly',
            name: 'Assembly',
            machines: [
                { id: 'asy-1', name: 'Assembly Line 1', status: 'NOT SCHEDULED' }
            ]
        },
        {
            id: 'cat-compression',
            name: 'Compression',
            machines: [
                { id: 'cmp-1', name: 'Compression 1', status: 'NOT SCHEDULED' }
            ]
        }
    ],
    shiftNotes: {
        topIssues: '',
        materialShortages: '',
        escalations: '',
        actions: '',
        generalNotes: ''
    },
    currentShift: 'Day Shift',
    lastUpdated: new Date().toISOString()
};
