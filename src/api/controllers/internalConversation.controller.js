import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import InternalConversation from '../../models/internalConversation.model.js';
import User from '../../models/user.model.js';
import Gym from '../../models/gym.model.js';
import { createNotification } from '../../services/notification.service.js';
import { recordAuditLog } from '../../services/audit.service.js';

const ALLOWED_ROLES = new Set(['gym-owner', 'manager', 'admin']);

const rolePairToCategory = (roleA, roleB) => {
  const roles = [roleA, roleB].sort().join(':');
  if (roles === 'gym-owner:manager') {
    return 'owner-manager';
  }
  if (roles === 'admin:gym-owner') {
    return 'owner-admin';
  }
  if (roles === 'admin:manager') {
    return 'admin-manager';
  }
  return null;
};

const dashboardLinkByRole = {
  admin: '/dashboard/admin/communications',
  manager: '/dashboard/manager/communications',
  'gym-owner': '/dashboard/gym-owner/communications',
};

const conversationPopulate = [
  { path: 'participants.user', select: 'name email role' },
  { path: 'messages.sender', select: 'name email role' },
  { path: 'gym', select: 'name' },
];

const ensureSupportedRole = (role) => {
  if (!ALLOWED_ROLES.has(role)) {
    throw new ApiError(403, 'Role is not allowed to use internal communications.');
  }
};

const normalizeBoolean = (value) => ['1', 'true', 'yes'].includes(String(value ?? '').trim().toLowerCase());

const getParticipantState = (conversation, userId) =>
  conversation?.participants?.find(
    (participant) => String(participant.user?._id ?? participant.user) === String(userId),
  ) ?? null;

const ensureConversationParticipant = (conversation, userId) => {
  const participant = getParticipantState(conversation, userId);
  if (!participant) {
    throw new ApiError(403, 'You are not part of this conversation.');
  }
  return participant;
};

const resolveOwnedGymId = async ({ gymId, ownerId }) => {
  if (!gymId) {
    return null;
  }

  const gym = await Gym.findOne({ _id: gymId, owner: ownerId }).select('_id name');
  if (!gym) {
    throw new ApiError(404, 'Gym not found for this owner.');
  }

  return gym._id;
};

const loadRecipientCandidates = async (role) => {
  if (role === 'gym-owner') {
    const [managers, admins] = await Promise.all([
      User.find({ role: 'manager', status: 'active' }).select('name email role').sort({ name: 1 }).lean(),
      User.find({ role: 'admin', status: 'active' }).select('name email role').sort({ name: 1 }).lean(),
    ]);

    return {
      managers: managers.map((user) => ({ id: user._id, name: user.name, email: user.email, role: user.role })),
      admins: admins.map((user) => ({ id: user._id, name: user.name, email: user.email, role: user.role })),
    };
  }

  if (role === 'manager') {
    const [owners, admins] = await Promise.all([
      User.find({ role: 'gym-owner', status: 'active' }).select('name email role').sort({ name: 1 }).lean(),
      User.find({ role: 'admin', status: 'active' }).select('name email role').sort({ name: 1 }).lean(),
    ]);
    return {
      owners: owners.map((user) => ({ id: user._id, name: user.name, email: user.email, role: user.role })),
      admins: admins.map((user) => ({ id: user._id, name: user.name, email: user.email, role: user.role })),
    };
  }

  const [owners, managers] = await Promise.all([
    User.find({ role: 'gym-owner', status: 'active' }).select('name email role').sort({ name: 1 }).lean(),
    User.find({ role: 'manager', status: 'active' }).select('name email role').sort({ name: 1 }).lean(),
  ]);
  return {
    owners: owners.map((user) => ({ id: user._id, name: user.name, email: user.email, role: user.role })),
    managers: managers.map((user) => ({ id: user._id, name: user.name, email: user.email, role: user.role })),
  };
};

export const getCommunicationRecipients = asyncHandler(async (req, res) => {
  ensureSupportedRole(req.user?.role);

  const recipients = await loadRecipientCandidates(req.user.role);
  const ownedGyms = req.user.role === 'gym-owner'
    ? await Gym.find({ owner: req.user._id }).select('name').sort({ name: 1 }).lean()
    : [];

  return res.status(200).json(new ApiResponse(200, {
    recipients,
    ownedGyms: ownedGyms.map((gym) => ({ id: gym._id, name: gym.name })),
  }, 'Communication recipients fetched successfully'));
});

export const listInternalConversations = asyncHandler(async (req, res) => {
  ensureSupportedRole(req.user?.role);

  const includeArchived = normalizeBoolean(req.query?.includeArchived);
  const gymId = String(req.query?.gymId || '').trim();
  const roleFilter = String(req.query?.role || '').trim().toLowerCase();
  const search = String(req.query?.search || '').trim().toLowerCase();

  const filter = {
    'participants.user': req.user._id,
  };

  if (gymId) {
    filter.gym = gymId;
  }

  const conversations = await InternalConversation.find(filter)
    .sort({ lastMessageAt: -1 })
    .populate(conversationPopulate)
    .lean();

  const filteredConversations = conversations.filter((conversation) => {
    const participantState = getParticipantState(conversation, req.user._id);
    if (!participantState) {
      return false;
    }

    const isArchived = Boolean(
      participantState.archivedAt
      && new Date(participantState.archivedAt).getTime() >= new Date(conversation.lastMessageAt).getTime(),
    );

    if (!includeArchived && isArchived) {
      return false;
    }

    if (roleFilter) {
      const counterpart = (conversation.participants ?? [])
        .find((participant) => String(participant.user?._id ?? participant.user) !== String(req.user._id));
      if (String(counterpart?.role || '').trim().toLowerCase() !== roleFilter) {
        return false;
      }
    }

    if (!search) {
      return true;
    }

    const haystacks = [
      conversation.subject,
      conversation.category,
      conversation.gym?.name,
      ...(conversation.messages ?? []).map((message) => message.body),
      ...(conversation.participants ?? []).flatMap((participant) => [
        participant.user?.name,
        participant.user?.email,
        participant.role,
      ]),
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    return haystacks.some((value) => value.includes(search));
  }).map((conversation) => {
    const participantState = getParticipantState(conversation, req.user._id);
    const lastReadAt = participantState?.lastReadAt ? new Date(participantState.lastReadAt) : null;
    const unreadCount = (conversation.messages ?? []).filter((message) => (
      String(message.sender?._id ?? message.sender) !== String(req.user._id)
      && (!lastReadAt || new Date(message.createdAt) > lastReadAt)
    )).length;
    const isArchived = Boolean(
      participantState?.archivedAt
      && new Date(participantState.archivedAt).getTime() >= new Date(conversation.lastMessageAt).getTime(),
    );

    return {
      ...conversation,
      isArchived,
      unreadCount,
      participantState: participantState
        ? {
            role: participantState.role,
            lastReadAt: participantState.lastReadAt ?? null,
            archivedAt: participantState.archivedAt ?? null,
          }
        : null,
    };
  });

  return res.status(200).json(new ApiResponse(200, filteredConversations, 'Internal conversations fetched successfully'));
});

export const createInternalConversation = asyncHandler(async (req, res) => {
  ensureSupportedRole(req.user?.role);

  const { recipientId, subject, body, gymId } = req.body ?? {};

  if (!recipientId || !subject?.trim() || !body?.trim()) {
    throw new ApiError(400, 'Recipient, subject, and message are required.');
  }

  const recipient = await User.findById(recipientId).select('name email role status');
  if (!recipient || recipient.status !== 'active') {
    throw new ApiError(404, 'Recipient not available.');
  }

  const category = rolePairToCategory(req.user.role, recipient.role);
  if (!category) {
    throw new ApiError(403, 'This communication pair is not allowed.');
  }

  const resolvedGymId = req.user.role === 'gym-owner'
    ? await resolveOwnedGymId({ gymId, ownerId: req.user._id })
    : null;

  const conversation = await InternalConversation.create({
    subject: subject.trim(),
    category,
    gym: resolvedGymId,
    participants: [
      { user: req.user._id, role: req.user.role, lastReadAt: new Date(), archivedAt: null },
      { user: recipient._id, role: recipient.role, lastReadAt: null, archivedAt: null },
    ],
    createdBy: req.user._id,
    lastMessageAt: new Date(),
    messages: [
      {
        sender: req.user._id,
        senderRole: req.user.role,
        body: body.trim(),
      },
    ],
  });

  await createNotification({
    user: recipient._id,
    type: 'internal-message',
    title: 'New internal message',
    message: `${req.user.name ?? 'A teammate'} sent you a message: ${subject.trim()}.`,
    metadata: { conversationId: conversation._id, category },
    link: dashboardLinkByRole[recipient.role] ?? '/dashboard',
  });

  await recordAuditLog({
    actor: req.user._id,
    actorRole: req.user.role,
    action: 'internal-conversation.created',
    entityType: 'internal-conversation',
    entityId: conversation._id,
    summary: 'Internal conversation created',
    metadata: { recipientId: recipient._id, category, gymId: resolvedGymId },
  });

  const populated = await InternalConversation.findById(conversation._id)
    .populate(conversationPopulate)
    .lean();

  return res.status(201).json(new ApiResponse(201, populated, 'Internal conversation created successfully'));
});

export const replyInternalConversation = asyncHandler(async (req, res) => {
  ensureSupportedRole(req.user?.role);

  const { id } = req.params;
  const { body } = req.body ?? {};

  if (!body?.trim()) {
    throw new ApiError(400, 'Reply message is required.');
  }

  const conversation = await InternalConversation.findById(id);
  if (!conversation) {
    throw new ApiError(404, 'Conversation not found.');
  }

  ensureConversationParticipant(conversation, req.user._id);

  conversation.messages.push({
    sender: req.user._id,
    senderRole: req.user.role,
    body: body.trim(),
  });
  const messageTimestamp = new Date();
  conversation.lastMessageAt = messageTimestamp;
  conversation.participants.forEach((participant) => {
    participant.archivedAt = null;
    if (String(participant.user) === String(req.user._id)) {
      participant.lastReadAt = messageTimestamp;
    }
  });
  await conversation.save();

  const recipients = conversation.participants.filter((participant) => String(participant.user) !== String(req.user._id));
  await Promise.all(
    recipients.map((participant) =>
      createNotification({
        user: participant.user,
        type: 'internal-message-reply',
        title: 'Internal message reply',
        message: `${req.user.name ?? 'A teammate'} replied to "${conversation.subject}".`,
        metadata: { conversationId: conversation._id, category: conversation.category },
        link: dashboardLinkByRole[participant.role] ?? '/dashboard',
      })),
  );

  await recordAuditLog({
    actor: req.user._id,
    actorRole: req.user.role,
    action: 'internal-conversation.replied',
    entityType: 'internal-conversation',
    entityId: conversation._id,
    summary: 'Internal conversation replied',
    metadata: { category: conversation.category },
  });

  const populated = await InternalConversation.findById(conversation._id)
    .populate(conversationPopulate)
    .lean();

  return res.status(200).json(new ApiResponse(200, populated, 'Reply sent successfully'));
});

export const updateInternalConversationState = asyncHandler(async (req, res) => {
  ensureSupportedRole(req.user?.role);

  const { id } = req.params;
  const { read = false, archived } = req.body ?? {};

  const conversation = await InternalConversation.findById(id);
  if (!conversation) {
    throw new ApiError(404, 'Conversation not found.');
  }

  ensureConversationParticipant(conversation, req.user._id);
  const timestamp = new Date();

  conversation.participants.forEach((participant) => {
    if (String(participant.user) !== String(req.user._id)) {
      return;
    }

    if (read) {
      participant.lastReadAt = timestamp;
    }

    if (typeof archived === 'boolean') {
      participant.archivedAt = archived ? timestamp : null;
    }
  });

  await conversation.save();

  await recordAuditLog({
    actor: req.user._id,
    actorRole: req.user.role,
    action: 'internal-conversation.state.updated',
    entityType: 'internal-conversation',
    entityId: conversation._id,
    summary: 'Internal conversation state updated',
    metadata: {
      read: Boolean(read),
      archived: typeof archived === 'boolean' ? archived : undefined,
    },
  });

  const populated = await InternalConversation.findById(conversation._id)
    .populate(conversationPopulate)
    .lean();

  return res.status(200).json(new ApiResponse(200, populated, 'Conversation state updated successfully.'));
});
