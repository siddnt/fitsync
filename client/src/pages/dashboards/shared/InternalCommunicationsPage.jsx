import { useMemo, useState } from 'react';
import { useAppSelector } from '../../../app/hooks.js';
import {
  useCreateCommunicationThreadMutation,
  useGetCommunicationRecipientsQuery,
  useGetCommunicationThreadsQuery,
  useReplyCommunicationThreadMutation,
} from '../../../services/internalCommunicationApi.js';
import '../Dashboard.css';
import './InternalCommunicationsPage.css';

const formatRoleLabel = (role) => {
  if (!role) return '';
  return role.replace(/-/g, ' ');
};

const InternalCommunicationsPage = () => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?.id ?? currentUser?._id;
  const [recipientId, setRecipientId] = useState('');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [showRecipientSuggestions, setShowRecipientSuggestions] = useState(false);
  const [gymId, setGymId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

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
  } = useGetCommunicationThreadsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const [createThread, { isLoading: isCreating }] = useCreateCommunicationThreadMutation();
  const [replyThread, { isLoading: isReplying }] = useReplyCommunicationThreadMutation();

  const recipients = recipientResponse?.data?.recipients ?? {};
  const ownedGyms = recipientResponse?.data?.ownedGyms ?? [];
  const threads = threadResponse?.data ?? [];
  const normalizedRecipientQuery = recipientQuery.trim().toLowerCase();

  const refetchAll = () => {
    refetchRecipients();
    refetchThreads();
  };

  const recipientGroups = useMemo(() => {
    const groups = [];
    const filterItems = (items = []) => items.filter((recipient) => {
      if (!normalizedRecipientQuery) {
        return true;
      }
      const haystack = [recipient.name, recipient.email, recipient.role]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedRecipientQuery);
    });

    const managers = filterItems(recipients.managers);
    const admins = filterItems(recipients.admins);
    const owners = filterItems(recipients.owners);

    if (managers.length) {
      groups.push({ label: 'Managers', items: managers });
    }
    if (admins.length) {
      groups.push({ label: 'Admins', items: admins });
    }
    if (owners.length) {
      groups.push({ label: 'Gym Owners', items: owners });
    }
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
    () => recipientSuggestions.find((recipient) => recipient.id === recipientId) ?? null,
    [recipientId, recipientSuggestions],
  );

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
      await createThread({
        recipientId,
        subject,
        body,
        gymId: gymId || undefined,
      }).unwrap();
      setRecipientId('');
      setRecipientQuery('');
      setShowRecipientSuggestions(false);
      setGymId('');
      setSubject('');
      setBody('');
      setNotice('Conversation started successfully.');
      refetchAll();
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
      refetchAll();
    } catch (error) {
      setErrorNotice(error?.data?.message ?? 'Could not send the reply.');
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
          <p>Coordinate queries between gym owners, managers, and admins without using support tickets.</p>
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
                Selected: {selectedRecipient.name} ({selectedRecipient.groupLabel})
              </small>
            ) : null}
          </label>

          {currentUser?.role === 'gym-owner' ? (
            <label>
              Gym context
              <select value={gymId} onChange={(event) => setGymId(event.target.value)}>
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
        <h2>Conversation history</h2>
        {threads.length ? (
          <div className="internal-communications__thread-list">
            {threads.map((thread) => {
              const counterpart = (thread.participants ?? [])
                .map((participant) => participant.user)
                .find((participant) => String(participant?._id) !== String(currentUserId));

              return (
                <article key={thread._id} className="internal-communications__thread-card">
                  <header className="internal-communications__thread-header">
                    <div>
                      <h3>{thread.subject}</h3>
                      <p>
                        With {counterpart?.name ?? 'Unknown'} ({formatRoleLabel(counterpart?.role)})
                      </p>
                      {thread.gym?.name ? <small>Gym: {thread.gym.name}</small> : null}
                    </div>
                    <span>{new Date(thread.lastMessageAt).toLocaleString()}</span>
                  </header>

                  <div className="internal-communications__message-list">
                    {(thread.messages ?? []).map((message) => (
                      <div key={message._id} className="internal-communications__message">
                        <strong>{message.sender?.name ?? 'Unknown'} ({formatRoleLabel(message.senderRole)})</strong>
                        <small>{new Date(message.createdAt).toLocaleString()}</small>
                        <p>{message.body}</p>
                      </div>
                    ))}
                  </div>

                  <div className="internal-communications__reply">
                    <textarea
                      value={replyDrafts[thread._id] ?? ''}
                      onChange={(event) => setReplyDrafts((prev) => ({ ...prev, [thread._id]: event.target.value }))}
                      rows={3}
                      placeholder="Reply to this conversation"
                    />
                    <button type="button" onClick={() => handleReply(thread._id)} disabled={isReplying}>
                      {isReplying ? 'Sending...' : 'Reply'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="internal-communications__empty">No conversations yet.</div>
        )}
      </section>
    </div>
  );
};

export default InternalCommunicationsPage;
