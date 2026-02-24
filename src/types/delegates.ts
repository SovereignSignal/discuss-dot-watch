// ============================================================
// Delegate Monitoring Types
// Multi-tenant delegate activity tracking for Discourse forums
// ============================================================

// --- Tenant ---

export interface DelegateTenant {
  id: number;
  slug: string;                    // URL slug, e.g. "my-dao"
  name: string;                    // Display name, e.g. "My DAO"
  forumUrl: string;                // Discourse base URL, e.g. "https://forum.example.org"
  apiUsername: string;              // Discourse API username
  encryptedApiKey: string;         // AES-256-GCM encrypted API key
  config: TenantConfig;
  capabilities: TenantCapabilities;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastRefreshAt: string | null;
}

export interface TenantBranding {
  accentColor?: string;      // e.g. "#FF684B" for Scroll
  bgColor?: string;          // Light-mode custom bg, e.g. "#FFF8F3"
  logoUrl?: string;          // Tenant logo URL
  heroTitle?: string;        // e.g. "Welcome to Scroll Governance"
  heroSubtitle?: string;     // Descriptive text below hero
  footerText?: string;       // Custom footer text
}

export interface TenantConfig {
  // Rationale detection
  rationaleSearchPattern?: string;   // Default: "rationale"
  rationaleCategoryIds?: number[];   // Category IDs to search for rationales
  rationaleTags?: string[];          // Tags that indicate rationale posts
  // Display
  programLabels?: string[];          // e.g. ["Council", "Grants"]
  trackedMemberLabel?: string;       // e.g. "Delegate", "Steward", "Council Member"
  trackedMemberLabelPlural?: string; // e.g. "Delegates", defaults to label + "s"
  // Branding
  branding?: TenantBranding;         // Per-tenant visual branding
  // Refresh
  refreshIntervalHours?: number;     // Default: 12
  // Contributor sync
  maxContributors?: number;          // Default: 200
}

export interface TenantCapabilities {
  // Discovered on first connection by testing endpoints
  canListUsers?: boolean;
  canListDirectory?: boolean;
  canViewUserStats?: boolean;
  canViewUserPosts?: boolean;
  canSearchPosts?: boolean;
  canViewUserEmails?: boolean;       // Should always be false for this use case
  testedAt?: string;
}

// --- Directory Item (from Discourse /directory_items.json) ---

export interface DirectoryItem {
  username: string;
  name: string | null;
  avatarTemplate: string;
  postCount: number;
  topicCount: number;
  likesReceived: number;
  likesGiven: number;
  daysVisited: number;
  postsRead: number;
  topicsEntered: number;
}

// --- Delegate ---

export interface Delegate {
  id: number;
  tenantId: number;
  username: string;                  // Discourse username (primary key per tenant)
  displayName: string;               // Admin-provided display name
  isTracked: boolean;                // true = manually added tracked member, false = auto-synced from directory
  avatarTemplate?: string;           // Discourse avatar URL template (from directory or API)
  // Manual fields (admin-provided)
  walletAddress?: string;
  kycStatus?: 'verified' | 'pending' | 'not_required' | null;
  verifiedStatus?: boolean;
  programs?: string[];               // e.g. ["GCR", "DCP"]
  role?: string;                     // e.g. "delegate", "council_member", or custom
  isActive: boolean;
  // On-chain (manual for POC)
  votesCast?: number;
  votesTotal?: number;
  votingPower?: string;              // String to handle large numbers
  // Directory stats (from /directory_items.json)
  directoryPostCount?: number;
  directoryTopicCount?: number;
  directoryLikesReceived?: number;
  directoryLikesGiven?: number;
  directoryDaysVisited?: number;
  directoryPostsRead?: number;
  directoryTopicsEntered?: number;
  // Percentile rankings (computed during sync)
  postCountPercentile?: number;
  likesReceivedPercentile?: number;
  daysVisitedPercentile?: number;
  topicsEnteredPercentile?: number;
  // Metadata
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Discourse User Stats (from API) ---

export interface DiscourseUserStats {
  username: string;
  name: string | null;
  avatarTemplate: string;
  trustLevel: number;
  // Activity stats
  topicCount: number;               // Topics created
  postCount: number;                // Posts created
  topicsEntered: number;            // Topics viewed
  postsRead: number;                // Posts read
  daysVisited: number;              // Days visited
  likesGiven: number;
  likesReceived: number;
  // Timestamps
  lastSeenAt: string | null;
  lastPostedAt: string | null;
  createdAt: string;
}

export interface DiscourseUserPost {
  id: number;
  topicId: number;
  topicTitle: string;
  topicSlug: string;
  categoryId: number;
  postNumber: number;
  content: string;                   // Cooked HTML
  createdAt: string;
  likeCount: number;
  replyCount: number;
  username: string;
}

// --- Snapshot ---

export interface DelegateSnapshot {
  id: number;
  delegateId: number;
  tenantId: number;
  // Discourse stats at time of capture
  stats: DiscourseUserStats;
  // Computed metrics
  rationaleCount: number;
  recentPosts: DiscourseUserPost[];  // Last N posts
  // Metadata
  capturedAt: string;
}

// --- Aggregated view for the dashboard ---

export interface DelegateRow {
  // Identity
  username: string;
  displayName: string;
  avatarUrl: string;
  isActive: boolean;
  isTracked: boolean;
  programs: string[];
  role?: string;
  // Forum stats (from latest snapshot or directory)
  trustLevel: number;
  topicCount: number;
  postCount: number;
  likesGiven: number;
  likesReceived: number;
  daysVisited: number;
  postsRead: number;
  lastSeenAt: string | null;
  lastPostedAt: string | null;
  // Percentile rankings
  postCountPercentile?: number;
  likesReceivedPercentile?: number;
  daysVisitedPercentile?: number;
  topicsEnteredPercentile?: number;
  // Computed
  rationaleCount: number;
  // On-chain (manual)
  votesCast?: number;
  votesTotal?: number;
  votingPower?: string;
  voteRate?: number;                 // votesCast / votesTotal * 100
  // Manual
  walletAddress?: string;
  kycStatus?: string | null;
  verifiedStatus?: boolean;
  notes?: string;
  // Data source tracking
  dataSource: {
    forumStats: 'discourse_api' | 'directory';
    onChain: 'manual' | 'chain_integration';
    identity: 'admin_provided' | 'directory';
  };
  // Latest snapshot timestamp
  snapshotAt: string | null;
}

export interface DelegateDashboard {
  tenant: {
    slug: string;
    name: string;
    forumUrl: string;
    branding?: TenantBranding;
    trackedMemberLabel?: string;
    trackedMemberLabelPlural?: string;
  };
  delegates: DelegateRow[];
  summary: DashboardSummary;
  trackedCount: number;
  lastRefreshAt: string | null;
  capabilities: TenantCapabilities;
  brief?: string | null;
}

export interface DashboardSummary {
  totalDelegates: number;
  activeDelegates: number;
  avgPostCount: number;
  medianPostCount: number;
  avgLikesReceived: number;
  avgDaysVisited: number;
  avgRationaleCount: number;
  avgVoteRate: number | null;       // null if no on-chain data
  delegatesWithRationales: number;
  delegatesSeenLast30Days: number;
  delegatesPostedLast30Days: number;
  // Activity distribution (bucket counts)
  activityDistribution: {
    highlyActive: number;    // 50+ posts
    active: number;          // 11-50 posts
    lowActivity: number;     // 2-10 posts
    minimal: number;         // 1 post
    dormant: number;         // 0 posts
  };
  // Whether timestamp data is available (tracked members only)
  hasTimestampData: boolean;
}

// --- API request/response types ---

export interface TenantCreateRequest {
  slug: string;
  name: string;
  forumUrl: string;
  apiKey: string;
  apiUsername: string;
  config?: Partial<TenantConfig>;
}

export interface DelegateUpsertRequest {
  username: string;
  displayName: string;
  walletAddress?: string;
  kycStatus?: 'verified' | 'pending' | 'not_required' | null;
  verifiedStatus?: boolean;
  programs?: string[];
  role?: string;
  isActive?: boolean;
  votesCast?: number;
  votesTotal?: number;
  votingPower?: string;
  notes?: string;
}

export interface RefreshResult {
  tenantSlug: string;
  delegatesRefreshed: number;
  snapshotsCreated: number;
  errors: Array<{ username: string; error: string }>;
  duration: number;
  timestamp: string;
}

// --- Predefined roles ---

export const DELEGATE_ROLES = [
  { id: 'delegate', label: 'Delegate' },
  { id: 'council_member', label: 'Council Member' },
  { id: 'major_stakeholder', label: 'Major Stakeholder' },
  { id: 'contributor', label: 'Contributor' },
  { id: 'grantee', label: 'Grantee' },
  { id: 'core_team', label: 'Core Team' },
  { id: 'advisor', label: 'Advisor' },
] as const;

// --- User search result (from Discourse search endpoint) ---

export interface UserSearchResult {
  username: string;
  name: string | null;
  avatarUrl: string;
}
