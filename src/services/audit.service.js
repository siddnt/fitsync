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
  search,
  limit = 50,
} = {}) => {
  const filter = {};
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = String(entityId);
  if (actor) filter.actor = actor;
  if (action) filter.action = action;

  const logs = await AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate({ path: 'actor', select: 'name email role' })
    .lean();

  const query = String(search || '').trim().toLowerCase();
  if (!query) {
    return logs;
  }

  return logs.filter((log) => (
    [
      log.summary,
      log.action,
      log.entityType,
      log.entityId,
      log.actor?.name,
      log.actor?.email,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  ));
};
