# discuss.watch - Lessons Learned

> Patterns and learnings to prevent repeated mistakes

---

## API & Data Handling

### Discourse API Tag Format Inconsistency
**Date:** February 2, 2026
**Issue:** App crashed with React error #31 when rendering discussion tags
**Root Cause:** Discourse API returns tags in different formats depending on the forum:
- Some forums: `["tag1", "tag2"]` (string array)
- Other forums: `[{id: 1, name: "tag1", slug: "tag1"}, ...]` (object array)

**Solution:**
1. Normalize tags to strings in the API route (`api/discourse/route.ts`)
2. Add defensive handling in component (`DiscussionItem.tsx`)
3. Update TypeScript types to reflect actual API behavior

**Pattern:** Always normalize external API data at the boundary (API route), and add defensive handling in components for edge cases.

```typescript
// Normalize at API boundary
tags: (topic.tags || []).map((tag) =>
  typeof tag === 'string' ? tag : tag.name
)

// Defensive in component
const tagName = typeof tag === 'string' ? tag : tag.name;
```

---

## Authentication

### Privy SDK Configuration Changes
**Date:** February 2, 2026
**Issue:** TypeScript error on `embeddedWallets.createOnLogin`
**Root Cause:** Privy SDK API changed - `createOnLogin` is now nested under `ethereum`/`solana`

**Solution:**
```typescript
// Old (broken)
embeddedWallets: {
  createOnLogin: 'off',
}

// New (correct)
embeddedWallets: {
  ethereum: {
    createOnLogin: 'off',
  },
}
```

**Pattern:** Check SDK changelogs when upgrading, and let TypeScript guide you to API changes.

---

## Build & Deployment

### Railway Node Version
**Date:** February 2, 2026
**Issue:** Build errors in Railway (investigating)
**Potential Cause:** Railway may use older Node version by default

**Solution:** Add `nixpacks.toml` to specify Node version:
```toml
[phases.setup]
nixPkgs = ["nodejs_22"]
```

**Pattern:** Always explicitly specify Node version for production deployments.

---

### Environment Variables for Client Components
**Pattern:** Use `NEXT_PUBLIC_` prefix for env vars needed in client components.

```bash
# Server-only (API routes)
DATABASE_URL=...

# Client-accessible
NEXT_PUBLIC_PRIVY_APP_ID=...
```

---

## React Patterns

### Conditional Hooks Are Not Allowed
**Issue:** Can't conditionally call hooks based on configuration

**Wrong:**
```typescript
function useAuth() {
  if (isConfigured) {
    return usePrivyHooks(); // ❌ Conditional hook call
  }
  return fallbackState;
}
```

**Right:** Use provider pattern with conditional rendering:
```typescript
function AuthProvider({ children }) {
  if (!isConfigured) {
    return <NoAuthProvider>{children}</NoAuthProvider>;
  }
  return (
    <PrivyProvider>
      <PrivyAuthInner>{children}</PrivyAuthInner>
    </PrivyProvider>
  );
}
```

---

### Hydration Safety for localStorage
**Pattern:** All hooks using localStorage must handle SSR:

```typescript
const [data, setData] = useState<T>(() => {
  if (typeof window === 'undefined') return defaultValue;
  return getFromStorage();
});
```

Or use hydration state:
```typescript
const [isHydrated, setIsHydrated] = useState(false);
useEffect(() => setIsHydrated(true), []);
```

---

## Database

### Database Client
**Note:** The project originally used `@neondatabase/serverless` but has since migrated to `postgres` (Porsager's library, v3.4.8). The `@neondatabase/serverless` package is still in `package.json` but no longer imported. The `postgres` library uses tagged template literals for queries:
```typescript
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!);
const users = await sql`SELECT * FROM users WHERE email = ${email}`;
```

---

## Testing

### QA Testing Checklist
Before deploying, test:
1. [ ] Discussion feed loads without errors
2. [ ] Tags render correctly (mixed formats)
3. [ ] Keyword alerts highlight text
4. [ ] Bookmarks work (add/remove/view)
5. [ ] Read/unread tracking works
6. [ ] Theme toggle persists
7. [ ] Mobile layout works
8. [ ] Search filters work
9. [ ] Onboarding flow completes

---

## Authentication

### Requiring Login with AuthGate Pattern
**Date:** February 2, 2026
**Pattern:** Use an AuthGate component to wrap protected content

```typescript
// AuthGate.tsx
export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, isConfigured, login } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!isConfigured) return <ConfigurationError />;
  if (!isAuthenticated) return <LoginScreen onLogin={login} />;

  return <>{children}</>;
}

// Usage in app page
<AuthGate>
  <AppContent />
</AuthGate>
```

**Benefits:**
- Clean separation of auth logic from app content
- Easy to customize login screen appearance
- Handles loading, unconfigured, and unauthenticated states

---

## Git Workflow

### Commit Message Format
```
<type>: <short description>

<detailed description if needed>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types: `fix`, `feat`, `refactor`, `docs`, `chore`, `test`
