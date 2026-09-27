# Authentication

How sign-in works in Helping Station DEU, and what to do when it does not.

## The four ways in

| Method | Provider id | Who uses it | Created by |
| --- | --- | --- | --- |
| Organiser e-mail + password | `admin` | Staff only | First-run `/setup`, seed, or a manual row |
| Student e-mail + password | `student` | Students | First registration |
| Student claim code | `student` | Students who lost their password | First registration |
| Google | `google` | Students | Provisioned on first sign-in |

Organisers can only ever use e-mail and password. To create the first one without a terminal, see
[Create the first admin](DEPLOYMENT.md#6-create-the-first-admin). The Organiser tab on `/login` never renders an
OAuth button, and `authorize` in the `admin` provider independently re-checks that the row's role is
`ADMIN`. Hiding the button is presentation; the role check in the provider is the control.

## How the code is arranged

| File | Responsibility |
| --- | --- |
| `src/auth.ts` | Provider definitions, credential verification, the `signIn` / `jwt` / `session` callbacks |
| `src/lib/env.ts` | The only place environment variables are read, plus `isGoogleEnabled()` |
| `src/app/(site)/login/page.tsx` | Server component. Decides which buttons exist and passes booleans down |
| `src/components/auth/login-form.tsx` | Client component. Renders buttons from those booleans |

### Why the enabled/disabled check runs on the server

This is the single most common way to get OAuth buttons wrong in Next.js, and it is worth
understanding rather than copying.

`login-form.tsx` is `"use client"`. Non-`NEXT_PUBLIC_` environment variables are replaced with
`undefined` in the browser bundle — the secrets are stripped on purpose. So this component:

```ts
// Wrong. Renders on the server, disappears on hydration.
const googleEnabled = env.googleClientId.length > 0;
```

works in local development, where there is often no client/server split to notice, and produces a
button that flashes and vanishes in production. The correct shape is to resolve it in the server
component and pass a boolean:

```ts
// src/app/(site)/login/page.tsx
const googleEnabled = isGoogleEnabled();
return <LoginForm googleEnabled={googleEnabled} />;
```

A boolean survives serialisation. An environment variable does not.

## The OAuth flow, end to end

1. The browser posts to `/api/auth/signin/google` with a CSRF token.
2. NextAuth redirects to Google with `client_id`, `redirect_uri`, `scope=openid email profile`,
   and a PKCE `code_challenge`.
3. Google authenticates the user and redirects back to
   `https://<your-domain>/api/auth/callback/google?code=...&state=...`.
4. The server exchanges the code for tokens. **This is the only request that uses the client
   secret.** It never leaves the server.
5. The `signIn` callback runs. For the Google provider it:
   - extracts the e-mail,
   - rejects it if `GOOGLE_ALLOWED_DOMAIN` is set and the address is outside it,
   - returns the existing user, or creates a `STUDENT` row with `passwordHash: null`.
6. A JWT is issued and the user lands on `/account`.

## Who is allowed to sign in

`GOOGLE_ALLOWED_DOMAIN` decides this, and it is optional.

| Value | Who can sign in |
| --- | --- |
| unset or empty (the default) | **Any** Google account. Each first sign-in creates a new `STUDENT` row. |
| `deu.ac.kr` or `@deu.ac.kr` | Only addresses in that domain. Others are refused before a row is written. |

The leading `@` is optional. The comparison is a case-insensitive suffix match, so `x@evil-deu.ac.kr`
is correctly rejected.

To close registration once an event has happened, set the variable and redeploy. You do not need a
code change or a commit.

### Making the consent screen allow everyone

The domain check is only half of it. Google's OAuth consent screen has its own gate:

- **Testing** — only the accounts listed under **Test users** (maximum 100) can complete sign-in.
  Everyone else sees `access_denied`.
- **In production** — anyone with a Google account can sign in.

So for "anyone can log in" you need **both**: the consent screen set to *In production*, **and**
`GOOGLE_ALLOWED_DOMAIN` left empty. With only the scopes this app requests (`openid email profile`),
publishing does not require Google's verification review.

## What an OAuth account looks like in the database

A provisionable account, straight after first sign-in:

| Column | Value | Why |
| --- | --- | --- |
| `id` | `google_<google-subject>` | The provider's stable user id |
| `email` | the address Google returned | Unique, and the lookup key |
| `name` | profile name, else the local part of the e-mail | Google may not send one |
| `studentId` | `GOOGLE_<first 8 of sub>` | Placeholder until an organiser fills in the real one |
| `department` | `Unknown` | No provider returns a faculty |
| `role` | `STUDENT` | OAuth can never mint an admin |
| `passwordHash` | `null` | The provider is the only way in |
| `isActive` | `true` | |
| `isDemo` | `false` | Never mixed with demo data |

Two deliberate choices:

- **The lookup is by e-mail, never by provider id.** Matching on a provider subject id would let
  anyone who registers that address at a different provider link themselves to the account.
- **`passwordHash` is null, not a random string.** A null is honest: there is no password. The
  credential provider already refuses rows with no hash.

## Setting up Google

Google requires 2-Step Verification on the account that owns the Cloud project. Have an
authenticator app ready before starting.

1. [Google Cloud Console](https://console.cloud.google.com/) → create or select a project.
2. **APIs & Services → OAuth consent screen** → configure. Then either publish the app or add
   yourself under **Test users**. Skip this and every sign-in fails with `access_denied`.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
4. Application type **Web application**:
   - Authorized JavaScript origin: `https://your-domain`
   - Authorized redirect URI: `https://your-domain/api/auth/callback/google`
5. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Redeploy.

## Other providers

Not configured in this deployment. Google is the only OAuth provider enabled.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Button does not appear | The environment variable is not set, or not in the environment you deployed | Check Vercel → Settings → Environment Variables **and** that the scope includes Production. Redeploy — adding a variable does not affect the running deployment. |
| Button appears, then disappears | `isGoogleEnabled()` is being read in a client component | It must be read in `src/app/(site)/login/page.tsx` and passed as a prop |
| `redirect_uri_mismatch` | The redirect URI does not match byte for byte | Check for a trailing slash, `http` vs `https`, or `www`. Google reports this only on the consent screen, not in server logs. |
| `access_denied` | The consent screen is not published and you are not a test user | Publish the consent screen, or add the address as a test user |
| Redirects straight back to `/login` | `AUTH_SECRET` differs between the instances handling the two requests, so `state` will not verify | One secret, everywhere. Rotating it invalidates all sessions. |
| `Configuration` error from NextAuth | NextAuth cannot determine its own base URL | Set `NEXT_PUBLIC_APP_URL`, and `AUTH_URL` if the host header is not trustworthy |
| Any account rejected | The address is outside `GOOGLE_ALLOWED_DOMAIN`, or that variable is set and you expected it to be open | Check the variable. Empty means anyone may sign in. See [Who is allowed to sign in](#who-is-allowed-to-sign-in). |
| Everyone else gets `access_denied` but you can sign in | The consent screen is still in **Testing**, so you are a test user and they are not | Switch the consent screen to **In production** |
| Sign-in works, then every page 500s | No `User` row for that identity, or the database is unreachable | Check `/admin/settings` and the `DATABASE_URL` |

## Rotating a leaked secret

If `AUTH_SECRET` or `GOOGLE_CLIENT_SECRET` is ever exposed:

1. Rotate it at the provider first, so the old value is dead immediately.
2. Put the new value in the host's environment.
3. Redeploy. **All sessions end.** Say so in advance if people are mid-draw.

`AUTH_SECRET` is local to this app — `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

## Adding another provider

1. Import the provider from `next-auth/providers/*` in `src/auth.ts`.
2. Add the credentials to `src/lib/env.ts` and an `is<Name>Enabled()` helper.
3. Add the id to `OAUTH_STUDENT_PROVIDERS` so first sign-in provisions an account.
4. If the provider might not return an e-mail at all, handle that before the domain check and
   report it as its own message. Do not rely on the provider's own `profile` hook to enforce the
   domain; throwing there produces an unhandled error rather than something the participant can act
   on.
5. Pass a boolean down from `src/app/(site)/login/page.tsx` and render the button in
   `login-form.tsx`. Reuse the existing button class string.
