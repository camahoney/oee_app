import React, { useEffect, useState } from 'react';
import { Typography, Table, Button, Space, Upload as AntUpload, message, Popconfirm, Tooltip, Input, Modal, Form, InputNumber, Radio } from 'antd';
import { PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { rateService } from '../services/api';

const { Title } = Typography;

const Rates: React.FC = () => {
    // Force Rebuild Trigger: v1.1 Cavity Support
    const [rates, setRates] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');

    // Modal State
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingRate, setEditingRate] = useState<any>(null);
    const [form] = Form.useForm();

    // Calculation State
    const [calcMode, setCalcMode] = useState('seconds');
    const [shiftHours, setShiftHours] = useState(8);
    const [targetVal, setTargetVal] = useState(0);

    const fetchRates = async () => {
        setLoading(true);
        try {
            const data = await rateService.getRates();
            setRates(data);
        } catch (error) {
            message.error('Failed to load rates');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRates();
    }, []);

    // Filtered Data
    const filteredRates = rates.filter(rate => {
        const search = searchText.toLowerCase();
        return (
            (rate.job?.toLowerCase() || '').includes(search) ||
            (rate.part_number?.toLowerCase() || '').includes(search) ||
            (rate.machine?.toLowerCase() || '').includes(search)
        );
    });

    // Delete
    const handleDelete = async (id: number) => {
        try {
            await rateService.deleteRate(id);
            message.success('Rate deleted');
            fetchRates();
        } catch (error) {
            message.error('Failed to delete rate');
        }
    };

    // Add / Edit Handlers
    const handleAdd = () => {
        setEditingRate(null);
        form.resetFields();
        // Reset Calc State
        setCalcMode('seconds');
        setShiftHours(8);
        setTargetVal(0);

        // Set defaults
        form.setFieldsValue({
            active: true,
            cavities: 1,
            operators: 0
        });
        setIsModalVisible(true);
    };

    const handleEdit = (record: any) => {
        setEditingRate(record);

        // Load Saved Logic
        const savedMode = record.entry_mode || 'seconds';
        setCalcMode(savedMode);
        setShiftHours(8);

        // Reverse Calculate Target if applicable
        let derivedTarget = 0;
        if (record.ideal_cycle_time_seconds > 0) {
            const secondsInShift = 8 * 3600;
            const cavs = record.cavity_count || 1;

            if (savedMode === 'parts_shift') {
                derivedTarget = Math.round(secondsInShift / record.ideal_cycle_time_seconds);
            } else if (savedMode === 'heats_shift') {
                derivedTarget = Math.round(secondsInShift / (record.ideal_cycle_time_seconds * cavs));
            }
        }
        setTargetVal(derivedTarget);

        form.setFieldsValue({
            job: record.job,
            part_number: record.part_number,
            machine: record.machine,
            ideal_cycle_time_seconds: record.ideal_cycle_time_seconds,
            active: record.active,
            cavities: record.cavity_count || 1,
        });
        setIsModalVisible(true);
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();

            // Calculate Cycle Time logic
            let finalCycleTime = values.ideal_cycle_time_seconds;
            let finalMachineCycle = values.ideal_cycle_time_seconds; // Default

            if (calcMode !== 'seconds') {
                const secondsInShift = shiftHours * 3600;
                let calculatedCycle = 0;
                const cavs = values.cavities || 1;

                if (targetVal > 0) {
                    if (calcMode === 'parts_shift') {
                        calculatedCycle = secondsInShift / targetVal;
                    } else if (calcMode === 'heats_shift') {
                        calculatedCycle = secondsInShift / (targetVal * cavs);
                    }
                }

                if (calculatedCycle <= 0) {
                    message.error("Calculated cycle time is invalid. Check targets.");
                    return;
                }
                finalCycleTime = parseFloat(calculatedCycle.toFixed(4));
                // Machine Cycle = Part Cycle (if 1 cav) or Part Cycle * Cav (if entry mode logic?)
                // Actually machine cycle is implied.
            }

            // Prepare Payload
            const payload: any = {
                job: values.job,
                part_number: values.part_number,
                machine: values.machine,
                active: values.active !== undefined ? values.active : true,
                start_date: new Date().toISOString().split('T')[0],
                notes: "Manual Entry",

                // New Fields
                cavity_count: values.cavities || 1,
                entry_mode: calcMode,
                ideal_cycle_time_seconds: finalCycleTime,
                machine_cycle_time: null // We could calculate and store this but 'ideal_cycle' is the truth.
            };

            // Calculate units/hr for convenience
            if (finalCycleTime > 0) {
                payload.ideal_units_per_hour = parseFloat((3600 / finalCycleTime).toFixed(2));
            }

            if (editingRate) {
                // For update, we might need to keep existing start_date if we don't want to reset it?
                // But simplified: just send the payload. Backend Update uses field-by-field copy.
                await rateService.updateRate(editingRate.id, payload);
                message.success('Rate updated');
            } else {
                await rateService.createRate(payload);
                message.success('Rate created');
            }
            setIsModalVisible(false);
            fetchRates();
        } catch (error: any) {
            console.error("Save failed:", error);
            if (error.errorFields) {
                message.error("Please fill in all required fields correctly.");
            } else {
                message.error(error.message || "Failed to save rate");
            }
        }
    };

    const uploadProps = {
        beforeUpload: (file: File) => {
            const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv');
            if (!isCSV) {
                message.error(`${file.name} is not a CSV file`);
            }
            return isCSV || AntUpload.LIST_IGNORE;
        },
        customRequest: async (options: any) => {
            const { file, onSuccess, onError } = options;
            try {
                const result = await rateService.uploadRates(file);
                message.success('Rates uploaded successfully');
                fetchRates(); // Refresh table
                onSuccess(result, file);
            } catch (err: any) {
                const errorMsg = err.response?.data?.detail || 'Upload failed';
                message.error(errorMsg);
                onError(err);
            }
        },
        showUploadList: false,
    };

    // Unique machines for filtering
    const uniqueMachines = Array.from(new Set(rates.map((r: any) => r.machine))).filter(Boolean).sort();
    const machineFilters = uniqueMachines.map(m => ({ text: m, value: m }));

    const columns: any = [
        {
            title: 'Job / SO#',
            dataIndex: 'job',
            key: 'job',
            sorter: (a: any, b: any) => (a.job || '').localeCompare(b.job || ''),
            render: (text: string) => {
                // User requirement: "612010" style, not "SO# 682220 / 682220"
                // Extract the first sequence of digits (5-6 chars typically)
                if (!text) return '-';
                const match = text.match(/\b\d{5,8}\b/);
                if (match) return <Typography.Text strong>{match[0]}</Typography.Text>;
                return text; // Fallback if no clean number found
            }
        },
        {
            title: 'Part Number',
            dataIndex: 'part_number',
            key: 'part_number',
            sorter: (a: any, b: any) => (a.part_number || '').localeCompare(b.part_number || ''),
            render: (text: string) => <Typography.Text strong>{text}</Typography.Text>
        },
        {
            title: 'Machine',
            dataIndex: 'machine',
            key: 'machine',
            filters: machineFilters,
            onFilter: (value: any, record: any) => record.machine === value,
            sorter: (a: any, b: any) => (a.machine || '').localeCompare(b.machine || '')
        },
        {
            title: 'Ideal Cycle (s)',
            dataIndex: 'ideal_cycle_time_seconds',
            key: 'ideal_cycle_time_seconds',
            sorter: (a: any, b: any) => a.ideal_cycle_time_seconds - b.ideal_cycle_time_seconds,
            render: (val: number) => val ? val.toFixed(2) : '-'
        },
        {
            title: 'Cavities',
            dataIndex: 'cavity_count',
            key: 'cavity_count',
            sorter: (a: any, b: any) => (a.cavity_count || 1) - (b.cavity_count || 1),
            render: (val: number) => val || 1
        },
        {
            title: 'Units/Hr',
            dataIndex: 'ideal_units_per_hour',
            key: 'ideal_units_per_hour',
            sorter: (a: any, b: any) => a.ideal_units_per_hour - b.ideal_units_per_hour,
            render: (val: number) => val ? val.toFixed(1) : '-'
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Tooltip title="Edit">
                        <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                    </Tooltip>
                    <Popconfirm title="Are you sure delete this rate?" onConfirm={() => handleDelete(record.id)}>
                        <Tooltip title="Delete">
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ paddingBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title level={2} style={{ margin: 0 }}>Master Rate Table</Title>
                <Space>
                    <Input
                        placeholder="Search Rate..."
                        prefix={<SearchOutlined />}
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        style={{ width: 250 }}
                        allowClear
                    />
                    <AntUpload {...uploadProps}>
                        <Button icon={<UploadOutlined />}>Upload Rates</Button>
                    </AntUpload>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add Rate</Button>
                </Space>
            </div>

            <Table
                columns={columns}
                dataSource={filteredRates}
                rowKey="id"
                loading={loading}
                pagination={{ defaultPageSize: 100, showSizeChanger: true, pageSizeOptions: ['50', '100', '200', '500'] }}
                scroll={{ y: 'calc(100vh - 280px)' }}
                size="middle"
                bordered
            />

            <Modal
                title={editingRate ? "Edit Rate" : "Add Rate"}
                open={isModalVisible}
                onOk={handleModalOk}
                onCancel={() => setIsModalVisible(false)}
                destroyOnClose
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="job" label="Job / SO#" rules={[{ required: true, message: 'Please enter Job/SO#' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="part_number" label="Part Number" rules={[{ required: true, message: 'Please enter Part Number' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="machine" label="Machine" rules={[{ required: true, message: 'Please enter Machine ID' }]}>
                        <Input />
                    </Form.Item>
                    <div style={{ marginBottom: 16 }}>
                        <Form.Item label="Entry Mode" required>
                            <Radio.Group
                                value={calcMode}
                                onChange={e => setCalcMode(e.target.value)}
                                optionType="button"
                                buttonStyle="solid"
                            >
                                <Radio value="seconds">Seconds/Part</Radio>
                                <Radio value="parts_shift">Parts/Shift</Radio>
                                <Radio value="heats_shift">Heats/Shift</Radio>
                            </Radio.Group>
                        </Form.Item>
                    </div>

                    <div style={{ display: 'flex', gap: 16 }}>
                        {calcMode !== 'parts_shift' && (
                            <Form.Item name="cavities" label="Cavities" initialValue={1} rules={[{ required: true }]} style={{ flex: 1 }}>
                                <InputNumber min={1} style={{ width: '100%' }} />
                            </Form.Item>
                        )}

                        {calcMode === 'seconds' && (
                            <Form.Item name="ideal_cycle_time_seconds" label="Ideal Cycle (Sec)" rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
                                <InputNumber style={{ width: '100%' }} step={0.1} min={0} />
                            </Form.Item>
                        )}
                    </div>

                    {calcMode !== 'seconds' && (
                        <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '8px', marginBottom: 16 }}>
                            <div style={{ display: 'flex', gap: 16 }}>
                                <Form.Item label="Shift Length (Hrs)" style={{ flex: 1 }}>
                                    <InputNumber value={shiftHours} onChange={val => setShiftHours(val || 8)} min={1} max={24} style={{ width: '100%' }} />
                                </Form.Item>
                                <Form.Item label={calcMode === 'parts_shift' ? "Target Parts" : "Target Heats"} style={{ flex: 1 }}>
                                    <InputNumber value={targetVal} onChange={val => setTargetVal(val || 0)} min={0} style={{ width: '100%' }} />
                                </Form.Item>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <Typography.Text type="secondary">Calculated Cycle Time (per Part):</Typography.Text>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                                    {(() => {
                                        if (!targetVal) return '---';
                                        const secondsInShift = shiftHours * 3600;
                                        let cycle = 0;
                                        const cavs = form.getFieldValue('cavities') || 1;

                                        if (calcMode === 'parts_shift') {
                                            // Parts Mode: Cavities irrelevant for per-part time
                                            cycle = secondsInShift / targetVal;
                                        } else {
                                            // Heats Mode: Need cavities to get Total Parts
                                            cycle = secondsInShift / (targetVal * cavs);
                                        }
                                        return cycle.toFixed(2) + ' sec';
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}
                </Form>
            </Modal>
        </div>
    );
};

export default Rates;
