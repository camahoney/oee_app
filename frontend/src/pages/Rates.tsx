import React, { useEffect, useState } from 'react';
import { Typography, Table, Button, Space, Upload as AntUpload, message, Popconfirm, Tooltip, Input, Modal, Form, InputNumber } from 'antd';
import { PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { rateService } from '../services/api';

const { Title } = Typography;

const Rates: React.FC = () => {
    const [rates, setRates] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');

    // Modal State
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingRate, setEditingRate] = useState<any>(null);
    const [form] = Form.useForm();

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
        form.setFieldsValue({
            job: record.job,
            part_number: record.part_number,
            machine: record.machine,
            ideal_cycle_time_seconds: record.ideal_cycle_time_seconds,
            active: record.active
        });
        setIsModalVisible(true);
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();

            if (editingRate) {
                await rateService.updateRate(editingRate.id, values);
                message.success('Rate updated');
            } else {
                await rateService.createRate(values);
                message.success('Rate created');
            }
            setIsModalVisible(false);
            fetchRates();
        } catch (error) {
            console.error(error);
            if (!form.isFieldsValidating()) {
                message.error('Failed to save rate. Check inputs.');
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
        { title: 'Job / SO#', dataIndex: 'job', key: 'job', sorter: (a: any, b: any) => (a.job || '').localeCompare(b.job || '') },
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
                    <div style={{ display: 'flex', gap: 16 }}>
                        <Form.Item name="ideal_cycle_time_seconds" label="Ideal Cycle (Sec)" rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
                            <InputNumber style={{ width: '100%' }} step={0.1} min={0} />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default Rates;
