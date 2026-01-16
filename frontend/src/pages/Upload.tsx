import React, { useState } from 'react';
import { Typography, Upload as AntUpload, Button, message, Card, Table, Tag } from 'antd';
import { UploadOutlined, CloudServerOutlined } from '@ant-design/icons';
import { reportService } from '../services/api';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph } = Typography;

const Upload: React.FC = () => {
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
            message.error(errorMsg);
            onError(err);
        } finally {
            setUploading(false);
        }
    };

    const handleCalculate = async () => {
        if (!reportId) return;
        try {
            message.loading({ content: 'Calculating OEE metrics...', key: 'calc' });
            await reportService.calculateMetrics(reportId);
            message.success({ content: 'Calculation complete!', key: 'calc' });
            // Redirect to dashboard or show results
            navigate('/dashboard');
        } catch (err) {
            message.error({ content: 'Calculation failed', key: 'calc' });
        }
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
        </div>
    );
};

export default Upload;
