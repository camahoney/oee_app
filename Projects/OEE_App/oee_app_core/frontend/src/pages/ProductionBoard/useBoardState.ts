import React, { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import api from '../../services/api';
import { ProductionBoardState, DEFAULT_BOARD_STATE, MachineStatus, ProductionCategory, ShiftNotes, ProductionMachine } from './types';

const SETTING_KEY = 'production_board_state';

export const useBoardState = () => {
    const [state, setState] = useState<ProductionBoardState | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);

    // Shift Employee Lists
    const [dayEmployees, setDayEmployees] = useState<string[]>([]);
    const [secondEmployees, setSecondEmployees] = useState<string[]>([]);
    const [thirdEmployees, setThirdEmployees] = useState<string[]>([]);

    // Machine Part Lists
    const [machinePartsHistory, setMachinePartsHistory] = useState<Record<string, string[]>>({});
    const [manualAllowedParts, setManualAllowedParts] = useState<Record<string, string[]>>({});

    const fetchState = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch Board State
            const stateResponse = await api.get(`/settings/${SETTING_KEY}`).catch(() => null);
            if (stateResponse && stateResponse.data && stateResponse.data.value) {
                setState(JSON.parse(stateResponse.data.value));
            } else {
                setState(DEFAULT_BOARD_STATE);
            }

            // Fetch Employee Lists (Catch errors individually to avoid failing Promise.all)
            const fetchSettingArray = async (key: string) => {
                try {
                    const res = await api.get(`/settings/${key}`);
                    if (res.data && res.data.value) {
                        return JSON.parse(res.data.value);
                    }
                } catch (e) {
                    // Ignore 404s, returning empty array
                }
                return [];
            };

            const [dayRes, secondRes, thirdRes, partsHistoryRes, manualPartsRes] = await Promise.all([
                fetchSettingArray('shift_employees_day'),
                fetchSettingArray('shift_employees_second'),
                fetchSettingArray('shift_employees_third'),
                api.get('/metrics/machine-parts-history').catch(() => ({ data: {} })),
                api.get('/settings/machine_allowed_parts').catch(() => ({ data: { value: "{}" } }))
            ]);

            setDayEmployees(dayRes);
            setSecondEmployees(secondRes);
            setThirdEmployees(thirdRes);

            // Set historical parts mapping
            if (partsHistoryRes.data) {
                setMachinePartsHistory(partsHistoryRes.data);
            }

            // Set manual allowed parts
            if (manualPartsRes.data && manualPartsRes.data.value) {
                try {
                    setManualAllowedParts(JSON.parse(manualPartsRes.data.value));
                } catch (e) {
                    setManualAllowedParts({});
                }
            }

        } catch (error: any) {
            message.error('Failed to load board state');
            console.error(error);
            if (!state) setState(DEFAULT_BOARD_STATE); // Fallback so UI doesn't break
        } finally {
            setLoading(false);
        }
    }, [state]);

    useEffect(() => {
        fetchState();
        // Option to poll every X seconds could go here for "real-time"
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const saveState = async (newState: ProductionBoardState) => {
        setState(newState); // Optimistic update
        setSaving(true);
        try {
            // Include automatic lastUpdated timestamp
            const stateToSave = {
                ...newState,
                lastUpdated: new Date().toISOString()
            };
            await api.put(`/settings/${SETTING_KEY}`, {
                value: JSON.stringify(stateToSave),
                description: 'State for the Production Status Board'
            });
            // Update local state with the new timestamp silently
            setState(stateToSave);
        } catch (error) {
            message.error('Failed to save board state');
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    // Helper to update a specific machine's status
    const updateMachineStatus = (categoryId: string, machineId: string, status: MachineStatus, notes?: string, operator?: string | null, part?: string | null) => {
        if (!state) return;

        const updatedCategories = state.categories.map(cat => {
            if (cat.id !== categoryId) return cat;

            const updatedMachines = cat.machines.map(mac => {
                if (mac.id !== machineId) return mac;
                return {
                    ...mac,
                    status,
                    notes: notes !== undefined ? notes : mac.notes,
                    operator: operator !== undefined ? (operator === null ? undefined : operator) : mac.operator,
                    part: part !== undefined ? (part === null ? undefined : part) : mac.part,
                };
            });
            return { ...cat, machines: updatedMachines };
        });

        saveState({ ...state, categories: updatedCategories });
    };

    // Helper to update shift notes
    const updateShiftNotes = (notes: Partial<ShiftNotes>) => {
        if (!state) return;
        saveState({
            ...state,
            shiftNotes: { ...state.shiftNotes, ...notes }
        });
    };

    // Helper to update categories structure (for Managers)
    const updateCategories = (categories: ProductionCategory[]) => {
        if (!state) return;
        saveState({ ...state, categories });
    };

    const setShift = (shift: ProductionBoardState['currentShift']) => {
        if (!state) return;
        saveState({ ...state, currentShift: shift });
    };

    const addMachine = (categoryId: string, name: string) => {
        if (!state) return;
        const newMachine: ProductionMachine = {
            id: `mac-${Date.now()}`,
            name,
            status: 'NOT SCHEDULED'
        };
        const updatedCategories = state.categories.map(cat =>
            cat.id === categoryId ? { ...cat, machines: [...cat.machines, newMachine] } : cat
        );
        saveState({ ...state, categories: updatedCategories });
    };

    const removeMachine = (categoryId: string, machineId: string) => {
        if (!state) return;
        const updatedCategories = state.categories.map(cat =>
            cat.id === categoryId ? { ...cat, machines: cat.machines.filter(m => m.id !== machineId) } : cat
        );
        saveState({ ...state, categories: updatedCategories });
    };

    const addCategory = (name: string) => {
        if (!state) return;
        const newCategory: ProductionCategory = {
            id: `cat-${Date.now()}`,
            name,
            machines: []
        };
        saveState({ ...state, categories: [...state.categories, newCategory] });
    };

    const removeCategory = (categoryId: string) => {
        if (!state) return;
        saveState({ ...state, categories: state.categories.filter(c => c.id !== categoryId) });
    };

    const renameCategory = (categoryId: string, newName: string) => {
        if (!state) return;
        const updatedCategories = state.categories.map(cat =>
            cat.id === categoryId ? { ...cat, name: newName } : cat
        );
        saveState({ ...state, categories: updatedCategories });
    };

    const renameMachine = (categoryId: string, machineId: string, newName: string) => {
        if (!state) return;
        const updatedCategories = state.categories.map(cat => {
            if (cat.id !== categoryId) return cat;
            const updatedMachines = cat.machines.map(mac =>
                mac.id === machineId ? { ...mac, name: newName } : mac
            );
            return { ...cat, machines: updatedMachines };
        });
        saveState({ ...state, categories: updatedCategories });
    };

    const reorderMachine = (categoryId: string, activeId: string, overId: string) => {
        if (!state) return;

        const categoryIndex = state.categories.findIndex(cat => cat.id === categoryId);
        if (categoryIndex === -1) return;

        const category = state.categories[categoryIndex];
        const oldIndex = category.machines.findIndex(m => m.id === activeId);
        const newIndex = category.machines.findIndex(m => m.id === overId);

        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

        const newMachines = [...category.machines];
        const [movedMachine] = newMachines.splice(oldIndex, 1);
        newMachines.splice(newIndex, 0, movedMachine);

        const updatedCategories = [...state.categories];
        updatedCategories[categoryIndex] = { ...category, machines: newMachines };

        saveState({ ...state, categories: updatedCategories });
    };

    // Determine available operators based on current shift
    const availableOperators = React.useMemo(() => {
        if (!state) return [];
        switch (state.currentShift) {
            case 'Day Shift': return dayEmployees;
            case '2nd Shift': return secondEmployees;
            case '3rd Shift': return thirdEmployees;
            default: return [];
        }
    }, [state?.currentShift, dayEmployees, secondEmployees, thirdEmployees]);

    return {
        state,
        loading,
        saving,
        availableOperators,
        machinePartsHistory,
        manualAllowedParts,
        refresh: fetchState,
        updateMachineStatus,
        updateShiftNotes,
        updateCategories,
        setShift,
        addMachine,
        removeMachine,
        addCategory,
        removeCategory,
        renameCategory,
        renameMachine,
        reorderMachine
    };
};
