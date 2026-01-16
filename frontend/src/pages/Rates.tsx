import React, { useEffect, useState } from 'react';
import { Typography, Table, Button, Space, Upload as AntUpload, message, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { rateService } from '../services/api';

const { Title } = Typography;

const Rates: React.FC = () => {
    const [rates, setRates] = useState([]);
    const [loading, setLoading] = useState(false);

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

    const handleDelete = (id: number) => {
        message.info("Delete functionality coming soon!");
        // TODO: Implement delete API call
    };

    const handleEdit = (record: any) => {
        message.info("Edit functionality coming soon!");
        // TODO: Implement edit modal
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

    const columns: any = [
        { title: 'Job / SO#', dataIndex: 'job', key: 'job' },
        { title: 'Part Number', dataIndex: 'part_number', key: 'part_number' },
        { title: 'Machine', dataIndex: 'machine', key: 'machine' },
        {
            title: 'Ideal Cycle (s)',
            dataIndex: 'ideal_cycle_time_seconds',
            key: 'ideal_cycle_time_seconds',
            render: (val: number) => val ? val.toFixed(2) : '-'
        },
        {
            title: 'Units/Hr',
            dataIndex: 'ideal_units_per_hour',
            key: 'ideal_units_per_hour',
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
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>Master Rate Table</Title>
                <Space>
                    <AntUpload {...uploadProps}>
                        <Button icon={<UploadOutlined />}>Upload Rates</Button>
                    </AntUpload>
                    <Button type="primary" icon={<PlusOutlined />}>Add Rate</Button>
                </Space>
            </div>
            <Table
                columns={columns}
                dataSource={rates}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 500, hideOnSinglePage: true }}
                scroll={{ y: 600 }}
                size="middle"
                bordered
            />
        </div>
    );
};

export default Rates;
