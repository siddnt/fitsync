import { useState } from 'react';
import {
    useGetContactMessagesQuery,
    useUpdateMessageStatusMutation,
} from '../../../services/contactApi';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import '../Dashboard.css';
import './MessagesPage.css';

const MessagesPage = () => {
    const [statusFilter, setStatusFilter] = useState('');
    const { data, isLoading, isError, refetch } = useGetContactMessagesQuery({
        status: statusFilter || undefined,
    });
    const [updateMessageStatus] = useUpdateMessageStatusMutation();

    const handleStatusChange = async (id, newStatus) => {
        try {
            await updateMessageStatus({ id, status: newStatus }).unwrap();
        } catch (err) {
            console.error('Failed to update status:', err);
        }
    };

    const messages = data?.data || [];

    if (isLoading) {
        return (
            <div className="dashboard-grid dashboard-grid--stacked">
                <DashboardSection title="Contact Messages">
                    <SkeletonPanel lines={10} />
                </DashboardSection>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="dashboard-grid dashboard-grid--stacked">
                <DashboardSection
                    title="Contact Messages"
                    action={<button type="button" onClick={() => refetch()}>Retry</button>}
                >
                    <EmptyState message="Failed to load messages." />
                </DashboardSection>
            </div>
        );
    }

    return (
        <div className="dashboard-grid dashboard-grid--stacked">
            <div className="admin-page-header">
                <h1>Contact Messages</h1>
                <p>View and manage messages from the contact form. Mark messages as read or responded.</p>
            </div>

            <DashboardSection
                title="Messages"
                action={(
                    <div className="users-toolbar">
                        <select
                            className="inventory-toolbar__input inventory-toolbar__input--select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            aria-label="Filter by status"
                        >
                            <option value="">All statuses</option>
                            <option value="new">New</option>
                            <option value="read">Read</option>
                            <option value="responded">Responded</option>
                        </select>
                        <button type="button" className="users-toolbar__refresh" onClick={() => refetch()}>
                            Refresh
                        </button>
                    </div>
                )}
            >
                {messages.length === 0 ? (
                    <EmptyState message="No messages found." />
                ) : (
                    <div className="messages-list">
                        {messages.map((msg) => (
                            <div key={msg._id} className={`message-card ${msg.status}`}>
                                <div className="message-header">
                                    <div className="sender-info">
                                        <h3>{msg.name}</h3>
                                        <span className="email">{msg.email}</span>
                                    </div>
                                    <div className="message-meta">
                                        <span className="date">
                                            {new Date(msg.createdAt).toLocaleDateString()}
                                        </span>
                                        <select
                                            value={msg.status}
                                            onChange={(e) => handleStatusChange(msg._id, e.target.value)}
                                            className={`status-select status-${msg.status}`}
                                        >
                                            <option value="new">New</option>
                                            <option value="read">Read</option>
                                            <option value="responded">Responded</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="message-body">
                                    <p>{msg.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </DashboardSection>
        </div>
    );
};

export default MessagesPage;
