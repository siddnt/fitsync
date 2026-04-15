import AuditLog from '../models/auditLog.model.js';

export const recordAuditLog = async ({
  actor,
  actorRole,
  action,
  entityType,
  entityId,
  summary,
  metadata = {},
}, options = {}) => {
  if (!action || !entityType || !entityId) {
    return null;
  }

  const [log] = await AuditLog.create([{
    actor: actor ?? null,
    actorRole: actorRole ?? null,
    action,
    entityType,
    entityId: String(entityId),
    summary,
    metadata,
  }], options.session ? { session: options.session } : undefined);

  return log;
};

export const listAuditLogs = async ({
  entityType,
  entityId,
  actor,
  action,
  limit = 50,
} = {}) => {
  const filter = {};
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = String(entityId);
  if (actor) filter.actor = actor;
  if (action) filter.action = action;

  return AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate({ path: 'actor', select: 'name email role' })
    .lean();
};
