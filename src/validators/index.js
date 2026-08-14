const { z } = require('zod');

const uuid = z.string().uuid();
const nullableUuid = uuid.nullable().optional();
const sourceId = z.string().trim().min(1).max(160);
const sourceSystem = z.string().trim().min(1).max(80);
const idempotencyKey = z.string().trim().min(1).max(220);
const date = z.coerce.date();

const issueSchema = z.object({
  tenantId: uuid,
  organizationId: nullableUuid,
  patientId: uuid,
  productId: nullableUuid,
  sourceSystem,
  sourceId,
  totalCredits: z.coerce.number().int().min(1).max(100000),
  expiresAt: date.nullable().optional(),
  metadata: z.record(z.any()).optional(),
  reason: z.string().trim().max(500).optional(),
}).strict();

const mutationSchema = z.object({
  tenantId: uuid.optional(),
  organizationId: nullableUuid,
  appointmentId: nullableUuid,
  reason: z.string().trim().max(500).optional(),
}).strict();

const consumeSchema = mutationSchema.extend({
  type: z.enum(['COMPLETE_CONSUME', 'LATE_CANCEL_CONSUME', 'NO_SHOW_CONSUME']),
});

const statementSchema = z.object({
  tenantId: uuid.optional(),
  organizationId: uuid.optional(),
  patientId: uuid,
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
}).strict();

const policySchema = z.object({
  tenantId: uuid,
  organizationId: nullableUuid,
  cancellationWindowHours: z.coerce.number().int().min(0).max(8760).default(24),
  lateCancellationConsumesCredit: z.boolean().default(true),
  noShowConsumesCredit: z.boolean().default(true),
  isActive: z.boolean().default(true),
}).strict();

module.exports = {
  uuid,
  idempotencyKey,
  issueSchema,
  mutationSchema,
  consumeSchema,
  statementSchema,
  policySchema,
};
