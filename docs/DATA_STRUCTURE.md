# Forum Data Structure Analysis

## Optimism Forum (gov.optimism.io)

### Categories (Key governance segments)

| Category | Slug | Purpose |
|----------|------|---------|
| Get Started 🌱 | get-started | Onboarding |
| **Grants 🔴** | grants | Grant applications and info |
| **Elections 💼** | elected-reps | Council elections |
| **Proposals 📃** | (various) | Governance proposals |
| Updates and Announcements 📢 | updates-and-announcements | Official comms |
| Policies and Templates 📌 | policies-and-important-documents | Governance docs |
| Governance Design 📐 | governance-design-and-strategy | Meta-governance |
| Feedback 💬 | feedback | Community input |
| General Discussions ✨ | general | Catch-all |
| ARCHIVED & OLD Missions | archived-old-missions | Historical |

### Tags (Temporal markers)

Tags indicate governance cycles and seasons:
- `cycle-1` through `cycle-11+`
- `season-1` through `season-9+`
- `retropgf-1` through `retropgf-7+` (RetroPGF rounds)
- `round-2` etc. (grant rounds)

**Insight:** Tags encode temporal context - when a proposal was active. Critical for tracking evolution.

### Data We Capture Per Topic

```typescript
{
  discourse_id: number,      // Unique topic ID
  title: string,             // Topic title
  slug: string,              // URL-friendly title
  category_id: number,       // Links to category
  tags: string[],            // Temporal/thematic tags
  posts_count: number,       // Replies + original
  views: number,             // View count
  reply_count: number,       // Number of replies
  like_count: number,        // Engagement metric
  pinned: boolean,           // Admin-pinned
  closed: boolean,           // No new replies
  archived: boolean,         // Historical
  created_at: timestamp,     // When created
  bumped_at: timestamp,      // Last activity
  first_seen_at: timestamp,  // When we indexed it
  last_seen_at: timestamp,   // Last update
}
```

Additionally, the app now captures:
- `excerpt` - Plain-text excerpt (HTML stripped, max 200 chars, shown in feed cards)

### Additional Fields Available (Not Currently Captured)

From Discourse API:
- `word_count` - Length of content
- `has_accepted_answer` - Q&A resolution
- `highest_post_number` - Thread depth
- `featured_link` - External references

Note: `participant_count` and `image_url` are now captured via the `/api/discourse/topic` endpoint (used by the inline reader). `participant_count` is available in the `TopicDetail` type.

### Insights for Agentic Grants

1. **Proposal Lifecycle Tracking**
   - Use `created_at` + `bumped_at` to track activity windows
   - Monitor `reply_count` growth for engagement
   - `closed` status indicates finalized proposals

2. **Grants Category Filter**
   - category_id = 87 is Grants 🔴
   - Track proposals with grant-related tags

3. **Season/Cycle Analysis**
   - Tags reveal which governance period
   - Can correlate funding decisions to timeframes

4. **Engagement Metrics**
   - `views` / `like_count` ratio = engagement quality
   - `posts_count` shows discussion depth
   - High `participant_count` = broad input

### Schema Enhancement Ideas

1. **Add categories table** - Store category metadata
2. **Add tag analytics** - Track tag usage over time
3. **Track post authors** - Who's active in governance
4. **Snapshot metrics** - Track view/like changes over time

---

## Cross-Forum Patterns

Different forums have different structures:

| Forum | Key Categories | Tag Patterns |
|-------|---------------|--------------|
| Optimism | Grants, Elections, Proposals | season-N, cycle-N, retropgf-N |
| Arbitrum | DAO Proposals, Grants | aip-N (improvement proposals) |
| ENS | Governance Proposals, Working Groups | ep-N (executable proposals) |
| Uniswap | Governance, Temperature Check | uip-N, temp-check |

**Insight:** Each forum has its own governance vocabulary. Tag patterns reveal governance cadence.

---

*Last updated: 2026-02-09*
