import { useState } from 'react';
import {
  useGetContactMessagesQuery,
  useUpdateMessageStatusMutation,
} from '../../../services/contactApi.js';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import '../Dashboard.css';

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
      console.error('Failed to update message status:', err);
    }
  };

  const messages = data?.data || [];

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Messages"><SkeletonPanel lines={8} /></DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Messages" action={<button type="button" onClick={() => refetch()}>Retry</button>}>
          <EmptyState message="Could not load messages." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <DashboardSection
        title="Contact Messages"
        action={
          <div className="users-toolbar">
            <select
              className="inventory-toolbar__input inventory-toolbar__input--select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All</option>
              <option value="new">New</option>
              <option value="read">Read</option>
              <option value="responded">Responded</option>
            </select>
            <button type="button" className="users-toolbar__refresh" onClick={() => refetch()}>
              Refresh
            </button>
          </div>
        }
      >
        {messages.length === 0 ? (
          <EmptyState message="No messages found." />
        ) : (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Sender</th>
                <th>Email</th>
                <th>Message</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((msg) => (
                <tr key={msg._id}>
                  <td><strong>{msg.name}</strong></td>
                  <td>{msg.email}</td>
                  <td className="message-cell">{msg.message}</td>
                  <td><small>{new Date(msg.createdAt).toLocaleDateString()}</small></td>
                  <td>
                    <select
                      value={msg.status}
                      onChange={(e) => handleStatusChange(msg._id, e.target.value)}
                      className="manager-status-select"
                      aria-label={`Update status for ${msg.name}`}
                    >
                      <option value="new">New</option>
                      <option value="read">Read</option>
                      <option value="responded">Responded</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DashboardSection>
    </div>
  );
};

export default MessagesPage;
