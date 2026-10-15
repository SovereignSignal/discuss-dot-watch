/** Original AI-authored illustrations. Never label these as mined human writing. */
import { recordHash } from './core.mjs';
const seeds = [
  [
    "disagree",
    "forum-reply",
    "A contributor wants to scale a pilot after its first trial.",
    "I would keep the next round at the same size. The first trial tells us people will sign up; it does not yet tell us whether they will stay. A second round would let us check that before adding more work.",
    "Separate what the evidence supports from the proposed conclusion. State a next step without attacking the proposer."
  ],
  [
    "disagree",
    "email",
    "A colleague recommends removing a review step to speed up delivery.",
    "I agree the review is slowing us down. I am less sure that removing it will help. Could we try reviewing only the risky changes first? That would give us a way to reduce the delay without losing the check entirely.",
    "Acknowledge the shared problem, distinguish uncertainty from opposition, and propose a limited test."
  ],
  [
    "request",
    "email",
    "A project lead needs a decision about the draft before continuing.",
    "Could you confirm which version we should use? The figures differ between the draft and the spreadsheet, and I would rather settle that before sending it around.",
    "Make the request specific and explain the consequence. Do not manufacture urgency."
  ],
  [
    "request",
    "forum-reply",
    "A reviewer cannot tell who will be responsible after a handoff.",
    "Who owns maintenance after the handoff? I can follow the implementation plan, but I cannot find that responsibility in the proposal. Please add it before the vote.",
    "Ask the exact missing question, identify where information was sought, and connect the answer to a real decision."
  ],
  [
    "explain",
    "technical-note",
    "A teammate asks why the service keeps a cached copy.",
    "The cached copy lets the page load even when the source is slow. It also means a successful page load does not prove the source is current. We should show when the underlying data was last refreshed.",
    "Explain the mechanism and its consequence together. Avoid turning a useful simplification into an absolute claim."
  ],
  [
    "explain",
    "memo",
    "A reader is confusing eligibility with a funding decision.",
    "Eligibility gets an application into review. The funding decision comes later, after the reviewers compare the proposals and the available budget. An eligible application may still receive no funding.",
    "Distinguish two stages using concrete consequences and retain the uncertainty of the outcome."
  ],
  [
    "propose",
    "forum-reply",
    "A community is considering a new reporting requirement.",
    "I suggest trying the shorter report with the next cohort. Keep the current questions about spending and delivery, and drop the sections nobody uses in review. We can compare the two formats before making the change permanent.",
    "Describe the actual change, preserve the important constraint, and give the trial a decision point."
  ],
  [
    "propose",
    "memo",
    "A manager wants a recommendation about an unreliable integration.",
    "We should make the manual import available alongside the integration. It adds an extra path to maintain, but gives the team a way to continue when the source is unavailable. I would review usage before investing in a more elaborate fallback.",
    "Recommend a direction, state its real cost, and identify evidence for the next investment decision."
  ],
  [
    "update",
    "email",
    "A delivery date is uncertain because an external review is incomplete.",
    "The draft is ready for review. We are still waiting for the external check, so I cannot confirm the release date yet. I will update the schedule when that result arrives.",
    "Separate completed work from the unresolved dependency. Keep the commitment limited to an action the author controls."
  ],
  [
    "update",
    "forum-reply",
    "An operator has restored one failed data source but has not repaired the backlog.",
    "The source is responding again, and new records are coming through. The missing historical records have not been restored. I have left them marked as incomplete so they do not get mistaken for a quiet period.",
    "Report recovery and its boundary separately. Explain why visible incompleteness matters."
  ],
  [
    "decline",
    "email",
    "A person wants to decline additional work without implying future availability.",
    "Thank you for thinking of me. I cannot take this on alongside my current commitments. I hope you find someone who can give it the attention it needs.",
    "Give an honest refusal with proportionate warmth. Do not invent availability or offer work the author has not agreed to do."
  ],
  [
    "decline",
    "forum-reply",
    "A participant opposes a proposal whose scope is not defined.",
    "I cannot support this version. The budget covers implementation, but the scope is still open-ended. Please bring it back with a defined deliverable and a cost attached to that deliverable.",
    "State the decision and its reason. Make the route to reconsideration explicit without promising approval."
  ],
  [
    "appreciate",
    "email",
    "A colleague helped a new team member understand a difficult handoff.",
    "Thank you for walking through the handoff with the team. The notes were useful, but hearing why those decisions were made helped the new people understand what to preserve.",
    "Name the contribution and the specific benefit. Warmth comes from attention rather than inflated adjectives."
  ],
  [
    "appreciate",
    "forum-reply",
    "A contributor published a reproducible investigation of a confusing issue.",
    "The reproduction steps made this much easier to check. I could follow the same path and see where our results differed. Thanks for taking the time to write it up.",
    "Point to the work that helped and the effect it had. Avoid generic praise that could fit any contribution."
  ]
];
export const fixtures = seeds.map(([intent, genre, context, text, annotation], index) => {
  const id = `illustrative-${String(index + 1).padStart(2, '0')}`;
  const record = { id, intent, genre, context, text, annotation,
    source: { kind: 'illustrative', url: `illustration:${id}`, thread: id, author: id,
      retrievedAt: '2026-10-15T02:00:20Z', contentHash: '', contextComplete: true },
    review: { status: 'fixture', note: 'AI-authored example. Unrated by a human; no empirical quality claim.' },
    rights: { retrieval: true, training: false, externalProcessing: true,
      basis: 'Original AI-authored fixture created for this pilot. No third-party text.', attribution: 'Writing Lab illustrative fixture' },
    split: 'train', revoked: false };
  record.source.contentHash = recordHash(record);
  return record;
});
