# Data Integration Strategy: Connecting the Grants Intelligence Stack

## Three Data Sources

### 1. GrantWire Database (Railway)
**Purpose:** News and announcements about grants
**Content:** 3,137 messages from Telegram, 159 extracted grant entries

| Table | Key Fields | Unique IDs |
|-------|-----------|------------|
| `grant_entries` | title, sourceUrl, publishedAt | externalId |
| `summaries` | title, summary, entities (JSON) | message_id |
| `entities` JSON | protocols[], amounts[], deadlines[], key_terms[], source.url | - |

**Sample Entity:**
```json
{
  "protocols": ["Pharos"],
  "amounts": ["$10M"],
  "key_terms": ["RealFi", "Builder Incubator"],
  "source": {"url": "https://x.com/...", "type": "twitter"}
}
```

### 2. discuss.watch Database (Railway)
**Purpose:** Forum discussions and governance proposals
**Content:** 5,011+ topics from 101 forums (growing)

| Table | Key Fields | Unique IDs |
|-------|-----------|------------|
| `topics` | title, category_id, tags[], views, reply_count | discourse_id + forum_id |
| `forums` | name, url, category | forum_id |

**Optimism-specific tags:** season-N, cycle-N, retropgf-N

### 3. Grants Tracking Spreadsheet (Manual/Structured)
**Purpose:** Deliverables and disbursement tracking
**Content:** Per-grant milestone and payment status

| Field | Purpose |
|-------|---------|
| Cycle # | Governance cycle |
| Project Name | Grant recipient |
| Status | Sent, Clawed Back, Not-passed |
| OP Delivered / Total | Payment tracking |
| Intent | 1-4 (Optimism Intent categories) |
| Proposal Link | CharmVerse URL |
| L2 Address | Recipient wallet |

---

## Linking Strategy

### Primary Keys for Entity Resolution

| Source | Identifier | Example |
|--------|-----------|---------|
| Spreadsheet | L2 Address | `0x627B01aA037B19483297fd69b219e790D3598249` |
| Spreadsheet | Proposal URL | `https://app.charmverse.io/op-grants/...` |
| discuss.watch | Topic URL | `https://gov.optimism.io/t/10589` |
| GrantWire | Source URL | `https://x.com/.../status/123` |

### Fuzzy Matching Fields

| Field | Confidence | Notes |
|-------|-----------|-------|
| Project Name | High | "Doxa: The Governance Game" ≈ "Doxa Governance" |
| Protocol | Medium | Extracted entity vs tag |
| Amount | Medium | "$50,000" vs "50000 OP" |

### Cross-Reference Opportunities

1. **Spreadsheet Proposal Link → discuss.watch**
   - CharmVerse links reference original forum proposals
   - Extract forum topic ID from CharmVerse content
   
2. **GrantWire entities.protocols → discuss.watch forum**
   - Match protocol name to forum (e.g., "Optimism" → gov.optimism.io)
   
3. **Spreadsheet L2 Address → On-chain data**
   - Can verify actual disbursements via block explorer

---

## Unified Schema Proposal

### `unified_grants` table

```sql
CREATE TABLE unified_grants (
  id SERIAL PRIMARY KEY,
  
  -- Core identity
  project_name TEXT NOT NULL,
  project_name_normalized TEXT, -- lowercase, stripped
  protocol TEXT,                -- Optimism, Arbitrum, etc.
  
  -- Wallet (strongest link)
  wallet_address TEXT,
  
  -- Amounts
  amount_requested NUMERIC,
  amount_approved NUMERIC,
  amount_delivered NUMERIC,
  token TEXT,                   -- OP, ARB, etc.
  
  -- Status
  status TEXT,                  -- proposed, approved, delivered, clawed_back
  
  -- Temporal
  proposal_date TIMESTAMP,
  approval_date TIMESTAMP,
  delivery_date TIMESTAMP,
  cycle TEXT,                   -- cycle-19, season-8, etc.
  
  -- Source links
  forum_topic_id INTEGER REFERENCES topics(id),
  grantwire_entry_id INTEGER,
  spreadsheet_row_id TEXT,
  
  -- URLs
  proposal_url TEXT,
  charmverse_url TEXT,
  announcement_url TEXT,
  
  -- Metadata
  intent TEXT,                  -- Intent 1-4
  program TEXT,                 -- Builders, Growth
  tags TEXT[],
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Linking Process

1. **Ingest from Spreadsheet** (highest structure)
   - Parse CSV, create unified_grants records
   - Wallet address is primary key
   
2. **Match discuss.watch topics**
   - Fuzzy match project_name to topic titles
   - Look for CharmVerse URLs in topic content
   
3. **Match GrantWire entries**
   - Match protocol + project name
   - Link announcement URLs

---

## API Design for Agentic Grants

### Search Endpoint
```
GET /api/grants/search?q=Synthetix&protocol=optimism
```

Returns unified view across all sources:
```json
{
  "grants": [{
    "project_name": "Synthetix Growth Grant",
    "status": "delivered",
    "amount": "200,000 OP",
    "sources": {
      "spreadsheet": { "row": 45, "status": "Sent" },
      "forum": { "topic_id": 1234, "title": "...", "replies": 45 },
      "grantwire": { "entry_id": 67, "summary": "..." }
    },
    "timeline": [
      { "date": "2024-01", "event": "Proposal submitted", "source": "forum" },
      { "date": "2024-03", "event": "Approved", "source": "spreadsheet" },
      { "date": "2024-04", "event": "First payment", "source": "spreadsheet" }
    ]
  }]
}
```

### Context Endpoint for Agents
```
GET /api/grants/context?project=Synthetix&depth=full
```

Returns rich context for AI agents:
- All forum discussions mentioning project
- GrantWire announcements
- Payment history
- Related projects (same wallet, same intent)

---

## Implementation Phases

### Phase 1: Data Ingestion
- [ ] Parse spreadsheet into unified_grants
- [ ] Build fuzzy matching for project names
- [ ] Link by wallet address where available

### Phase 2: Cross-Reference
- [ ] Match discuss.watch topics to grants
- [ ] Match GrantWire entries to grants
- [ ] Build timeline from multiple sources

### Phase 3: API Layer
- [ ] Unified search API
- [ ] Context API for agents
- [ ] Real-time updates when new data arrives

### Phase 4: Agent Integration
- [ ] MCP tools for Agentic Grants
- [ ] Natural language queries
- [ ] Grant evaluation with full context

---

*Last updated: 2026-02-05*
