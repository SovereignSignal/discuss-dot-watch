import { z } from 'zod';
import { isAllowedUrl, isValidUrl } from '@/lib/url';

const slug = z.string().trim().regex(
  /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/,
  'Use 1-100 letters, numbers, dashes or underscores',
);

const forumUrl = z.string().trim().max(2048).refine(
  (value) => isValidUrl(value) && isAllowedUrl(value),
  'Forum URL is invalid or points to a disallowed network address',
);

const hexColor = z.string().regex(/^#[0-9a-fA-F]{3,8}$/);
const shortText = z.string().trim().min(1).max(200);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const stringList = (maxItems: number, maxLength = 100) =>
  z.array(z.string().trim().min(1).max(maxLength)).max(maxItems);
const positiveIntList = (maxItems: number) =>
  z.array(z.number().int().positive()).max(maxItems);

export const TenantConfigSchema = z.object({
  rationaleSearchPattern: optionalText(500),
  rationaleCategoryIds: positiveIntList(100).optional(),
  rationaleTags: stringList(100).optional(),
  programLabels: stringList(50).optional(),
  trackedMemberLabel: optionalText(100),
  trackedMemberLabelPlural: optionalText(100),
  branding: z.object({
    accentColor: hexColor.optional(),
    bgColor: hexColor.optional(),
    logoUrl: z.string().url().max(2048).optional(),
    heroTitle: optionalText(200),
    heroSubtitle: optionalText(500),
    footerText: optionalText(300),
  }).strict().optional(),
  refreshIntervalHours: z.number().int().min(1).max(168).optional(),
  maxContributors: z.number().int().min(1).max(1000).optional(),
  proposalCategoryIds: positiveIntList(100).optional(),
  proposalTags: stringList(100).optional(),
  snapshotSpace: optionalText(200),
  featuredTopicIds: positiveIntList(100).optional(),
  agoraProfileBaseUrl: z.string().url().max(2048).optional(),
}).strict();

const walletAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const username = z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/);

const DelegateInputSchema = z.object({
  username,
  displayName: optionalText(200),
  walletAddress: walletAddress.optional(),
  kycStatus: z.enum(['verified', 'pending', 'not_required']).nullable().optional(),
  verifiedStatus: z.boolean().optional(),
  programs: stringList(30).optional(),
  role: optionalText(100),
  isActive: z.boolean().optional(),
  votesCast: z.number().int().nonnegative().optional(),
  votesTotal: z.number().int().nonnegative().optional(),
  votingPower: optionalText(100),
  notes: optionalText(2000),
}).strict();

const requiredDelegate = DelegateInputSchema.extend({ displayName: shortText });
const tenantScoped = { tenantSlug: slug } as const;

export const AdminActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('init-schema') }).strict(),
  z.object({
    action: z.literal('create-tenant'),
    slug,
    name: shortText,
    forumUrl,
    apiKey: z.string().min(1).max(500),
    apiUsername: shortText,
    config: TenantConfigSchema.optional(),
  }).strict(),
  z.object({
    action: z.literal('update-tenant'),
    ...tenantScoped,
    name: shortText.optional(),
    forumUrl: forumUrl.optional(),
    apiKey: z.string().min(1).max(500).optional(),
    apiUsername: shortText.optional(),
    config: TenantConfigSchema.optional(),
  }).strict(),
  z.object({ action: z.literal('upsert-delegate'), ...tenantScoped, delegate: requiredDelegate }).strict(),
  z.object({ action: z.literal('bulk-upsert-delegates'), ...tenantScoped, delegates: z.array(DelegateInputSchema).min(1).max(200) }).strict(),
  z.object({ action: z.literal('delete-delegate'), ...tenantScoped, username }).strict(),
  z.object({ action: z.literal('delete-tenant'), ...tenantScoped }).strict(),
  z.object({ action: z.literal('detect-capabilities'), ...tenantScoped }).strict(),
  z.object({ action: z.literal('add-tenant-admin'), ...tenantScoped, privyDid: z.string().trim().min(1).max(300) }).strict(),
  z.object({ action: z.literal('remove-tenant-admin'), ...tenantScoped, privyDid: z.string().trim().min(1).max(300) }).strict(),
  z.object({ action: z.literal('list-tenant-admins'), ...tenantScoped }).strict(),
  z.object({ action: z.literal('create-tenant-invite'), ...tenantScoped, expiresInDays: z.number().int().min(1).max(30).optional() }).strict(),
  z.object({ action: z.literal('list-tenant-invites'), ...tenantScoped }).strict(),
  z.object({ action: z.literal('revoke-tenant-invite'), inviteId: z.number().int().positive() }).strict(),
]);

export type AdminAction = z.infer<typeof AdminActionSchema>;

export function formatAdminValidationError(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
    .join('; ');
}
