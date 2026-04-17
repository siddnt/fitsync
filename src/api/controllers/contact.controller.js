import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import Contact from '../../models/contact.model.js';
import Gym from '../../models/gym.model.js';
import User from '../../models/user.model.js';
import { recordAuditLog } from '../../services/audit.service.js';
import { createNotification } from '../../services/notification.service.js';

const MANAGER_OPEN_STATUSES = ['new', 'read', 'in-progress', 'responded'];
const SUPPORT_ASSIGNEE_ROLES = new Set(['admin', 'manager']);

const resolveSupportNotificationLink = (role) => {
  if (role === 'manager') {
    return '/dashboard/manager/messages';
  }

  if (role === 'admin') {
    return '/dashboard/admin/messages';
  }

  return '/dashboard';
};

const resolveOptionalGymId = async (gymId) => {
  if (!gymId) {
    return null;
  }

  const gym = await Gym.findById(gymId).select('_id');
  if (!gym) {
    throw new ApiError(404, 'Gym not found');
  }

  return gym._id;
};

const resolveLeastBurdenedManagerId = async () => {
  const managers = await User.find({ role: 'manager', status: 'active' })
    .select('_id createdAt')
    .sort({ createdAt: 1 })
    .lean();

  if (!managers.length) {
    throw new ApiError(409, 'No active managers are available to receive this ticket.');
  }

  const managerIds = managers.map((manager) => manager._id);
  const workloads = await Contact.aggregate([
    {
      $match: {
        assignedTo: { $in: managerIds },
        status: { $in: MANAGER_OPEN_STATUSES },
      },
    },
    {
      $group: {
        _id: '$assignedTo',
        openTickets: { $sum: 1 },
      },
    },
  ]);

  const workloadByManager = workloads.reduce((acc, entry) => {
    acc[String(entry._id)] = entry.openTickets;
    return acc;
  }, {});

  const selectedManager = managers.reduce((best, manager) => {
    const currentLoad = workloadByManager[String(manager._id)] ?? 0;

    if (!best || currentLoad < best.load) {
      return { id: manager._id, load: currentLoad, createdAt: manager.createdAt };
    }

    if (currentLoad === best.load && new Date(manager.createdAt) < new Date(best.createdAt)) {
      return { id: manager._id, load: currentLoad, createdAt: manager.createdAt };
    }

    return best;
  }, null);

  return selectedManager?.id ?? null;
};

const ensureManagerOwnsContact = (contact, user, actionLabel = 'manage this support ticket') => {
  if (user?.role !== 'manager') {
    return;
  }

  const assignedTo = String(contact?.assignedTo?._id ?? contact?.assignedTo ?? '').trim();
  if (assignedTo && assignedTo === String(user?._id)) {
    return;
  }

  throw new ApiError(403, `Managers can only ${actionLabel} when the ticket is assigned to them.`);
};

const resolveSupportAssignee = async (assignedTo) => {
  if (!assignedTo) {
    throw new ApiError(400, 'Assigned user is required.');
  }

  const assignee = await User.findById(assignedTo).select('_id role status name email');
  if (!assignee) {
    throw new ApiError(404, 'Assigned user not found.');
  }

  if (!SUPPORT_ASSIGNEE_ROLES.has(assignee.role)) {
    throw new ApiError(400, 'Support tickets can only be assigned to administrators or managers.');
  }

  if (assignee.status !== 'active') {
    throw new ApiError(400, 'Support tickets can only be assigned to active support staff.');
  }

  return assignee;
};

const rebalanceUnassignedTickets = async () => {
  const managers = await User.find({ role: 'manager', status: 'active' })
    .select('_id createdAt')
    .sort({ createdAt: 1 })
    .lean();

  if (!managers.length) {
    return;
  }

  const managerIds = managers.map((manager) => manager._id);
  const [workloads, unassignedTickets] = await Promise.all([
    Contact.aggregate([
      {
        $match: {
          assignedTo: { $in: managerIds },
          status: { $in: MANAGER_OPEN_STATUSES },
        },
      },
      {
        $group: {
          _id: '$assignedTo',
          openTickets: { $sum: 1 },
        },
      },
    ]),
    Contact.find({
      assignedTo: null,
      status: { $in: MANAGER_OPEN_STATUSES },
    })
      .sort({ createdAt: 1 })
      .select('_id')
      .lean(),
  ]);

  if (!unassignedTickets.length) {
    return;
  }

  const workloadByManager = workloads.reduce((acc, entry) => {
    acc[String(entry._id)] = entry.openTickets;
    return acc;
  }, {});

  managers.forEach((manager) => {
    const key = String(manager._id);
    if (!Object.prototype.hasOwnProperty.call(workloadByManager, key)) {
      workloadByManager[key] = 0;
    }
  });

  const updates = [];

  unassignedTickets.forEach((ticket) => {
    const selectedManager = managers.reduce((best, manager) => {
      const currentLoad = workloadByManager[String(manager._id)] ?? 0;

      if (!best || currentLoad < best.load) {
        return { id: manager._id, load: currentLoad, createdAt: manager.createdAt };
      }

      if (currentLoad === best.load && new Date(manager.createdAt) < new Date(best.createdAt)) {
        return { id: manager._id, load: currentLoad, createdAt: manager.createdAt };
      }

      return best;
    }, null);

    if (!selectedManager?.id) {
      return;
    }

    updates.push({
      updateOne: {
        filter: { _id: ticket._id, assignedTo: null },
        update: {
          $set: {
            assignedTo: selectedManager.id,
            status: 'in-progress',
          },
        },
      },
    });

    workloadByManager[String(selectedManager.id)] = (workloadByManager[String(selectedManager.id)] ?? 0) + 1;
  });

  if (updates.length) {
    await Contact.bulkWrite(updates, { ordered: true });
  }
};

export const submitContactForm = asyncHandler(async (req, res) => {
  const { name, email, message, subject, category, priority, gymId } = req.body;

  if (!name || !email || !message) {
    throw new ApiError(400, 'All fields are required');
  }

  const resolvedGymId = await resolveOptionalGymId(gymId);
  const assignedManagerId = await resolveLeastBurdenedManagerId();

  const contact = await Contact.create({
    name,
    email,
    subject,
    category,
    priority,
    assignedTo: assignedManagerId,
    status: 'in-progress',
    gym: resolvedGymId,
    message,
  });

  await createNotification({
    user: assignedManagerId,
    type: 'support-assigned',
    title: 'Support ticket assigned',
    message: `A support ticket from ${name} has been assigned to you.`,
    metadata: { contactId: contact._id },
    link: '/dashboard/manager/messages',
  });

  await recordAuditLog({
    actor: req.user?._id ?? null,
    actorRole: req.user?.role ?? 'system',
    action: 'support.auto_assigned',
    entityType: 'contact',
    entityId: contact._id,
    summary: 'Support ticket auto-assigned on creation',
    metadata: {
      assignedTo: assignedManagerId,
      gymId: resolvedGymId,
      strategy: 'least-burdened-manager',
    },
  });

  return res
    .status(201)
    .json(new ApiResponse(201, contact, 'Message sent successfully'));
});

export const getContactMessages = asyncHandler(async (req, res) => {
  await rebalanceUnassignedTickets();

  const { status, priority, assignedTo, gymId } = req.query;
  const filter = status ? { status } : {};
  if (priority) {
    filter.priority = priority;
  }
  if (assignedTo) {
    filter.assignedTo = assignedTo;
  }
  if (gymId) {
    filter.gym = gymId;
  }
  if (req.user?.role === 'manager') {
    filter.assignedTo = req.user?._id;
  }

  const messages = await Contact.find(filter)
    .sort({ createdAt: -1 })
    .populate({ path: 'assignedTo', select: 'name email role' })
    .populate({
      path: 'gym',
      select: 'name owner',
      populate: { path: 'owner', select: 'name email role' },
    });

  return res
    .status(200)
    .json(new ApiResponse(200, messages, 'Messages fetched successfully'));
});

export const updateMessageStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, priority, internalNotes } = req.body;

  if (status && !['new', 'read', 'in-progress', 'responded', 'closed'].includes(status)) {
    throw new ApiError(400, 'Invalid status');
  }

  const existingMessage = await Contact.findById(id).select('_id assignedTo');

  if (!existingMessage) {
    throw new ApiError(404, 'Message not found');
  }

  ensureManagerOwnsContact(existingMessage, req.user, 'update this support ticket');

  const message = await Contact.findByIdAndUpdate(
    id,
    {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(internalNotes !== undefined ? { internalNotes } : {}),
    },
    { new: true }
  );

  await recordAuditLog({
    actor: req.user?._id,
    actorRole: req.user?.role,
    action: 'support.status.updated',
    entityType: 'contact',
    entityId: message._id,
    summary: `Support ticket moved to ${message.status}`,
    metadata: { priority: message.priority },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, message, 'Message status updated successfully'));
});

export const assignMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { assignedTo, status = 'in-progress', gymId, autoAssignManager = false } = req.body ?? {};
  const resolvedGymId = await resolveOptionalGymId(gymId);
  const existingMessage = await Contact.findById(id).select('_id assignedTo');

  if (!existingMessage) {
    throw new ApiError(404, 'Message not found');
  }

  if (req.user?.role === 'manager') {
    const currentAssignee = String(existingMessage.assignedTo ?? '').trim();
    if (currentAssignee && currentAssignee !== String(req.user?._id)) {
      throw new ApiError(403, 'Managers can only assign tickets that are already assigned to them.');
    }
  }

  const resolvedAssignee = autoAssignManager
    ? await resolveSupportAssignee(await resolveLeastBurdenedManagerId())
    : await resolveSupportAssignee(assignedTo);

  if (req.user?.role === 'manager' && String(resolvedAssignee._id) !== String(req.user?._id)) {
    throw new ApiError(403, 'Managers can only assign support tickets to themselves.');
  }

  const message = await Contact.findByIdAndUpdate(
    id,
    { $set: { assignedTo: resolvedAssignee._id, status, ...(resolvedGymId ? { gym: resolvedGymId } : {}) } },
    { new: true },
  )
    .populate({ path: 'assignedTo', select: 'name email role' })
    .populate({
      path: 'gym',
      select: 'name owner',
      populate: { path: 'owner', select: 'name email role' },
    });

  await recordAuditLog({
    actor: req.user?._id,
    actorRole: req.user?.role,
    action: 'support.assigned',
    entityType: 'contact',
    entityId: message._id,
    summary: autoAssignManager ? 'Support ticket auto-assigned to least-burdened manager' : 'Support ticket assigned',
    metadata: {
      assignedTo: resolvedAssignee._id,
      gymId: resolvedGymId ?? message.gym?._id ?? null,
      strategy: autoAssignManager ? 'least-burdened-manager' : 'manual',
    },
  });

  if (resolvedAssignee?._id) {
    await createNotification({
      user: resolvedAssignee._id,
      type: 'support-assigned',
      title: 'Support ticket assigned',
      message: `A support ticket from ${message.name} has been assigned to you.`,
      metadata: { contactId: message._id },
      link: resolveSupportNotificationLink(resolvedAssignee.role),
    });
  }

  return res.status(200).json(new ApiResponse(200, message, 'Message assigned successfully'));
});

export const replyToMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { message: replyMessage, closeAfterReply = false } = req.body ?? {};

  if (!replyMessage?.trim()) {
    throw new ApiError(400, 'Reply message is required');
  }

  const message = await Contact.findById(id);
  if (!message) {
    throw new ApiError(404, 'Message not found');
  }

  ensureManagerOwnsContact(message, req.user, 'reply to this support ticket');

  message.replies.push({
    author: req.user?._id ?? null,
    authorRole: req.user?.role ?? 'admin',
    message: replyMessage.trim(),
    createdAt: new Date(),
  });
  message.status = closeAfterReply ? 'closed' : 'responded';
  await message.save({ validateBeforeSave: false });

  await recordAuditLog({
    actor: req.user?._id,
    actorRole: req.user?.role,
    action: 'support.replied',
    entityType: 'contact',
    entityId: message._id,
    summary: 'Support reply sent',
    metadata: { closeAfterReply },
  });

  return res.status(200).json(new ApiResponse(200, message, 'Reply added successfully'));
});
