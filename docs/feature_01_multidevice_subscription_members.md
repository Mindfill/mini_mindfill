# Feature 01 — Multi-Device Enforcement + Subscription Members
## Techcess Secondary School Sprint — September 2026

---

## Scope
Secondary school only. Uni side is unaffected.
- Max 3 users per subscription: 1 owner + 2 members
- Max 2 devices per user
- Entire secondary school content is paywalled except Ch00 Mental Models (free hook)

---

## Device Identification Strategy — Hybrid Option C

Primary: persistent UUID token stored in both `localStorage` and a non-httpOnly cookie.
Fallback: canvas fingerprint hash used only when token is missing (browser storage cleared) to attempt silent token recovery before counting as a new device.

**Token lifecycle:**
- Generated client-side via `crypto.randomUUID()` on first app load
- Stored: `localStorage['x-device-token']` + cookie `x-device-token` (maxAge: 365 days)
- Sent on every API request as `X-Device-Token` header
- On login/registration: server rotates token — generates fresh UUID server-side, returns in response, client replaces stored value. Kills token fixation attacks.
- On subscription lapse: all user's device tokens set `is_active = false`. On resubscription, user re-registers devices naturally on next login.

**Fingerprint fallback:**
- Collected: canvas fingerprint + user agent + screen resolution + timezone + language
- Hashed: SHA-256, stored as `fingerprint_hash` on `user_devices`
- Used only when no token present — check if fingerprint matches an existing inactive token for this user, if yes reissue that token silently
- Never used as primary auth signal

---

## Security Considerations

**XSS / token theft:**
- Bleach sanitization on all text inputs (chat, profile fields, quiz answers) — utility function, not Pydantic (Pydantic validates structure, not malicious markup)
- Content Security Policy headers on server to block inline script injection
- Token in localStorage is readable by JS — accepted tradeoff for web-only; cookie copy survives localStorage clear

**Token fixation:**
- Mitigated by server-side token rotation on every login/signup
- Tokens from URL parameters never accepted — header only

**Fingerprint spoofing:**
- Accepted risk at this threat level — fingerprint is recovery fallback only, not auth
- Attacker still needs valid Supabase JWT regardless

**Race condition on device registration:**
- Device limit check lives in a DB RPC (`can_register_device`), not application logic
- DB function uses row-level lock — atomic, no race condition possible
- Application-level checks are explicitly not used for this

**Parameterized queries:**
- All RPCs use `$1`, `$2` style parameters
- No f-string or string concatenation SQL anywhere in this feature

**Rate limiting:**
- Device endpoints: 20 requests/minute per user
- Invite endpoints: 10 requests/minute per user
- Auth endpoints: 5 requests/minute per IP

---

## DB Schema

### user_devices
```sql
CREATE TABLE user_devices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token      text NOT NULL UNIQUE,
  fingerprint_hash  text,
  device_name       text,  -- auto-generated from User-Agent: "Chrome on iPhone"
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  registered_at     timestamptz NOT NULL DEFAULT now(),
  is_active         boolean NOT NULL DEFAULT true
);

CREATE INDEX idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX idx_user_devices_token ON user_devices(device_token);
CREATE INDEX idx_user_devices_user_active ON user_devices(user_id, is_active);
```

RLS: users can only read/update their own rows.

### subscription_members
```sql
CREATE TABLE subscription_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('owner', 'member')),
  invited_by       uuid REFERENCES auth.users(id),
  invited_at       timestamptz DEFAULT now(),
  joined_at        timestamptz,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'active', 'inactive', 'removed')),
  UNIQUE(subscription_id, user_id)
);

CREATE INDEX idx_subscription_members_subscription ON subscription_members(subscription_id);
CREATE INDEX idx_subscription_members_user ON subscription_members(user_id);
```

### subscription_invites
```sql
CREATE TABLE subscription_invites (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  invited_email    text NOT NULL,
  token_hash       text NOT NULL,  -- SHA-256 of actual token, never store raw
  expires_at       timestamptz NOT NULL,  -- now() + 48 hours
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscription_id, invited_email)
);

CREATE INDEX idx_subscription_invites_email ON subscription_invites(invited_email);
CREATE INDEX idx_subscription_invites_token ON subscription_invites(token_hash);
```

---

## DB RPCs

### can_register_device
```sql
CREATE OR REPLACE FUNCTION can_register_device(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) < 2
  FROM user_devices
  WHERE user_id = p_user_id AND is_active = true;
$$;

REVOKE ALL ON FUNCTION can_register_device FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_register_device TO authenticated;
```

### can_add_member
```sql
CREATE OR REPLACE FUNCTION can_add_member(p_subscription_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) < 3
  FROM subscription_members
  WHERE subscription_id = p_subscription_id
    AND status IN ('active', 'pending');
$$;

REVOKE ALL ON FUNCTION can_add_member FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_add_member TO authenticated;
```

---

## API Endpoints

```
GET    /devices                          — list user's registered devices
DELETE /devices/{device_token}           — deregister a device (is_active = false)
GET    /subscriptions/members            — owner lists linked members
POST   /subscriptions/invite             — owner sends invite email
POST   /subscriptions/invite/accept      — invitee accepts via token
DELETE /subscriptions/members/{user_id}  — owner removes a member
```

---

## Middleware Chain (per protected request)

```
1. Supabase JWT verification (existing)
2. Subscription access check:
   - Does user own an active subscription?
   - OR is user an active member of someone else's active subscription?
   - Returns: has_access (bool), tier, subscription_id
3. Device check (paid users only):
   - Read X-Device-Token header
   - Verify token exists in user_devices with is_active = true
   - If missing: check fingerprint fallback
   - If no match and count < 2: register new device, proceed
   - If no match and count = 2: return 403 with device list payload
4. Secondary school content check:
   - Chapter = Ch00 Mental Models → allow (free)
   - Any other chapter → require paid access from step 2
```

---

## Invite Flow — Full Detail

### New user invited (no Techcess account):
```
POST /subscriptions/invite {email}
→ can_add_member check (DB RPC)
→ Create subscription_invites row (token stored as SHA-256 hash)
→ Create subscription_members row: status=pending, user_id=null
→ Send Resend template: "invite_sent"
→ Invitee clicks link → /invite/accept?token=xxx
→ No account found → redirect to signup
→ Account created → auth trigger fires → user_profiles row created
→ Post-signup: check subscription_invites for email match
→ Found → resolve: subscription_members.user_id = new user_id, status=active
→ Delete subscription_invites row
→ Invitee enters onboarding as Pro user
→ Send Resend template: "invite_accepted" to owner
```

### Existing free user invited:
```
POST /subscriptions/invite {email}
→ same as above but user_id populated immediately on subscription_members row
→ Invitee clicks link → already has account → logs in if needed
→ POST /subscriptions/invite/accept
→ subscription_members status → active
→ Existing user's paid access resolves from owner's subscription immediately
→ Invitee lands on dashboard as Pro user (no onboarding repeat)
→ Send Resend template: "invite_accepted" to owner
```

### Expired token — owner resends:
```
POST /subscriptions/invite {email} (same endpoint, same email)
→ Find existing subscription_invites row for this email+subscription
→ Update: new token_hash, new expires_at (now() + 48hrs)
→ subscription_members row untouched (still pending)
→ Resend Resend template: "invite_sent" (same template, fresh token)
```

---

## Subscription Lapse / Restore — Member Handling

**On owner lapse (APScheduler existing worker):**
```
subscription status → lapsed
→ All subscription_members where subscription_id = X AND status = active
→ Set status = inactive
→ Send Resend template: "subscription_lapsed_member" to each member
→ Members hit paid features → 402 → "Your shared subscription has ended"
→ Members can subscribe independently at any point
```

**On owner resubscription (Paystack webhook):**
```
subscription status → active
→ All subscription_members where subscription_id = X AND status = inactive
→ Set status = active (automatically restored)
→ Note: members with status = removed are never restored
```

**Owner manually removes a member:**
```
DELETE /subscriptions/members/{user_id}
→ subscription_members status = removed (permanent, survives owner resubscription)
→ Member loses paid access immediately
→ Member's account, progress, knowledge state: untouched
→ Member drops to Free tier behaviour
→ Send Resend template: "member_removed" to removed member
```

---

## Resend Email Templates (this feature)

```
1. invite_sent           — to invitee (new or existing user)
2. invite_accepted       — to owner (confirmation)
3. member_removed        — to removed member
4. subscription_lapsed_member — to all members when owner lapses
5. password_reset        — Supabase native until custom domain, then Resend
6. welcome               — fires on any new account creation
```

All templates use a placeholder sender domain until custom domain is configured.
Custom domain change = one config value update. No template edits needed.

---

## Email/Password Authentication

- Enabled via Supabase Dashboard → Authentication → Providers → Email
- Writes to auth.users identically to OAuth
- Existing user_profiles creation trigger fires on signup regardless of auth method
- Password reset: Supabase native email until custom domain → then Resend
- Invite resolution on signup works identically for email/password and OAuth signups
- Same onboarding funnel for all auth methods

---

## Content Access Rules (Secondary School)

```
Ch00 Mental Models → FREE (all users including unauthenticated preview)
Ch01–Ch12          → PAID (active subscription required, owner or member)
```

Enforced at endpoint level, not just frontend routing. Backend checks chapter_id
against a hardcoded free-access list before subscription middleware runs.

---

## user_events Logging (this feature)

All logged to existing user_events table:
```
device_registered
device_deregistered
device_limit_hit
member_invited
member_joined
member_removed
invite_expired
invite_resent
subscription_member_lapsed
subscription_member_restored
```

No model_usage entries — no AI calls in this feature.

---

## Deregistration

- No cooldown
- Sets is_active = false immediately
- Slot opens immediately for new device registration
- Audit trail preserved (row stays in table)

---

## Open Questions — Resolved

| Question | Decision |
|----------|----------|
| Device limit | 2 per user |
| Users per subscription | 3 (1 owner + 2 members) — secondary school only |
| Uni side | 1 user, 1 subscription, 2 devices |
| Member grace period on lapse | None — members lapse with owner simultaneously |
| Member auto-restore on resubscription | Yes — all inactive members restored |
| Removed members on resubscription | Stay removed permanently |
| Deregistration cooldown | None |
| Free chapter | Ch00 Mental Models only |
| XSS sanitization | Bleach utility function (Pydantic does not cover this) |

