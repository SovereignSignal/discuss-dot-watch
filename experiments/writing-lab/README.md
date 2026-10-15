# Writing Lab

A dependency-free, opt-in writing workbench inside discuss.watch. Node 22+. No production routes, database migrations, schedules or package installs.

**Status:** working pilot; writing improvement has not been measured. Bundled data: **14 AI-authored illustrative examples, zero approved human examples, 12 original evaluation tasks**. These fixtures exercise the pipeline. They are not a mined forum corpus or a trained model.

Working record: [Notion build log and agent handoff](https://app.notion.com/p/3fa000c0d590811d97cdcb22da3483d3).

## Try it

From the repository root:

```bash
node --test experiments/writing-lab/test.mjs
node experiments/writing-lab/cli.mjs prepare \
  --input experiments/writing-lab/demo-request.json --demo
```

The second command returns the intended message, explicit constraints and two relevant illustrations. The host model uses that packet to write. Omit `--demo` for the production-like default: no illustrative material is retrieved. With no approved corpus, it honestly returns a skill-only packet.

Use the opt-in project skill in `.claude/skills/discuss-writing/SKILL.md`. Invoke `/discuss-writing` in Claude Code after checking out the branch, or give another agent the skill's instructions and the tools below. Installing the skill or starting the server does not trigger mining, model calls or storage.

## Connect the local MCP server

From the repository root:

```bash
claude mcp add --transport stdio discuss-writing -- \
  node "$PWD/experiments/writing-lab/mcp.mjs"
claude mcp get discuss-writing
```

This registers a local server in the current Claude Code project. Check its status in `/mcp` before use. The implementation has subprocess/lifecycle tests; a real Claude Code/Desktop session still needs a manual smoke test. It is a small tools-only stdio adapter, not a full MCP SDK or HTTP service. It advertises no sampling, resources, prompts, streaming tasks or cancellation support.

| Tool | Behavior |
| --- | --- |
| `prepare_writing` | Match eligible examples by intent and genre; return a writing packet. No model call or persistence. |
| `check_writing` | Flag protected-span loss, numeric changes, selected marker loss and source overlap. No semantic guarantee. |
| `record_writing_feedback` | Available only with a private data directory. Requires explicit consent on every call. |
| `write_draft` | Available only with explicit model configuration. Makes a bounded paid Anthropic call; never sends or publishes the result. |

A tool response is visible to the host model. Therefore **both retrieval and external-processing permission are required by default**, even for host-writes mode. `external:false` exists only as a low-level library option for trusted local inspection and must not be used by an agent integration.

## Request and review contract

Required: `brief`, `audience`, `intent`, `genre`. Optional: `context`, `draft`, `facts`, `protectedSpans`, `preferences`, `forbiddenPhrases`, `maxWords`, `excludeThreads`, `includeIllustrative`.

Intents: disagree, request, explain, propose, update, decline, appreciate. Genres: forum-reply, email, memo, technical-note. Defaults include a 250-word limit and no illustrations. JSON schemas and size limits are exported from `core.mjs`. Unknown fields are rejected. The text must be provided by the caller; the tools do not read arbitrary documents or fetch URLs.

For checking, pass `{ "request": <same request>, "text": <proposed writing> }` through stdin to `node experiments/writing-lab/cli.mjs check`, or call the equivalent MCP tool. Keep the original request unchanged between drafting and checking.

A check returns `needs_review` or `no_mechanical_flags`, always with `requiresHumanReview: true`. It can miss role reversals, changed names, equivalent numeric reformatting, nuanced negation and new claims. Missing all uncertainty markers in a draft can be detected; strengthening a single claim among several may be missed. Eight-word source overlap is only a warning and can flag common language. Do not use a clean report as an automatic send/approval gate.

## Bring in forum replies without changing production ingestion

The importer accepts a bounded Discourse JSON export with `id`, `title`, `post_stream.posts`, and optional `post_stream.stream`. Individual posts require `id`, `post_number`, `raw`, with optional `username`, `reply_to_post_number`, visibility and deletion fields. Obtain exports only through authorized access and source-permitted methods. No live crawler is implemented here.

```bash
node experiments/writing-lab/cli.mjs import \
  --input /private/path/topic.json \
  --origin https://forum.example.org \
  --out /private/path/candidates.json
```

`raw` Markdown is deliberate. Standard topic responses may contain only `cooked` HTML. Such replies are reported as skipped; this tool does not pretend that stripping arbitrary HTML with a regex preserves the writing. Opening-post and direct-parent text are retained. Missing parents, partial streams, oversized context, hidden/deleted and system posts are reported. `contextComplete` covers only the opening post plus direct parent; it is not proof of full conversation context. No authorship detector is used. A forum record is not automatically known to be human-authored.

The result contains `records` and `coverage`. Records start in **quarantine**, with an unreviewed intent placeholder and all reuse permissions false. Nothing is promoted automatically.

### Curate an eligible corpus

Keep the imported text outside Git. An operator reviews the source, writing quality, authorship uncertainty, appropriate genre and communicative intent. Record a concrete permission basis and attribution obligations. Public access alone does not establish permission for every use; retrieval, external processing and training are separate decisions. This tool records those decisions; it does not determine legal rights.

For each accepted record, set the actual `intent`, `genre`, a useful `annotation`, `review.status = "approved"`, a nonempty `review.reviewer`, and `review.reviewedHash` equal to `source.contentHash`. Set `rights.retrieval`, `rights.externalProcessing` and `rights.basis` only when established. Keep `rights.training = false` for this pilot. Set `split = "train"` and retain the source URL, timestamp and thread/author identifiers. The content hash binds the context and reply; any edit requires a new hash and re-review. Changes to metadata also need operator review, although the content hash does not cover metadata.

Save **the records array**, not the import-result wrapper, to an approved-corpus JSON file. Example of computing a hash after an intentional edit:

```js
import { recordHash, validateCorpus } from './experiments/writing-lab/core.mjs';
record.source.contentHash = recordHash(record);
// Only after the reviewer actually reviewed this version:
record.review.reviewedHash = record.source.contentHash;
validateCorpus([record]);
```

Pass `--corpus /private/path/approved.json` to the CLI or set `WRITING_LAB_CORPUS` in the MCP process environment. The file is re-read on each call. Revoked records, eval/quarantine splits, incomplete context and unknown permissions fail closed. Delete or mark a record `revoked=true` to exclude it on the next call. This cannot erase passages already sent to another model, exported in a packet or copied into an output.

Retrieval is an auditable baseline: exact intent, genre preference, limited lexical overlap, maximum three examples, one per thread/author, normalized exact-text deduplication and a 6,000-character content budget. No embeddings, trained ranker, near-duplicate clustering or calibrated quality score is claimed.

## Optional standalone Claude writer

Host-writes mode needs no extra API credential. To enable the separate writer, explicitly supply `WRITING_LAB_ALLOW_MODEL_CALLS=true`, `WRITING_LAB_MODEL` with an available model ID, and `ANTHROPIC_API_KEY` via the process environment or secret manager. Do not commit secrets, put them into requests, or copy production Railway credentials into this experiment. This does not use a Claude subscription as an API credential.

```bash
node experiments/writing-lab/cli.mjs write --input /private/path/request.json
```

The writer uses only the fixed Anthropic Messages endpoint, does not follow redirects, limits responses and request sizes, times out after 45 seconds, uses 2,048 maximum output tokens and permits at most ten attempts per process. There are no automatic retries. Restarting the process resets the attempt count, so this is **not an account-wide spending cap**. Keep it local, set a provider budget and do not expose the pilot as a public endpoint. Non-`end_turn` responses are withheld. The response includes the draft, partial checks, example IDs, model and token usage. Provider behavior is tested with mocks; no paid live generation was performed in the initial build session.

## Private feedback

Feedback is disabled until the operator sets `WRITING_LAB_DATA_DIR` to an explicit location outside the repo, such as a private application-data directory. The tool creates a `writing-lab` child directory and append-only `feedback.jsonl` using restrictive permissions. It refuses unsafe permissions, links and paths inside this checkout. This is a local single-user pilot, not a multi-tenant store or encryption-at-rest implementation.

An edit pair requires request, draft, final, reviewer, changeKinds and `consentToStore:true`. Change types: style, facts, intent, substance, mixed, unknown. Saving grants neither training nor sharing permission. A stylistic rule is not inferred automatically from a factual correction. There is no background upload or inferred consent from an edit. Local feedback and corpus files may contain private writing: keep them out of commits and shared artifacts.

## Blind evaluation

`eval-tasks.json` provides 12 original starter briefs. They have no human ratings, preferred outputs or claim to represent Sov's entire workload. Expand to roughly 50 genuine held-out tasks after the first review.

Generate three outputs per task with the same model, facts, request constraints and generation settings: baseline (current workflow), skill (no examples), examples (skill plus eligible curated examples). Use different threads for curation and evaluation and supply `excludeThreads` where needed. Record actual selected example IDs and model settings separately. If the third condition retrieved zero examples or used illustrations, do not report it as a test of a human corpus.

Save an array of `{taskId, condition, text}` rows, with conditions `baseline`, `skill`, `examples`:

```bash
node experiments/writing-lab/cli.mjs blind \
  --input /private/path/outputs.json --seed trial-one-seed \
  --out /private/path/review.json
```

This creates new private files `review.json` and `review.json.key.json`, refuses overwrites, and separates condition identities from the rater. Open `review.html` locally and load only `review.json`. Load `eval-tasks.json` as the task brief file or a similarly shaped private task file. The page makes no network requests and stores nothing in browser storage. Export ratings explicitly; keep the key away from raters until ratings are locked.

Judge sendability, editing effort, fit for the intended author/audience and any changed meaning. Review each candidate rather than rewarding superficial terseness. The primary unresolved question is whether approved forum examples beat the skill-only condition. If they do not, improve selection before collecting more data or training a model. A subjective preference from one author is not evidence of universal style quality.

## Next slices and stop conditions

1. Verify the skill and MCP tools in a real Claude Code session, using a non-sensitive brief. Current tests verify stdio behavior, not every client.
2. Select a small set of source-permitted threads with diverse replies. Review 20-30 useful examples manually before expanding toward 200. Do not enable bulk ingestion or infer human authorship from posting date alone.
3. Run the first blind review on actual writing work. Capture only edits explicitly approved for storage. Keep evaluation threads out of retrieval.
4. Add real semantic-review checks, source-policy management and a persistent budget before serving remotely. An additional model cannot provide a correctness guarantee.
5. Consider fine-tuning only after repeatable human preference gains and a separately permitted training dataset exist.

No deployment, automatic mining, author impersonation, publishing, feedback training or model benchmark is implied by this package. Removing the feature branch discards the pilot without changing production.

## Implementation references

- [Agent Skills format](https://agentskills.io/specification)
- [Claude Code MCP setup](https://code.claude.com/docs/en/mcp)
- [MCP lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
- [MCP transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages/create)
- [Anthropic stop reasons](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons)
- [Discourse API](https://docs.discourse.org/)
