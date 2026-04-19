import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks.js';
import { useGetMyContactMessagesQuery, useReplyToMessageMutation } from '../../services/contactApi.js';
import contactBg from '../../assets/contact-support-team.png';
import './SupportHistoryPage.css';

const formatStatusLabel = (value) => String(value ?? '')
  .split('-')
  .filter(Boolean)
  .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
  .join(' ');

const formatPriorityLabel = (value) => {
  const normalized = String(value ?? 'normal').trim().toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatDateTime = (value) => {
  const timestamp = value ? new Date(value) : null;
  if (!timestamp || Number.isNaN(timestamp.getTime())) {
    return 'Date unavailable';
  }

  return timestamp.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const formatFileSize = (value) => {
  const size = Number(value ?? 0);
  if (!Number.isFinite(size) || size <= 0) {
    return '';
  }
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageAttachment = (attachment) => String(attachment?.mimeType ?? '').startsWith('image/');
const isVideoAttachment = (attachment) => String(attachment?.mimeType ?? '').startsWith('video/');

const SupportHistoryPage = () => {
  const user = useAppSelector((state) => state.auth.user);
  const currentUserId = String(user?._id ?? user?.id ?? '');
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyErrorByTicket, setReplyErrorByTicket] = useState({});
  const [activeReplyTicketId, setActiveReplyTicketId] = useState('');
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useGetMyContactMessagesQuery(undefined, {
    skip: !user,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const [replyToMessage] = useReplyToMessageMutation();

  const tickets = Array.isArray(data?.data?.messages) ? data.data.messages : [];
  const openCount = tickets.filter((ticket) => String(ticket?.status ?? '').toLowerCase() !== 'closed').length;
  const repliedCount = tickets.filter((ticket) => Array.isArray(ticket?.replies) && ticket.replies.length > 0).length;

  const handleReplySubmit = async (ticketId) => {
    const draft = String(replyDrafts[ticketId] ?? '').trim();

    if (!draft) {
      setReplyErrorByTicket((prev) => ({ ...prev, [ticketId]: 'Reply cannot be empty.' }));
      return;
    }

    setActiveReplyTicketId(ticketId);
    setReplyErrorByTicket((prev) => ({ ...prev, [ticketId]: '' }));

    try {
      await replyToMessage({ id: ticketId, message: draft }).unwrap();
      setReplyDrafts((prev) => ({ ...prev, [ticketId]: '' }));
    } catch (error) {
      setReplyErrorByTicket((prev) => ({
        ...prev,
        [ticketId]: error?.data?.message || 'Could not send your reply. Please try again.',
      }));
    } finally {
      setActiveReplyTicketId('');
    }
  };

  if (!user) {
    return (
      <div className="support-history" style={{ backgroundImage: `url(${contactBg})` }}>
        <div className="support-history__overlay" />
        <div className="support-history__container support-history__container--narrow">
          <div className="support-history__empty">
            <small>Support</small>
            <h1>Sign in to view your tickets.</h1>
            <p>Logged-in accounts can track ticket status and read replies from managers or admins here.</p>
            <div className="support-history__actions">
              <Link to="/auth/login" className="primary-button">Sign in</Link>
              <Link to="/support/new" className="secondary-button">Open new ticket</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="support-history" style={{ backgroundImage: `url(${contactBg})` }}>
      <div className="support-history__overlay" />
      <div className="support-history__container">
        <header className="support-history__header">
          <div>
            <small>Support</small>
            <h1>Your tickets and replies</h1>
            <p>Keep the conversation going here while the ticket is open. Admin and manager replies appear in this thread, and you can answer back until support closes it.</p>
          </div>
          <div className="support-history__actions">
            <button type="button" className="secondary-button" onClick={() => refetch()}>
              Refresh
            </button>
            <Link to="/support/new" className="primary-button">Open new ticket</Link>
          </div>
        </header>

        <section className="support-history__summary">
          <article>
            <small>Total tickets</small>
            <strong>{tickets.length}</strong>
          </article>
          <article>
            <small>Open tickets</small>
            <strong>{openCount}</strong>
          </article>
          <article>
            <small>Tickets with replies</small>
            <strong>{repliedCount}</strong>
          </article>
        </section>

        {isLoading ? (
          <div className="support-history__empty">
            <h2>Loading your support history...</h2>
          </div>
        ) : null}

        {isError ? (
          <div className="support-history__empty">
            <h2>We could not load your support tickets.</h2>
            <p>Try refreshing this page. If the issue persists, send a new contact request.</p>
          </div>
        ) : null}

        {!isLoading && !isError && !tickets.length ? (
          <div className="support-history__empty">
            <h2>No tracked tickets yet.</h2>
            <p>Submit the contact form while signed in and your ticket history will appear here.</p>
            <div className="support-history__actions">
              <Link to="/support/new" className="primary-button">Open new ticket</Link>
            </div>
          </div>
        ) : null}

        {!isLoading && !isError && tickets.length ? (
          <div className="support-history__list">
            {tickets.map((ticket) => {
              const ticketStatus = String(ticket.status ?? 'new').toLowerCase();
              const ticketClosed = ticketStatus === 'closed';

              return (
                <article key={ticket.id} className="support-ticket">
                  <div className="support-ticket__top">
                    <div>
                      <div className="support-ticket__eyebrow">
                        <span className={`support-ticket__pill support-ticket__pill--status-${ticketStatus}`}>
                          {formatStatusLabel(ticket.status || 'new')}
                        </span>
                        <span className={`support-ticket__pill support-ticket__pill--priority-${String(ticket.priority ?? 'normal').toLowerCase()}`}>
                          {formatPriorityLabel(ticket.priority)}
                        </span>
                        <span className="support-ticket__pill">{ticket.category || 'general'}</span>
                      </div>
                      <h2>{ticket.subject || 'Support request'}</h2>
                      <p className="support-ticket__meta">
                        Created {formatDateTime(ticket.createdAt)}
                        {ticket.gym?.name ? ` | Gym: ${ticket.gym.name}` : ''}
                      </p>
                    </div>
                    <div className="support-ticket__updated">
                      <small>Last updated</small>
                      <strong>{formatDateTime(ticket.updatedAt)}</strong>
                    </div>
                  </div>

                  <section className="support-ticket__section">
                    <small>Your message</small>
                    <p>{ticket.message}</p>
                  </section>

                  {ticket.attachments?.length ? (
                    <section className="support-ticket__section">
                      <small>Attachments</small>
                      <div className="support-ticket__attachments">
                        {ticket.attachments.map((attachment) => (
                          <a
                            key={attachment.id ?? `${ticket.id}-${attachment.filename}`}
                            href={attachment.url || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="support-ticket__attachment"
                          >
                            {isImageAttachment(attachment) ? (
                              <img src={attachment.url} alt={attachment.originalName} />
                            ) : null}
                            {isVideoAttachment(attachment) ? (
                              <video src={attachment.url} muted playsInline preload="metadata" />
                            ) : null}
                            {!isImageAttachment(attachment) && !isVideoAttachment(attachment) ? (
                              <div className="support-ticket__attachment-file">FILE</div>
                            ) : null}
                            <div className="support-ticket__attachment-meta">
                              <strong>{attachment.originalName}</strong>
                              <span>{formatFileSize(attachment.size) || 'Open file'}</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <section className="support-ticket__section">
                    <small>Conversation</small>
                    {ticket.replies?.length ? (
                      <div className="support-ticket__replies">
                        {ticket.replies.map((reply) => {
                          const replyAuthorId = String(reply.author?.id ?? '');
                          const isOwnReply = Boolean(currentUserId && replyAuthorId && currentUserId === replyAuthorId);
                          const replyRole = isOwnReply
                            ? 'Ticket owner'
                            : formatStatusLabel(reply.author?.role ?? reply.authorRole ?? 'support');

                          return (
                            <div
                              key={reply.id ?? `${ticket.id}-${reply.createdAt}`}
                              className={`support-ticket__reply ${isOwnReply ? 'support-ticket__reply--mine' : ''}`}
                            >
                              <div className="support-ticket__reply-meta">
                                <strong>{isOwnReply ? 'You' : reply.author?.name ?? formatStatusLabel(reply.authorRole || 'support')}</strong>
                                <span>{formatDateTime(reply.createdAt)}</span>
                              </div>
                              <div className="support-ticket__reply-role">{replyRole}</div>
                              <p>{reply.message}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="support-ticket__empty-replies">No replies yet. Support will respond here once the ticket is reviewed.</p>
                    )}
                  </section>

                  <section className="support-ticket__section">
                    <small>Reply</small>
                    {ticketClosed ? (
                      <p className="support-ticket__closed-note">
                        This ticket is closed. If you want to continue the discussion, open a new ticket.
                      </p>
                    ) : (
                      <div className="support-ticket__composer">
                        <p className="support-ticket__conversation-note">
                          This ticket stays open for replies from both you and support until staff closes it.
                        </p>
                        <textarea
                          value={replyDrafts[ticket.id] ?? ''}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setReplyDrafts((prev) => ({ ...prev, [ticket.id]: nextValue }));
                            setReplyErrorByTicket((prev) => ({ ...prev, [ticket.id]: '' }));
                          }}
                          placeholder="Write your reply to support"
                          rows={4}
                          disabled={Boolean(activeReplyTicketId)}
                        />
                        {replyErrorByTicket[ticket.id] ? (
                          <p className="support-ticket__composer-error">{replyErrorByTicket[ticket.id]}</p>
                        ) : null}
                        <div className="support-ticket__composer-actions">
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => handleReplySubmit(ticket.id)}
                            disabled={Boolean(activeReplyTicketId)}
                          >
                            {activeReplyTicketId === ticket.id ? 'Sending...' : 'Send reply'}
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SupportHistoryPage;
