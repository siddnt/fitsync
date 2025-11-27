import { useState } from 'react';
import {
    useGetContactMessagesQuery,
    useUpdateMessageStatusMutation,
} from '../../../services/contactApi';
import './MessagesPage.css';

const MessagesPage = () => {
    const [statusFilter, setStatusFilter] = useState('');
    const { data, isLoading, isError } = useGetContactMessagesQuery({
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

    if (isLoading) return <div className="loading">Loading messages...</div>;
    if (isError) return <div className="error">Failed to load messages.</div>;

    return (
        <div className="messages-page">
            <div className="messages-header">
                <h1>Contact Messages</h1>
                <div className="filter-group">
                    <label htmlFor="status-filter">Filter by Status:</label>
                    <select
                        id="status-filter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">All</option>
                        <option value="new">New</option>
                        <option value="read">Read</option>
                        <option value="responded">Responded</option>
                    </select>
                </div>
            </div>

            <div className="messages-list">
                {messages.length === 0 ? (
                    <p className="no-messages">No messages found.</p>
                ) : (
                    messages.map((msg) => (
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
                    ))
                )}
            </div>
        </div>
    );
};

export default MessagesPage;
