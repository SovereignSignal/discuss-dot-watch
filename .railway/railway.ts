import { defineRailway, github, preserve, project, service } from "railway/iac";

// Replaces railway.json (Config as Code), which Railway stops reading on
// 2026-12-01. Every setting the old file declared is carried over explicitly:
// `railway config migrate` emitted only start + healthcheck, dropping the
// restart policy and leaving the builder as a comment.
//
// This file is the service's complete desired state. Anything left out is
// DELETED on `railway config apply`: the migrate draft would have removed all
// 17 variables and disconnected the GitHub source. Always run
// `railway config plan` first and expect only intended changes.
//
// Known plan quirk (CLI 5.62.1): after the 2026-09-30 apply, plan keeps
// reporting restartPolicyType/MaxRetries as null → set, although the live
// service has ON_FAILURE / 10 (confirmed via the GraphQL serviceInstance).
// That one line is a read-back gap in plan, not drift.
//
// This repo owns only the app service; Postgres and Redis live in the same
// project but are not managed from here.
export const partial = "discuss-dot-watch";

export default defineRailway(() => {
  const discussDotWatch = service("discuss-dot-watch", {
    source: github("SovereignSignal/discuss-dot-watch", { branch: "main" }),
    build: {
      builder: "NIXPACKS", // reads nixpacks.toml (Node 22, npm 11, npm ci)
    },
    deploy: {
      startCommand: "npm run start",
      healthcheckPath: "/",
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    },
    // Values live in Railway only; preserve() declares the variable without
    // putting its value in the repo. Add new variables here before setting
    // them, or the next apply deletes them.
    env: {
      ADMIN_EMAILS: preserve(),
      ANTHROPIC_API_KEY: preserve(),
      ANTICAPTURE_API_KEY: preserve(),
      CRON_SECRET: preserve(),
      DATABASE_URL: preserve(),
      ENCRYPTION_KEY: preserve(),
      GITHUB_TOKEN: preserve(),
      LLM_MODEL: preserve(),
      LLM_MODEL_CLASSIFY: preserve(),
      LLM_PROVIDER: preserve(),
      NEXT_PUBLIC_APP_URL: preserve(),
      OLLAMA_API_KEY: preserve(),
      REDIS_URL: preserve(),
      RESEND_API_KEY: preserve(),
      RESEND_FROM_EMAIL: preserve(),
    },
  });
  return project("discuss-dot-watch", {
    resources: [discussDotWatch],
  });
});
