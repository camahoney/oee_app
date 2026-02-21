import React from 'react';
import { Card, Input, Typography, Divider, Button, Space, message } from 'antd';
import { DownloadOutlined, ShareAltOutlined } from '@ant-design/icons';
import { ShiftNotes } from './types';

const { Title } = Typography;
const { TextArea } = Input;

interface ShiftNotesPanelProps {
    notes: ShiftNotes;
    onNotesChange: (notes: Partial<ShiftNotes>) => void;
}

const ShiftNotesPanel: React.FC<ShiftNotesPanelProps> = ({ notes, onNotesChange }) => {

    const handleCopyLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            message.success('Link copied to clipboard!');
        });
    };

    return (
        <Card
            className="shift-notes-panel"
            title={<Title level={4} style={{ margin: 0 }}>Shift Notes</Title>}
            style={{ height: '100%' }}
            bodyStyle={{ padding: '24px' }}
        >
            <div style={{ marginBottom: 24, display: 'flex', gap: '8px' }}>
                <Button type="primary" icon={<ShareAltOutlined />} onClick={handleCopyLink} style={{ flex: 1 }}>Share Link</Button>
                <Button icon={<DownloadOutlined />} onClick={() => message.info('Click Print on your browser to save PDF.')} style={{ flex: 1 }}>Export</Button>
            </div>
            <div style={{ marginBottom: 24 }}>
                <Typography.Text strong>Top Issues / Downtime causes:</Typography.Text>
                <TextArea
                    rows={4}
                    value={notes.topIssues}
                    onChange={e => onNotesChange({ topIssues: e.target.value })}
                    placeholder="Describe any major issues affecting production..."
                    style={{ marginTop: 8 }}
                />
            </div>

            <div style={{ marginBottom: 24 }}>
                <Typography.Text strong>Material Shortages:</Typography.Text>
                <TextArea
                    rows={3}
                    value={notes.materialShortages}
                    onChange={e => onNotesChange({ materialShortages: e.target.value })}
                    placeholder="List any parts or resins causing delays..."
                    style={{ marginTop: 8 }}
                />
            </div>

            <Divider />

            <div style={{ marginBottom: 24 }}>
                <Typography.Text strong>Escalations:</Typography.Text>
                <TextArea
                    rows={3}
                    value={notes.escalations}
                    onChange={e => onNotesChange({ escalations: e.target.value })}
                    placeholder="Items requiring management or cross-department attention..."
                    style={{ marginTop: 8 }}
                />
            </div>

            <div>
                <Typography.Text strong>Actions / Owners:</Typography.Text>
                <TextArea
                    rows={4}
                    value={notes.actions}
                    onChange={e => onNotesChange({ actions: e.target.value })}
                    placeholder="Who is doing what by when..."
                    style={{ marginTop: 8 }}
                />
            </div>
        </Card>
    );
};

export default ShiftNotesPanel;
