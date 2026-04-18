import { useEffect, useMemo, useState } from 'react';
import { useAppSelector } from '../../../app/hooks.js';
import {
  useCreateCommunicationThreadMutation,
  useGetCommunicationRecipientsQuery,
  useGetCommunicationThreadsQuery,
  useReplyCommunicationThreadMutation,
  useUpdateCommunicationThreadStateMutation,
} from '../../../services/internalCommunicationApi.js';
import '../Dashboard.css';
import './InternalCommunicationsPage.css';

const formatRoleLabel = (role) => {
  if (!role) return '';
  return role.replace(/-/g, ' ');
};

const formatContextLabel = (value) => {
  if (!value) {
    return '';
  }

  return value
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
};

const getCounterpart = (thread, currentUserId) =>
  (thread.participants ?? [])
    .find((participant) => String(participant.user?._id ?? participant.user) !== String(currentUserId))
    ?? null;

const getLastMessage = (thread) => {
  const messages = Array.isArray(thread?.messages) ? thread.messages : [];
  return messages[messages.length - 1] ?? null;
};

const matchesRecipientQuery = (query, recipient) => {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [recipient.name, recipient.email, recipient.role]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(normalized);
};

const InternalCommunicationsPage = () => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?.id ?? currentUser?._id;
  const [recipientId, setRecipientId] = useState('');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [showRecipientSuggestions, setShowRecipientSuggestions] = useState(false);
  const [composerGymId, setComposerGymId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [threadSearch, setThreadSearch] = useState('');
  const [threadGymFilter, setThreadGymFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [includeArchived, setIncludeArchived] = useState(false);

  const {
    data: recipientResponse,
    isLoading: recipientsLoading,
    refetch: refetchRecipients,
  } = useGetCommunicationRecipientsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const {
    data: threadResponse,
    isLoading: threadsLoading,
    isError,
    refetch: refetchThreads,
  } = useGetCommunicationThreadsQuery({
    search: threadSearch.trim() || undefined,
    gymId: threadGymFilter !== 'all' ? threadGymFilter : undefined,
    role: roleFilter !== 'all' ? roleFilter : undefined,
    includeArchived: includeArchived ? 'true' : undefined,
  }, {
    refetchOnMountOrArgChange: true,
  });
  const [createThread, { isLoading: isCreating }] = useCreateCommunicationThreadMutation();
  const [replyThread, { isLoading: isReplying }] = useReplyCommunicationThreadMutation();
  const [updateThreadState, { isLoading: isUpdatingState }] = useUpdateCommunicationThreadStateMutation();

  const recipients = recipientResponse?.data?.recipients ?? {};
  const ownedGyms = recipientResponse?.data?.ownedGyms ?? [];
  const threads = Array.isArray(threadResponse?.data) ? threadResponse.data : [];
  const normalizedRecipientQuery = recipientQuery.trim().toLowerCase();

  const refetchAll = () => {
    refetchRecipients();
    refetchThreads();
  };

  const recipientGroups = useMemo(() => {
    const groups = [];
    const managers = (recipients.managers ?? []).filter((recipient) => matchesRecipientQuery(normalizedRecipientQuery, recipient));
    const admins = (recipients.admins ?? []).filter((recipient) => matchesRecipientQuery(normalizedRecipientQuery, recipient));
    const owners = (recipients.owners ?? []).filter((recipient) => matchesRecipientQuery(normalizedRecipientQuery, recipient));

    if (managers.length) groups.push({ label: 'Managers', items: managers });
    if (admins.length) groups.push({ label: 'Admins', items: admins });
    if (owners.length) groups.push({ label: 'Gym Owners', items: owners });
    return groups;
  }, [normalizedRecipientQuery, recipients]);

  const recipientSuggestions = useMemo(
    () => recipientGroups.flatMap((group) =>
      group.items.map((recipient) => ({
        ...recipient,
        groupLabel: group.label,
      }))),
    [recipientGroups],
  );

  const selectedRecipient = useMemo(
    () => recipientSuggestions.find((recipient) => recipient.id === recipientId)
      ?? [...(recipients.managers ?? []), ...(recipients.admins ?? []), ...(recipients.owners ?? [])]
        .find((recipient) => recipient.id === recipientId)
      ?? null,
    [recipientId, recipientSuggestions, recipients],
  );

  const threadGymOptions = useMemo(() => {
    const map = new Map();
    [...ownedGyms, ...threads.flatMap((thread) => (thread.gym ? [{ id: thread.gym._id ?? thread.gym.id ?? thread.gym, name: thread.gym.name }] : []))]
      .forEach((gym) => {
        if (gym?.id && gym?.name) {
          map.set(String(gym.id), { id: String(gym.id), name: gym.name });
        }
      });
    return [...map.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [ownedGyms, threads]);

  const threadSummary = useMemo(
    () => threads.reduce((summary, thread) => {
      const lastMessage = getLastMessage(thread);
      const lastSenderId = String(lastMessage?.sender?._id ?? lastMessage?.sender ?? '');
      const isAwaitingReply = !thread.isArchived && lastMessage && lastSenderId !== String(currentUserId);

      return {
        total: summary.total + 1,
        unread: summary.unread + (thread.unreadCount ? 1 : 0),
        archived: summary.archived + (thread.isArchived ? 1 : 0),
        gymLinked: summary.gymLinked + (thread.gym?.name ? 1 : 0),
        awaitingReply: summary.awaitingReply + (isAwaitingReply ? 1 : 0),
      };
    }, {
      total: 0,
      unread: 0,
      archived: 0,
      gymLinked: 0,
      awaitingReply: 0,
    }),
    [threads, currentUserId],
  );

  const activeThread = useMemo(
    () => threads.find((thread) => String(thread._id) === String(selectedThreadId)) ?? threads[0] ?? null,
    [selectedThreadId, threads],
  );

  useEffect(() => {
    if (!activeThread) {
      setSelectedThreadId('');
      return;
    }
    setSelectedThreadId(String(activeThread._id));
  }, [activeThread?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeThread?._id || !activeThread.unreadCount) {
      return;
    }

    updateThreadState({ id: activeThread._id, read: true })
      .unwrap()
      .then(() => refetchThreads())
      .catch(() => undefined);
  }, [activeThread?._id, activeThread?.unreadCount, refetchThreads, updateThreadState]);

  const handleRecipientSelect = (recipient) => {
    setRecipientId(recipient.id);
    setRecipientQuery(recipient.name ?? recipient.email ?? '');
    setShowRecipientSuggestions(false);
  };

  const handleCreateThread = async (event) => {
    event.preventDefault();
    try {
      setNotice(null);
      setErrorNotice(null);
      const response = await createThread({
        recipientId,
        subject,
        body,
        gymId: composerGymId || undefined,
      }).unwrap();
      const createdThreadId = response?.data?._id ?? response?.data?.id ?? '';
      setRecipientId('');
      setRecipientQuery('');
      setShowRecipientSuggestions(false);
      setComposerGymId('');
      setSubject('');
      setBody('');
      setNotice('Conversation started successfully.');
      await refetchThreads();
      if (createdThreadId) {
        setSelectedThreadId(String(createdThreadId));
      }
    } catch (error) {
      setErrorNotice(error?.data?.message ?? 'Could not start the conversation.');
    }
  };

  const handleReply = async (threadId) => {
    const replyBody = replyDrafts[threadId]?.trim();
    if (!replyBody) {
      setErrorNotice('Reply message is required.');
      return;
    }

    try {
      setNotice(null);
      setErrorNotice(null);
      await replyThread({ id: threadId, body: replyBody }).unwrap();
      setReplyDrafts((prev) => ({ ...prev, [threadId]: '' }));
      setNotice('Reply sent successfully.');
      refetchThreads();
    } catch (error) {
      setErrorNotice(error?.data?.message ?? 'Could not send the reply.');
    }
  };

  const handleArchiveToggle = async (thread) => {
    try {
      setNotice(null);
      setErrorNotice(null);
      await updateThreadState({
        id: thread._id,
        archived: !thread.isArchived,
      }).unwrap();
      setNotice(thread.isArchived ? 'Thread reopened.' : 'Thread archived.');
      refetchThreads();
      if (!thread.isArchived && String(activeThread?._id) === String(thread._id)) {
        setSelectedThreadId('');
      }
    } catch (error) {
      setErrorNotice(error?.data?.message ?? 'Could not update the thread state.');
    }
  };

  if (recipientsLoading || threadsLoading) {
    return <div className="internal-communications__state">Loading communications...</div>;
  }

  if (isError) {
    return <div className="internal-communications__state internal-communications__state--error">Failed to load communications.</div>;
  }

  return (
    <div className="internal-communications">
      <header className="internal-communications__header">
        <div>
          <h1>Communications</h1>
          <p>Track unread threads, filter by gym or counterpart role, and archive closed loops without losing context.</p>
        </div>
        <button type="button" onClick={refetchAll} className="internal-communications__refresh">
          Refresh
        </button>
      </header>

      {(notice || errorNotice) ? (
        <div className={`internal-communications__banner ${errorNotice ? 'internal-communications__banner--error' : 'internal-communications__banner--success'}`}>
          {errorNotice || notice}
        </div>
      ) : null}

      <section className="internal-communications__summary">
        <div className="stat-grid">
          <div className="stat-card">
            <small>Total threads</small>
            <strong>{threadSummary.total}</strong>
            <small>Visible with the current filters</small>
          </div>
          <div className="stat-card">
            <small>Unread threads</small>
            <strong>{threadSummary.unread}</strong>
            <small>Need attention from your inbox</small>
          </div>
          <div className="stat-card">
            <small>Awaiting your reply</small>
            <strong>{threadSummary.awaitingReply}</strong>
            <small>Open loops where the last message came from the other side</small>
          </div>
          <div className="stat-card">
            <small>Gym-linked threads</small>
            <strong>{threadSummary.gymLinked}</strong>
            <small>{threadSummary.archived} archived for record keeping</small>
          </div>
        </div>
      </section>

      <section className="internal-communications__composer">
        <h2>Start a conversation</h2>
        <form onSubmit={handleCreateThread} className="internal-communications__form">
          <label>
            Search recipients
            <input
              value={recipientQuery}
              onChange={(event) => {
                setRecipientQuery(event.target.value);
                setShowRecipientSuggestions(true);
              }}
              onFocus={() => setShowRecipientSuggestions(true)}
              placeholder="Search by name, email, or role"
            />
            {showRecipientSuggestions && normalizedRecipientQuery ? (
              recipientSuggestions.length ? (
                <div className="internal-communications__suggestions" role="listbox" aria-label="Recipient suggestions">
                  {recipientSuggestions.slice(0, 8).map((recipient) => (
                    <button
                      key={recipient.id}
                      type="button"
                      className={`internal-communications__suggestion${recipient.id === recipientId ? ' internal-communications__suggestion--active' : ''}`}
                      onClick={() => handleRecipientSelect(recipient)}
                    >
                      <strong>{recipient.name}</strong>
                      <span>{recipient.email}</span>
                      <small>{recipient.groupLabel}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="internal-communications__suggestions internal-communications__suggestions--empty">
                  No matching recipients.
                </div>
              )
            ) : null}
          </label>

          <label>
            Recipient
            <select value={recipientId} onChange={(event) => setRecipientId(event.target.value)} required>
              <option value="">Select recipient</option>
              {recipientGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.items.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>
                      {recipient.name} ({recipient.email})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selectedRecipient ? (
              <small className="internal-communications__selected-recipient">
                Selected: {selectedRecipient.name} ({selectedRecipient.groupLabel ?? formatRoleLabel(selectedRecipient.role)})
              </small>
            ) : null}
          </label>

          {currentUser?.role === 'gym-owner' ? (
            <label>
              Gym context
              <select value={composerGymId} onChange={(event) => setComposerGymId(event.target.value)}>
                <option value="">No specific gym</option>
                {ownedGyms.map((gym) => (
                  <option key={gym.id} value={gym.id}>
                    {gym.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label>
            Subject
            <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={160} required />
          </label>

          <label className="internal-communications__form-field--wide">
            Message
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} required />
          </label>

          <button type="submit" disabled={isCreating || !recipientId || !subject.trim() || !body.trim()}>
            {isCreating ? 'Sending...' : 'Start conversation'}
          </button>
        </form>
      </section>

      <section className="internal-communications__threads">
        <div className="internal-communications__threads-header">
          <h2>Conversation history</h2>
          <div className="internal-communications__filters">
            <input
              value={threadSearch}
              onChange={(event) => setThreadSearch(event.target.value)}
              placeholder="Search subject, participant, gym, or message"
              aria-label="Search threads"
            />
            <select value={threadGymFilter} onChange={(event) => setThreadGymFilter(event.target.value)} aria-label="Filter by gym">
              <option value="all">All gyms</option>
              {threadGymOptions.map((gym) => (
                <option key={gym.id} value={gym.id}>{gym.name}</option>
              ))}
            </select>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role">
              <option value="all">All roles</option>
              <option value="admin">Admins</option>
              <option value="manager">Managers</option>
              <option value="gym-owner">Gym owners</option>
            </select>
            <label className="internal-communications__checkbox">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => setIncludeArchived(event.target.checked)}
              />
              <span>Show archived</span>
            </label>
          </div>
        </div>

        {threads.length ? (
          <div className="internal-communications__workspace">
            <aside className="internal-communications__thread-list">
              {threads.map((thread) => {
                const counterpart = getCounterpart(thread, currentUserId);
                const isActive = String(thread._id) === String(activeThread?._id);
                const lastMessage = getLastMessage(thread);
                const lastSenderId = String(lastMessage?.sender?._id ?? lastMessage?.sender ?? '');
                const awaitingReply = !thread.isArchived && lastMessage && lastSenderId !== String(currentUserId);

                return (
                  <button
                    key={thread._id}
                    type="button"
                    className={`internal-communications__thread-card${isActive ? ' internal-communications__thread-card--active' : ''}`}
                    onClick={() => setSelectedThreadId(String(thread._id))}
                  >
                    <div className="internal-communications__thread-card-top">
                      <strong>{thread.subject}</strong>
                      <small>{new Date(thread.lastMessageAt).toLocaleString()}</small>
                    </div>
                    <p className="internal-communications__thread-person">
                      {counterpart?.user?.name ?? 'Unknown'} ({formatRoleLabel(counterpart?.role) || 'unknown'})
                    </p>
                    <div className="internal-communications__thread-context">
                      {counterpart?.role ? (
                        <span className="internal-communications__pill">
                          {formatContextLabel(counterpart.role)}
                        </span>
                      ) : null}
                      {thread.category ? (
                        <span className="internal-communications__pill">
                          {formatContextLabel(thread.category)}
                        </span>
                      ) : null}
                      <span className="internal-communications__pill">
                        {thread.gym?.name ? `Gym: ${thread.gym.name}` : 'No gym context'}
                      </span>
                    </div>
                    <p className="internal-communications__thread-preview">
                      {lastMessage?.body || 'No message preview yet.'}
                    </p>
                    <div className="internal-communications__thread-card-meta">
                      {thread.unreadCount ? (
                        <span className="internal-communications__pill internal-communications__pill--unread">
                          {thread.unreadCount} unread
                        </span>
                      ) : (
                        <span className="internal-communications__pill">Read</span>
                      )}
                      {thread.isArchived ? (
                        <span className="internal-communications__pill internal-communications__pill--archived">Archived</span>
                      ) : null}
                      {awaitingReply ? (
                        <span className="internal-communications__pill internal-communications__pill--reply">Needs reply</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </aside>

            <div className="internal-communications__thread-panel">
              {activeThread ? (
                <>
                  <header className="internal-communications__thread-header">
                    <div>
                      <h3>{activeThread.subject}</h3>
                      <p>
                        With {getCounterpart(activeThread, currentUserId)?.user?.name ?? 'Unknown'}
                        {' '}
                        ({formatRoleLabel(getCounterpart(activeThread, currentUserId)?.role)})
                      </p>
                      <div className="internal-communications__thread-context">
                        {activeThread.category ? (
                          <span className="internal-communications__pill">
                            {formatContextLabel(activeThread.category)}
                          </span>
                        ) : null}
                        {activeThread.gym?.name ? (
                          <span className="internal-communications__pill">
                            Gym: {activeThread.gym.name}
                          </span>
                        ) : (
                          <span className="internal-communications__pill">No gym context</span>
                        )}
                        {activeThread.isArchived ? (
                          <span className="internal-communications__pill internal-communications__pill--archived">Archived</span>
                        ) : null}
                      </div>
                      <small>Last updated {new Date(activeThread.lastMessageAt).toLocaleString()}</small>
                    </div>
                    <div className="internal-communications__thread-actions">
                      <button
                        type="button"
                        className="internal-communications__refresh"
                        onClick={() => handleArchiveToggle(activeThread)}
                        disabled={isUpdatingState}
                      >
                        {activeThread.isArchived ? 'Reopen thread' : 'Archive thread'}
                      </button>
                    </div>
                  </header>

                  <div className="internal-communications__message-list">
                    {(activeThread.messages ?? []).map((message) => (
                      <div
                        key={message._id}
                        className={`internal-communications__message${
                          String(message.sender?._id ?? message.sender) === String(currentUserId)
                            ? ' internal-communications__message--self'
                            : ''
                        }`}
                      >
                        <strong>{message.sender?.name ?? 'Unknown'} ({formatRoleLabel(message.senderRole)})</strong>
                        <small>{new Date(message.createdAt).toLocaleString()}</small>
                        <p>{message.body}</p>
                      </div>
                    ))}
                  </div>

                  <div className="internal-communications__reply">
                    <textarea
                      value={replyDrafts[activeThread._id] ?? ''}
                      onChange={(event) => setReplyDrafts((prev) => ({ ...prev, [activeThread._id]: event.target.value }))}
                      rows={3}
                      placeholder={activeThread.isArchived ? 'Reopen this thread to reply' : 'Reply to this conversation'}
                      disabled={activeThread.isArchived}
                    />
                    <button
                      type="button"
                      onClick={() => handleReply(activeThread._id)}
                      disabled={isReplying || activeThread.isArchived}
                    >
                      {isReplying ? 'Sending...' : 'Reply'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="internal-communications__empty">No conversations yet.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="internal-communications__empty">No conversations match the current filters.</div>
        )}
      </section>
    </div>
  );
};

export default InternalCommunicationsPage;
