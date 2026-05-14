import { prisma } from '@/lib/validations/prisma';

export type AuditEvent =
  | 'REGISTER_SUCCESS'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'TOKEN_REFRESH'
  | 'TOKEN_BLACKLISTED'
  | 'ROLE_CHANGED'
  | 'PASSWORD_CHANGED'
  | 'ACCOUNT_CREATED'
  | 'WORKSHOP_CREATED'
  | 'WORKSHOP_UPDATED'
  | 'WORKSHOP_CANCELLED'
  | 'WORKSHOP_PUBLISHED'
  | 'PRICING_UPDATED'
  | 'CAPACITY_CHANGED';

/**
 * Sanitizes metadata by removing sensitive information.
 */
function sanitizeMetadata(metadata: any): any {
  if (!metadata || typeof metadata !== 'object' || metadata === null) return metadata;

  const sanitized = { ...metadata };
  const sensitiveKeys = ['password', 'token', 'hash', 'secret', 'access_token', 'refresh_token', 'key'];

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      delete sanitized[key];
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeMetadata(sanitized[key]);
    }
  }

  return sanitized;
}

interface AuditLogOptions {
  userId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Logs an audit event asynchronously (fire-and-forget).
 * Does not block the main execution flow.
 */
export function auditLog(
  action: AuditEvent,
  metadata: any = {},
  options: AuditLogOptions = {}
) {
  // Sanitize metadata before logging
  const sanitizedMetadata = sanitizeMetadata(metadata);

  // Extract common fields from metadata or options
  const actorId = options.userId || sanitizedMetadata.user_id || sanitizedMetadata.actor_id || null;
  const ipAddress = options.ipAddress || sanitizedMetadata.ip || null;
  const userAgent = options.userAgent || sanitizedMetadata.user_agent || null;
  const resourceType = options.resourceType || sanitizedMetadata.resource_type || 'User';
  
  // resourceId must be a valid UUID or null
  let resourceId = options.resourceId || sanitizedMetadata.resource_id || null;
  
  // Basic validation to ensure resourceId is a UUID string if present
  if (resourceId && typeof resourceId !== 'string') {
    resourceId = null;
  }

  // Fire and forget
  prisma.auditLog.create({
    data: {
      action,
      actorId,
      resourceType,
      resourceId,
      ipAddress,
      userAgent,
      changes: sanitizedMetadata,
    },
  }).catch((error) => {
    // Log internal error to console but don't crash the request
    console.error(`[AuditLog] Failed to create audit log for action ${action}:`, error);
  });
}
