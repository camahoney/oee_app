import React from 'react';
import { Card, Input, Typography, Divider, Button, Space, message } from 'antd';
import { DownloadOutlined, ShareAltOutlined } from '@ant-design/icons';
import { ShiftNotes } from './types';

const { Title, Text } = Typography;
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
            title={<Title level={5} style={{ margin: 0 }}>Shift Notes</Title>}
            style={{ height: '100%' }}
            bodyStyle={{ padding: '16px' }}
        >
            <div style={{ marginBottom: 16, display: 'flex', gap: '8px' }}>
                <Button type="primary" icon={<ShareAltOutlined />} onClick={handleCopyLink} style={{ flex: 1 }}>Share Link</Button>
                <Button icon={<DownloadOutlined />} onClick={() => message.info('Click Print on your browser to save PDF.')} style={{ flex: 1 }}>Export</Button>
            </div>
            {/* Top Issues */}
            <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: '13px', display: 'block', marginBottom: 6 }}>Top Issues / Downtime causes:</Text>
                <TextArea
                    rows={4}
                    value={notes.topIssues}
                    onChange={e => onNotesChange({ topIssues: e.target.value })}
                    placeholder="Describe any major issues affecting production..."
                    style={{ marginTop: 8 }}
                />
            </div>

            {/* Material Shortages */}
            <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: '13px', display: 'block', marginBottom: 6 }}>Material Shortages:</Text>
                <TextArea
                    rows={3}
                    value={notes.materialShortages}
                    onChange={e => onNotesChange({ materialShortages: e.target.value })}
                    placeholder="List any parts or resins causing delays..."
                    style={{ marginTop: 8 }}
                />
            </div>

            <Divider />

            {/* Escalations */}
            <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: '13px', display: 'block', marginBottom: 6 }}>Escalations:</Text>
                <TextArea
                    rows={3}
                    value={notes.escalations}
                    onChange={e => onNotesChange({ escalations: e.target.value })}
                    placeholder="Items requiring management or cross-department attention..."
                    style={{ marginTop: 8 }}
                />
            </div>

            {/* Actions / Owners */}
            <div>
                <Text strong style={{ fontSize: '13px', display: 'block', marginBottom: 6 }}>Actions / Owners:</Text>
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
