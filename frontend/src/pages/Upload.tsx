import React, { useState } from 'react';
import { Typography, Upload as AntUpload, Button, message, Card, Table, Modal, List } from 'antd';
import { UploadOutlined, CloudServerOutlined } from '@ant-design/icons';
import { reportService } from '../services/api';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

const Upload: React.FC = () => {
    const [missingRates, setMissingRates] = useState<string[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [reportId, setReportId] = useState<number | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const navigate = useNavigate();

    const handleCustomRequest = async (options: any) => {
        const { file, onSuccess, onError } = options;
        setUploading(true);
        try {
            const result = await reportService.uploadReport(file);
            message.success('Report uploaded successfully');
            setReportId(result.report_id);
            setPreviewData(result.preview || []);
            onSuccess(result, file);
        } catch (err: any) {
            const errorMsg = err.response?.data?.detail || 'Upload failed';
            message.error(errorMsg, 10);
            onError(err);
        } finally {
            setUploading(false);
        }
    };

    const handleCalculate = async () => {
        if (!reportId) return;
        try {
            message.loading({ content: 'Calculating OEE metrics...', key: 'calc' });
            const response = await reportService.calculateMetrics(reportId);

            if (response.missing_rates && response.missing_rates.length > 0) {
                setMissingRates(response.missing_rates);
                setIsModalOpen(true);
                message.warning({ content: 'Calculation complete with warnings', key: 'calc' });
            } else {
                message.success({ content: 'Calculation complete!', key: 'calc' });
                navigate('/dashboard');
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.detail || 'Calculation failed';
            message.error({ content: errorMsg, key: 'calc', duration: 10 });
        }
    };

    const handleModalOk = () => {
        setIsModalOpen(false);
        navigate('/dashboard');
    };

    const props = {
        beforeUpload: (file: File) => {
            const isValid = file.type === 'text/csv' ||
                file.type.includes('spreadsheet') ||
                file.name.endsWith('.csv') ||
                file.name.endsWith('.xlsx');
            if (!isValid) {
                message.error(`${file.name} is not a valid CSV or Excel file`);
            }
            return isValid || AntUpload.LIST_IGNORE;
        },
        customRequest: handleCustomRequest,
        maxCount: 1,
    };

    const previewColumns = [
        { title: 'Date', dataIndex: 'date', key: 'date' },
        { title: 'Operator', dataIndex: 'operator', key: 'operator' },
        { title: 'Machine', dataIndex: 'machine', key: 'machine' },
        { title: 'Part', dataIndex: 'part_number', key: 'part_number' },
        { title: 'Total Count', dataIndex: 'total_count', key: 'total_count' },
    ];

    return (
        <div>
            <Title level={2}>Upload Production Report</Title>
            <Paragraph>
                Upload your daily production report to calculate OEE metrics.
            </Paragraph>

            <Card style={{ marginBottom: 24 }}>
                <AntUpload {...props}>
                    <Button icon={<UploadOutlined />} loading={uploading}>Select Production File</Button>
                </AntUpload>
            </Card>

            {reportId && (
                <div style={{ marginTop: 24 }}>
                    <Title level={4}>Preview</Title>
                    <Table
                        dataSource={previewData}
                        columns={previewColumns}
                        pagination={false}
                        size="small"
                        style={{ marginBottom: 16 }}
                        rowKey={(record) => JSON.stringify(record)}
                    />
                    <Button
                        type="primary"
                        size="large"
                        icon={<CloudServerOutlined />}
                        onClick={handleCalculate}
                    >
                        Calculate OEE Metrics
                    </Button>
                </div>
            )}

            <Modal
                title="Missing Rate Data"
                open={isModalOpen}
                onOk={handleModalOk}
                onCancel={() => setIsModalOpen(false)}
                okText="Proceed to Dashboard"
                cancelText="Stay Here"
            >
                <div style={{ marginBottom: 16 }}>
                    <Text type="warning" strong>
                        The following items have no standard rate defined. Performance for these items will be 0%.
                    </Text>
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #f0f0f0', padding: '8px' }}>
                    <List
                        size="small"
                        dataSource={missingRates}
                        renderItem={(item) => (
                            <List.Item>
                                <Text code>{item}</Text>
                            </List.Item>
                        )}
                    />
                </div>
                <div style={{ marginTop: 16 }}>
                    <Text type="secondary">
                        Please go to "Master Rates" to add these rates for accurate calculations in the future.
                    </Text>
                </div>
            </Modal>
        </div>
    );
};

export default Upload;
