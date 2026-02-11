import React, { useState, useEffect } from 'react';
import { Typography, Upload as AntUpload, Button, message, Card, Table, Modal, List, Form, Input, InputNumber, Popconfirm, Tooltip, Space } from 'antd';
import { UploadOutlined, CloudServerOutlined, EditOutlined, DeleteOutlined, SaveOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { reportService } from '../services/api';
import { useNavigate, useSearchParams } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

interface EditableCellProps extends React.HTMLAttributes<HTMLElement> {
    editing: boolean;
    dataIndex: string;
    title: any;
    inputType: 'number' | 'text';
    record: any;
    index: number;
    children: React.ReactNode;
}

const EditableCell: React.FC<EditableCellProps> = ({
    editing,
    dataIndex,
    title,
    inputType,
    record,
    index,
    children,
    ...restProps
}) => {
    const inputNode = inputType === 'number' ? <InputNumber style={{ width: '100%' }} /> : <Input />;

    return (
        <td {...restProps}>
            {editing ? (
                <Form.Item
                    name={dataIndex}
                    style={{ margin: 0 }}
                    rules={[
                        {
                            required: true,
                            message: `Please Input ${title}!`,
                        },
                    ]}
                >
                    {inputNode}
                </Form.Item>
            ) : (
                children
            )}
        </td>
    );
};

const Upload: React.FC = () => {
    const [missingRates, setMissingRates] = useState<string[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [reportId, setReportId] = useState<number | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [editingKey, setEditingKey] = useState<any>('');
    const [highlightedRow, setHighlightedRow] = useState<any>(null);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [form] = Form.useForm();

    const isEditing = (record: any) => record.id === editingKey;

    useEffect(() => {
        const editId = searchParams.get('editReportId');
        if (editId) {
            const id = parseInt(editId);
            setReportId(id);
            fetchEntries(id);
        }
    }, [searchParams]);

    const edit = (record: Partial<any> & { id: React.Key }) => {
        form.setFieldsValue({ ...record });
        setEditingKey(record.id);
    };

    const cancel = () => {
        setEditingKey('');
        // If we cancel a new row, we might want to keep it or delete it? 
        // For now, standard cancel behavior.
    };

    const save = async (key: React.Key) => {
        try {
            const row = (await form.validateFields()) as any;
            const newData = [...data];
            const index = newData.findIndex((item) => item.id === key);

            if (index > -1) {
                const item = newData[index];
                const updatedItem = { ...item, ...row };

                // Optimistic update
                newData.splice(index, 1, updatedItem);
                setData(newData);
                setEditingKey('');
                setHighlightedRow(null); // Clear highlight on save

                // API Update
                try {
                    await reportService.updateReportEntry(item.id, row);
                    message.success('Entry updated');
                } catch (err) {
                    message.error('Failed to save changes');
                    // Revert? For now just show error
                }
            }
        } catch (errInfo) {
            console.log('Validate Failed:', errInfo);
        }
    };

    const handleAddRow = async () => {
        if (!reportId) return;
        try {
            const newEntry = await reportService.createReportEntry(reportId, {
                operator: "New Operator",
                machine: "New Machine",
                part_number: "Part-New",
                shift: "1",
                good_count: 0
            });
            message.success("New row added");
            // Prepend new Entry
            setData([newEntry, ...data]);
            // Automatically enter edit mode
            edit(newEntry);
            // Highlight it
            setHighlightedRow(newEntry.id);
        } catch (err) {
            message.error("Failed to add new entry");
        }
    };

    const handleDelete = async (key: React.Key) => {
        try {
            await reportService.deleteReportEntry(Number(key));
            message.success("Row deleted");
            setData(data.filter(item => item.id !== key));
        } catch (err) {
            message.error("Failed to delete entry");
        }
    };

    const fetchEntries = async (id: number) => {
        try {
            const entries = await reportService.getReportEntries(id);
            // Sort by ID descending (newest first) or preserve API order?
            // API usually returns by ID asc. Let's reverse it locally if needed, but user wants "new row at top".
            // If we prepend locally, it's at top. If we reload, it might go to bottom unless we sort.
            // Let's sort by ID descending for consistency.
            const sorted = [...entries].sort((a, b) => b.id - a.id);
            setData(sorted);
        } catch (error) {
            message.error("Failed to load report data");
        }
    };

    const handleCustomRequest = async (options: any) => {
        const { file, onSuccess, onError } = options;
        setUploading(true);
        try {
            const result = await reportService.uploadReport(file);
            message.success('Report uploaded successfully');
            setReportId(result.report_id);
            onSuccess(result, file);
            // Fetch verify editable data immediately
            fetchEntries(result.report_id);
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
        showUploadList: false, // We show the table instead
        maxCount: 1,
    };

    const columns = [
        { title: 'Date', dataIndex: 'date', key: 'date', editable: false, width: 100 },
        { title: 'Shift', dataIndex: 'shift', key: 'shift', editable: true, width: 90 },
        { title: 'Operator', dataIndex: 'operator', key: 'operator', editable: true, width: 140 },
        { title: 'Machine', dataIndex: 'machine', key: 'machine', editable: true, width: 90 },
        { title: 'Part Number', dataIndex: 'part_number', key: 'part_number', editable: true, width: 140 },
        { title: 'SO#', dataIndex: 'job', key: 'job', editable: true, width: 120 },
        { title: 'Good', dataIndex: 'good_count', key: 'good_count', editable: true, inputType: 'number', width: 80 },
        { title: 'Reject', dataIndex: 'reject_count', key: 'reject_count', editable: true, inputType: 'number', width: 80 },
        {
            title: 'Run (min)',
            dataIndex: 'run_time_min',
            key: 'run_time_min',
            editable: true,
            inputType: 'number',
            width: 100,
            render: (val: number) => val ? Number(val).toFixed(1) : '0.0'
        },
        {
            title: 'Down (min)',
            dataIndex: 'downtime_min',
            key: 'downtime_min',
            editable: true,
            inputType: 'number',
            width: 100,
            render: (val: number) => val ? Number(val).toFixed(1) : '0.0'
        },
        {
            title: 'Action',
            dataIndex: 'operation',
            width: 90,
            render: (_: any, record: any) => {
                const editable = isEditing(record);
                return editable ? (
                    <span>
                        <Typography.Link onClick={() => save(record.id)} style={{ marginRight: 8 }}>
                            <SaveOutlined />
                        </Typography.Link>
                        <Popconfirm title="Sure to cancel?" onConfirm={cancel}>
                            <a><CloseOutlined /></a>
                        </Popconfirm>
                    </span>
                ) : (
                    <Space>
                        <Typography.Link disabled={editingKey !== ''} onClick={() => edit(record)}>
                            <EditOutlined />
                        </Typography.Link>
                        <Popconfirm title="Delete this entry?" onConfirm={() => handleDelete(record.id)}>
                            <Typography.Link type="danger" disabled={editingKey !== ''}>
                                <DeleteOutlined />
                            </Typography.Link>
                        </Popconfirm>
                    </Space>
                );
            },
        },
    ];

    const mergedColumns = columns.map((col) => {
        if (!col.editable) {
            return col;
        }
        return {
            ...col,
            onCell: (record: any) => ({
                record,
                inputType: col.inputType === 'number' ? 'number' : 'text',
                dataIndex: col.dataIndex,
                title: col.title,
                editing: isEditing(record),
            }),
        };
    });

    return (
        <div>
            <Title level={2}>Upload Production Report</Title>
            <Paragraph>
                Upload a new report or edit report entries below.
            </Paragraph>

            <Card style={{ marginBottom: 24 }}>
                <AntUpload {...props}>
                    <Button icon={<UploadOutlined />} loading={uploading} type="primary">
                        {reportId ? 'Upload New File' : 'Select Production File'}
                    </Button>
                </AntUpload>
            </Card>

            {reportId && (
                <div style={{ marginTop: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Title level={4} style={{ margin: 0 }}>Review Data</Title>
                        <Space>
                            <Button
                                icon={<PlusOutlined />}
                                onClick={handleAddRow}
                            >
                                Add Entry
                            </Button>
                            <Button
                                type="primary"
                                size="large"
                                icon={<CloudServerOutlined />}
                                onClick={handleCalculate}
                                disabled={editingKey !== ''} // Disable while editing row
                            >
                                Confirm & Calculate
                            </Button>
                        </Space>
                    </div>

                    <Form form={form} component={false}>
                        <Table
                            components={{
                                body: {
                                    cell: EditableCell,
                                },
                            }}
                            dataSource={data}
                            columns={mergedColumns}
                            rowClassName={(record) => {
                                let className = 'editable-row';
                                if (record.id === highlightedRow) {
                                    className += ' highlight-row';
                                }
                                return className;
                            }}
                            pagination={{ pageSize: 50 }}
                            size="small"
                            scroll={{ x: 1200 }}
                            rowKey="id"
                        />
                    </Form>
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
                        The following items have no standard rate defined. Performance will be 0%.
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
                        Please go to "Master Rates" to add these rates.
                    </Text>
                </div>
            </Modal>
        </div>
    );
};

export default Upload;
