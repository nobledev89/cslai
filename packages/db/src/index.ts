// =============================================================================
// @company-intel/db — Public exports
// =============================================================================

export { prisma } from './client';
export { encrypt, decrypt, encryptObject, decryptObject } from './encryption';

// Re-export Prisma model types for consumers
export type {
  Tenant,
  User,
  Membership,
  RefreshToken,
  IntegrationConfig,
  SlackWorkspace,
  ThreadMemory,
  Run,
  RunStep,
  ErrorLog,
} from '@prisma/client';

// Re-export Prisma enums (values + types)
export { MembershipRole, IntegrationType, RunStatus, RunStepStatus } from '@prisma/client';
