import React, { useEffect, useState } from 'react';
import { Typography, Table, Button, Space, Upload as AntUpload, message } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
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
            } catch (err) {
                message.error('Upload failed');
                onError(err);
            }
        },
        showUploadList: false,
    };

    const columns = [
        { title: 'Operator', dataIndex: 'operator', key: 'operator' },
        { title: 'Machine', dataIndex: 'machine', key: 'machine' },
        { title: 'Part Number', dataIndex: 'part_number', key: 'part_number' },
        { title: 'Ideal Units/Hr', dataIndex: 'ideal_units_per_hour', key: 'ideal_units_per_hour' },
        { title: 'Start Date', dataIndex: 'start_date', key: 'start_date' },
        { title: 'Active', dataIndex: 'active', key: 'active', render: (text: boolean) => text ? 'Yes' : 'No' },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title level={2}>Master Rate Table</Title>
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
            />
        </div>
    );
};

export default Rates;
