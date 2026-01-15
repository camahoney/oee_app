import React from 'react';
import { Typography, List } from 'antd';

const { Title } = Typography;

const Reports: React.FC = () => {
    return (
        <div>
            <Title level={2}>Reports</Title>
            <p>View past production reports and OEE analysis.</p>
            <List
                bordered
                dataSource={['Report 1', 'Report 2', 'Report 3']}
                renderItem={(item) => <List.Item>{item}</List.Item>}
            />
        </div>
    );
};

export default Reports;
