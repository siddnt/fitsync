import { useMemo, useState } from 'react';
import { useAppSelector } from '../../../app/hooks.js';
import {
  useAssignMessageMutation,
  useGetContactMessagesQuery,
  useReplyToMessageMutation,
  useUpdateMessageStatusMutation,
} from '../../../services/contactApi';
import './MessagesPage.css';

const normalizePriority = (value) => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'medium') {
    return 'normal';
  }
  if (raw === 'urgent') {
    return 'high';
  }
  return ['low', 'normal', 'high'].includes(raw) ? raw : 'normal';
};

const formatTicketAge = (createdAt) => {
  const created = new Date(createdAt ?? 0).getTime();
  if (!created) {
    return 'Age unavailable';
  }

  const diffHours = Math.max(0, Math.floor((Date.now() - created) / (60 * 60 * 1000)));
  if (diffHours < 24) {
    return `${diffHours}h old`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d old`;
};

const deriveOrderReference = (message) => {
  const haystack = `${message?.subject ?? ''} ${message?.message ?? ''}`;
  const match = haystack.match(/FS-[A-Z0-9-]+/i);
  return match?.[0] ?? '';
};

const isClosedTicket = (message) => String(message?.status ?? '').trim().toLowerCase() === 'closed';

const MessagesPage = () => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [statusDrafts, setStatusDrafts] = useState({});
  const [priorityDrafts, setPriorityDrafts] = useState({});
  const [internalNotesDrafts, setInternalNotesDrafts] = useState({});
  const [assignmentOverrides, setAssignmentOverrides] = useState({});

  const { data, isLoading, isError, refetch } = useGetContactMessagesQuery({
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
  });

  const [updateMessageStatus, { isLoading: isUpdatingStatus }] = useUpdateMessageStatusMutation();
  const [assignMessage, { isLoading: isAssigning }] = useAssignMessageMutation();
  const [replyToMessage, { isLoading: isReplying }] = useReplyToMessageMutation();

  const messages = data?.data || [];
  const statusCounts = useMemo(() => messages.reduce((acc, message) => {
    const key = message.status || 'new';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {}), [messages]);

  const handleStatusChange = async (id) => {
    try {
      setNotice(null);
      setErrorNotice(null);
      await updateMessageStatus({
        id,
        status: statusDrafts[id],
        priority: priorityDrafts[id],
        internalNotes: internalNotesDrafts[id],
      }).unwrap();
      setNotice('Ticket details updated.');
      refetch();
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Failed to update the support ticket.');
    }
  };

  const handleAssignToMe = async (id) => {
    const currentUserId = currentUser?.id ?? currentUser?._id;

    if (!currentUserId) {
      setErrorNotice('You need to be signed in to assign tickets.');
      return;
    }

    try {
      setNotice(null);
      setErrorNotice(null);
      const response = await assignMessage({
        id,
        assignedTo: currentUserId,
        status: 'in-progress',
      }).unwrap();
      setAssignmentOverrides((prev) => ({
        ...prev,
        [id]: response?.data?.assignedTo
          ? {
              name: response.data.assignedTo.name,
              email: response.data.assignedTo.email,
              role: response.data.assignedTo.role,
            }
          : {
              name: currentUser?.name ?? 'You',
              email: currentUser?.email ?? '',
              role: currentUser?.role ?? 'admin',
            },
      }));
      setNotice('Ticket assigned to you.');
      refetch();
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Failed to assign the ticket.');
    }
  };

  const handleReply = async (id, closeAfterReply = false) => {
    const message = replyDrafts[id]?.trim();
    if (!message) {
      setErrorNotice('Reply message is required.');
      return;
    }

    try {
      setNotice(null);
      setErrorNotice(null);
      await replyToMessage({
        id,
        message,
        closeAfterReply,
      }).unwrap();
      setReplyDrafts((prev) => ({ ...prev, [id]: '' }));
      setNotice(closeAfterReply ? 'Reply sent and ticket closed.' : 'Reply added to ticket.');
      refetch();
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Failed to send the reply.');
    }
  };

  if (isLoading) return <div className="loading">Loading messages...</div>;
  if (isError) return <div className="error">Failed to load messages.</div>;

  return (
    <div className="messages-page">
      <div className="messages-header">
        <div>
          <h1>Support Inbox</h1>
          <p className="messages-subtitle">Track assignment, reply history, and ticket priority in one place.</p>
        </div>
        <div className="filter-group">
          <label htmlFor="status-filter">Status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="new">New</option>
            <option value="read">Read</option>
            <option value="in-progress">In Progress</option>
            <option value="responded">Responded</option>
            <option value="closed">Closed</option>
          </select>
          <label htmlFor="priority-filter">Priority</label>
          <select
            id="priority-filter"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
          <button type="button" className="messages-refresh" onClick={() => refetch()}>
            Refresh
          </button>
        </div>
      </div>

      <div className="messages-summary">
        <span>{messages.length} tickets</span>
        <span>{statusCounts.new ?? 0} new</span>
        <span>{statusCounts['in-progress'] ?? 0} in progress</span>
        <span>{statusCounts.responded ?? 0} responded</span>
      </div>

      {(notice || errorNotice) ? (
        <div className={`messages-banner ${errorNotice ? 'messages-banner--error' : 'messages-banner--success'}`}>
          {errorNotice || notice}
        </div>
      ) : null}

      <div className="messages-list">
        {messages.length === 0 ? (
          <p className="no-messages">No messages found.</p>
        ) : (
          messages.map((msg) => {
            const draftStatus = statusDrafts[msg._id] ?? msg.status ?? 'new';
            const normalizedPriority = normalizePriority(msg.priority);
            const draftPriority = priorityDrafts[msg._id] ?? normalizedPriority;
            const draftNotes = internalNotesDrafts[msg._id] ?? msg.internalNotes ?? '';
            const replyDraft = replyDrafts[msg._id] ?? '';
            const resolvedAssignee = assignmentOverrides[msg._id] ?? msg.assignedTo ?? null;
            const orderReference = deriveOrderReference(msg);
            const ticketClosed = isClosedTicket(msg);

            return (
              <div key={msg._id} className={`message-card ${msg.status}`}>
                <div className="message-header">
                  <div className="sender-info">
                    <h3>{msg.subject || msg.name}</h3>
                    <span className="email">{msg.email}</span>
                    <div className="message-tags">
                      <span className={`ticket-pill ticket-pill--${normalizedPriority}`}>
                        {normalizedPriority}
                      </span>
                      <span className="ticket-pill">{msg.category || 'general'}</span>
                      <span className={`ticket-pill ticket-pill--status-${(msg.status || 'new').replace(/\s+/g, '-')}`}>
                        {msg.status || 'new'}
                      </span>
                    </div>
                  </div>
                  <div className="message-meta">
                    <span className="date">
                      {new Date(msg.createdAt).toLocaleDateString()}
                    </span>
                    <small>{formatTicketAge(msg.createdAt)}</small>
                    {msg.gym?.name ? (
                      <small>Gym: {msg.gym.name}</small>
                    ) : null}
                    {orderReference ? (
                      <small>Order: {orderReference}</small>
                    ) : null}
                    <small>
                      Assigned to {resolvedAssignee?.name || 'Unassigned'}
                    </small>
                    <button
                      type="button"
                      className="messages-action"
                      onClick={() => handleAssignToMe(msg._id)}
                      disabled={isAssigning || ticketClosed}
                    >
                      {ticketClosed ? 'Closed ticket' : isAssigning ? 'Assigning...' : 'Assign to me'}
                    </button>
                  </div>
                </div>

                <div className="message-body">
                  <p>{msg.message}</p>
                  <div className="message-context">
                    <span>Category: {msg.category || 'general'}</span>
                    <span>Priority: {normalizedPriority}</span>
                    <span>Status: {msg.status || 'new'}</span>
                    <span>{msg.gym?.name ? `Gym context: ${msg.gym.name}` : 'No gym context'}</span>
                  </div>
                  {msg.attachments?.length ? (
                    <div className="message-attachments">
                      {msg.attachments.map((attachment) => (
                        <span key={`${msg._id}-${attachment.filename || attachment.originalName}`} className="ticket-pill">
                          {attachment.originalName || attachment.filename || 'Attachment'}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="message-controls">
                  <div className="message-control-group">
                    <label htmlFor={`status-${msg._id}`}>Status</label>
                    <select
                      id={`status-${msg._id}`}
                      value={draftStatus}
                      onChange={(event) => setStatusDrafts((prev) => ({ ...prev, [msg._id]: event.target.value }))}
                      disabled={ticketClosed}
                    >
                      <option value="new">New</option>
                      <option value="read">Read</option>
                      <option value="in-progress">In Progress</option>
                      <option value="responded">Responded</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  <div className="message-control-group">
                    <label htmlFor={`priority-${msg._id}`}>Priority</label>
                    <select
                      id={`priority-${msg._id}`}
                      value={draftPriority}
                      onChange={(event) => setPriorityDrafts((prev) => ({ ...prev, [msg._id]: event.target.value }))}
                      disabled={ticketClosed}
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div className="message-control-group message-control-group--wide">
                    <label htmlFor={`notes-${msg._id}`}>Internal notes</label>
                    <textarea
                      id={`notes-${msg._id}`}
                      value={draftNotes}
                      onChange={(event) => setInternalNotesDrafts((prev) => ({ ...prev, [msg._id]: event.target.value }))}
                      placeholder={ticketClosed ? 'Closed tickets are locked.' : 'Optional internal handoff notes'}
                      disabled={ticketClosed}
                    />
                  </div>

                  <button
                    type="button"
                    className="messages-action"
                    onClick={() => handleStatusChange(msg._id)}
                    disabled={isUpdatingStatus || ticketClosed}
                  >
                    {ticketClosed ? 'Ticket locked' : isUpdatingStatus ? 'Saving...' : 'Save ticket'}
                  </button>
                </div>

                {ticketClosed ? (
                  <p className="messages-closed-note">
                    This ticket is closed. To continue the discussion, the user must open a new support ticket.
                  </p>
                ) : null}

                <div className="message-replies">
                  <h4>Replies</h4>
                  {msg.replies?.length ? (
                    <ul>
                      {msg.replies.map((reply) => (
                        <li key={`${msg._id}-${reply.createdAt}-${reply.message.slice(0, 12)}`}>
                          <strong>{reply.author?.name ?? reply.authorRole ?? 'admin'}</strong>
                          <span>{new Date(reply.createdAt).toLocaleString()}</span>
                          <span>{reply.author?.email ?? reply.authorRole ?? 'Support team'}</span>
                          <p>{reply.message}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="messages-empty-replies">No replies yet.</p>
                  )}
                </div>

                <div className="message-reply-composer">
                  <label htmlFor={`reply-${msg._id}`}>Reply</label>
                  <textarea
                    id={`reply-${msg._id}`}
                    value={replyDraft}
                    onChange={(event) => setReplyDrafts((prev) => ({ ...prev, [msg._id]: event.target.value }))}
                    placeholder={ticketClosed ? 'Closed tickets cannot be replied to.' : 'Write an internal or customer-facing response'}
                    disabled={ticketClosed}
                  />
                  <div className="message-reply-actions">
                    <button
                      type="button"
                      className="messages-action"
                      onClick={() => handleReply(msg._id, false)}
                      disabled={isReplying || ticketClosed}
                    >
                      {ticketClosed ? 'Ticket closed' : isReplying ? 'Sending...' : 'Reply'}
                    </button>
                    <button
                      type="button"
                      className="messages-action messages-action--secondary"
                      onClick={() => handleReply(msg._id, true)}
                      disabled={isReplying || ticketClosed}
                    >
                      {ticketClosed ? 'Already closed' : isReplying ? 'Closing...' : 'Reply and close'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
