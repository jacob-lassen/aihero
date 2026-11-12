# How in-app notification vendors model notifications

Research for [#4](https://github.com/jacob-lassen/aihero/issues/4), part of the map [#3 Wayfinder: in-app Notifications](https://github.com/jacob-lassen/aihero/issues/3).
Researched 2026-11-12 against official docs for Knock, Novu, MagicBell and Courier. **This document does not pick a vendor.** It looks for the common shape that a vendor-neutral seam in Cadence should match.

Cadence context: a "Notification" is a message shown to one person inside Cadence. Each has one recipient and is read or unread. v1 stores Notifications as text files on disk and loads them into memory on boot.

## TL;DR

- **Two triggering models exist.** Knock, Novu and Courier (with a template) take a *workflow/template key + recipients + data*, and the **vendor renders the copy** from a template it stores. MagicBell, and Courier with inline `content`, take **pre-rendered title/content from the app**. Novu Framework sits in between: the workflow is defined in your code, and Novu calls back into your app to resolve the content.
- **Every vendor fans out.** One trigger can name many recipients (Knock and MagicBell allow up to 1,000 per call) or a list/topic/audience. The vendor stores **one message per recipient**. Cadence's "one recipient per Notification" matches the stored unit.
- **Recipients are your own user IDs**, as strings (`id` / `subscriberId` / `user_id` / `external_id`). All four create or identify users inline on trigger, so a separate sync step is not required.
- **State is timestamps, not one boolean.** Every vendor tracks *read* and *archived*. Three of four also track *seen* (shown in the feed, which clears the badge) separately from *read*. Courier adds *opened*, Knock adds *interacted*/*link_clicked*. Each is a nullable `*_at` timestamp, set mostly by the client SDK, with "mark all read" as the standard bulk operation.
- **The click-through is a single optional URL** on the notification (`action_url` / `redirect.url` / action `href`). Some vendors add 1–2 labelled action buttons.
- **Local/offline dev:** only Novu is self-hostable (Docker, with a heavy stack). Novu also has a tunnel-based `npx novu dev`. Knock offers a cloud *development environment*. Neither MagicBell nor Courier documents a local mode. **None has an offline mode**, so Cadence needs its own local implementation behind the seam, as `.outbox` is for mail.

## 1. Triggering: what the app sends and who renders the copy

| Vendor | Call | Payload | Who renders copy |
| --- | --- | --- | --- |
| Knock | `POST /workflows/:key/trigger` | `recipients`, `actor` (optional), `data`, `tenant`, `cancellation_key`; `Idempotency-Key` header | Knock renders templates (Liquid) authored in its dashboard. `data` is "a map of properties that are required in the templates in this workflow". |
| Novu | trigger by workflow identifier | `to` (subscriber/s or topic), `payload`, overrides | Dashboard workflows: Novu renders the templates. Novu Framework (code-first): the step resolver runs in your app ("just-in-time"), reached through a Bridge endpoint. |
| MagicBell | `POST /v2/broadcasts` | `title` (required), `content`, `action_url`, `category`, `topic`, `custom_attributes`, `recipients[]`, per-channel `overrides` | **The app**: title and content arrive already rendered. |
| Courier | `POST /send` | `message.to`, then either `template` (ID/alias) + `data`, or inline `content` (`title` + `body`, or Elemental); `routing`, `channels` (incl. `inbox`) | The vendor renders `template` + `data`. Inline `content` comes from the app (it can still interpolate `{name}` from `data`). |

Sources:
- Knock workflows: one key per workflow; a trigger "starts a workflow run for the recipients specified using the `data`". https://docs.knock.app/concepts/workflows
- Knock trigger API body fields and the 1,000-recipient limit: https://docs.knock.app/send-notifications/triggering-workflows/api
- Knock idempotency (`Idempotency-Key` only on trigger, 24h replay): https://docs.knock.app/reference
- Novu trigger (template identifier, subscribers in `to`, payload, overrides; topic fan-out): https://docs.novu.co/platform/concepts/trigger
- Novu Framework resolvers in app code ("removing the need to store all of your subscriber data in Novu"): https://docs.novu.co/framework/introduction ; the CLI tunnels to the Bridge endpoint at `localhost:4000/api/novu`: https://docs.novu.co/framework/studio
- MagicBell Broadcast schema: https://www.magicbell.com/docs/api/openapi.json , https://www.magicbell.com/docs/api
- Courier send body (`to`, `template` vs `content`, `data`, `routing`, `channels.inbox`): https://www.courier.com/docs/reference/send/message

**Takeaway:** two of the four can work from pre-rendered text, and the template-key vendors all accept arbitrary `data`. A seam that sends **a type/key plus a data payload, with the rendered title/body/url also available**, can be adapted to either model. A seam that sends only rendered text would waste the template-based vendors' rendering. A seam that sends only a key would need a template store before MagicBell could be used.

## 2. Recipients and fan-out

- **Identification:** the app's own user ID, as a string. Knock recipients can be IDs or inline user objects, which Knock identifies before the run. Novu uses `subscriberId` and creates new subscribers on first trigger or session. MagicBell takes `external_id` or `email` and auto-creates unknown users. Courier takes `user_id` / `email` / `phone_number`, or `list_id` / `audience_id` / `list_pattern`.
- **Fan-out:** Knock: "a workflow run is always executed against a single recipient"; one trigger becomes N recipient runs. Novu: "each subscriber in the trigger gets its own notification entity"; topics fan out to subscriptions. MagicBell: "creates a notification for each recipient", 1–1,000 recipients per broadcast. Courier: "assigns a unique message_id to each derived message"; an audience sends "to each user in the audience".
- **Actor:** Knock (`actor`) and Novu (actor/avatar) model "who caused this" as a first-class field. MagicBell and Courier leave it to custom data.
- **Tenant:** Knock has `tenant`. Courier recipients carry `tenant_id`.

Sources: Knock as above; Novu https://docs.novu.co/platform/concepts/trigger and https://docs.novu.co/platform/inbox/overview ; MagicBell https://www.magicbell.com/docs/api/openapi.json ; Courier https://www.courier.com/docs/reference/send/message

**Takeaway:** the stored unit is always one message per recipient, which is Cadence's definition. Fan-out is a convenience on the *send* side. A seam method that accepts one recipient per call (or a list it loops over) maps cleanly onto all four.

## 3. Feed reading and state

### How the feed is read
- **Knock:** client feeds API plus a websocket for real-time delivery; React / React Native / iOS / Android prebuilt components or headless hooks. The feed returns aggregate unread/read/seen counts for badges. Items include `data` (full trigger data), actors, the recipient, and public vars. https://docs.knock.app/in-app-ui/feeds/overview , https://docs.knock.app/integrations/in-app/knock
- **Novu:** `<Inbox />` component, `@novu/react` hooks, or framework-agnostic `@novu/js`. Authenticated by `subscriberId` (plus an HMAC `subscriberHash` in production). https://docs.novu.co/platform/inbox/overview
- **MagicBell:** user-authenticated REST: `GET /notifications`, `GET /notifications/{id}`. https://www.magicbell.com/docs/api/openapi.json
- **Courier:** client SDKs (`<CourierInbox />`, web components, mobile). The backend mints a JWT for `userId`, with scopes `inbox:read:messages` / `inbox:write:events`. https://www.courier.com/docs/platform/inbox/inbox-overview , https://www.courier.com/docs/sdk-libraries/courier-js-web

All four expect **the browser to talk to the vendor directly**, authenticated with a token or hash your server issues. Server-side reads exist (Knock, MagicBell) but are not the main path.

### States

| Vendor | States (all nullable timestamps) | Notes |
| --- | --- | --- |
| Knock | `seen_at`, `read_at`, `interacted_at`, `link_clicked_at`, `archived_at` | Seen/interacted/archived set automatically by the in-app feed; read set by the React SDK or the message status API. Archived items drop out of the feed. Sent messages can't be edited: archive and re-trigger instead. |
| Novu | read/unread, seen, archived, snoozed | Changes made in Inbox sync to the backend in real time. |
| MagicBell | `seen_at`, `read_at`, `archived_at` (+ `discarded_at`); `status` ∈ `unseen`/`unread`/`read`/`archived` | `POST /notifications/{id}/read|unread|seen|archive|unarchive`; bulk `POST /notifications/read|seen|archive`, filterable by `category`/`topic`. |
| Courier | `read`, `opened`, `archived` (ISO strings) | SDK: read/unread/opened/clicked/archive/unarchive; bulk `readAll`, `archiveRead`, `archiveAll`. Opening the matching email can mark the Inbox message read. |

Sources: https://docs.knock.app/send-notifications/message-statuses ; https://docs.novu.co/platform/inbox/overview ; https://www.magicbell.com/docs/api/openapi.json ; https://www.courier.com/docs/sdk-libraries/courier-js-web , https://www.courier.com/docs/platform/inbox/inbox-overview

**Takeaway:** *read* is universal. *Seen* (badge cleared because the feed was shown) is separate from *read* in three of four. *Archived* is universal. Every vendor stores state as a timestamp, not a boolean, and "mark all read" is the standard bulk operation. Cadence v1 needs only read/unread, but storing `readAt: Date | null` instead of `read: boolean` costs nothing and maps 1:1.

## 4. Click-through links

- **Knock:** in-app step "include click action": a static or Liquid-templated URL. Clicking the cell opens it, and the click is recorded as `interacted`. Single- and multi-action variants add 1–2 buttons, each with its own URL. https://docs.knock.app/integrations/in-app/knock , https://docs.knock.app/send-notifications/message-statuses
- **Novu:** `redirect: { url, target }` plus optional `primaryAction` / `secondaryAction` `{ label, redirect: { url, target } }`. Only absolute http(s) URLs, root-relative `/paths` or Liquid-built URLs are kept. https://docs.novu.co/framework/typescript/steps/inApp
- **MagicBell:** `action_url` (nullable, max 2048), overridable per channel. https://www.magicbell.com/docs/api/openapi.json
- **Courier:** `actions: InboxAction[]` with `content` (label) and `href`; click tracking via `clickTrackingId`. https://www.courier.com/docs/sdk-libraries/courier-js-web , https://www.courier.com/docs/reference/send/message

**Takeaway:** one optional URL per notification is universal. Root-relative paths (`/courses/x/lessons/y`) are explicitly supported by Novu and are the natural choice for in-app links. Labelled action buttons are an optional extra.

## 5. Self-hosting and local/offline dev

- **Knock:** cloud only. Optional *development* environment with its own users and keys. No local, offline or mock mode documented. https://docs.knock.app/concepts/environments
- **Novu:** open-source community edition, self-hostable with Docker. It needs MongoDB, two Redis clusters and S3-compatible storage, and some Inbox features are cloud-only. `npx novu dev` opens a per-session "Local" dashboard environment that **tunnels from Novu Cloud** to your app's Bridge, so it is not offline. https://docs.novu.co/community/self-hosting-novu/overview , https://docs.novu.co/framework/studio
- **MagicBell:** cloud only. No local mode in the docs reviewed.
- **Courier:** cloud only. No local mode in the docs reviewed.

**Takeaway:** none offers a no-network local mode. Cadence needs its own local implementation behind the seam, which is exactly the v1 plan (text files on disk). This is the same pattern as the mailer's `.outbox` dump.

## 6. Common denominator for a vendor-neutral seam

The fields and operations below exist, in some form, at all four vendors. A seam that uses only these could later be backed by any of them.

**Send side (server):**
- `notify({ recipientId, type, data, title, body, url? })`
  - `recipientId`: Cadence's user ID as a string. Every vendor accepts your own ID and auto-creates unknown users.
  - `type`: a stable key such as `"lesson-comment-reply"`. It maps to Knock's workflow key, Novu's workflow ID, Courier's template alias, and MagicBell's `category`.
  - `data`: a JSON-serialisable payload. It is the template input for Knock/Novu/Courier and goes into `custom_attributes` for MagicBell.
  - `title` / `body`: rendered copy. MagicBell (and inline Courier) need it. Template vendors ignore it or use it as a fallback. Keeping the renderer in Cadence for v1 keeps both options open.
  - `url`: an optional root-relative click-through path.
- One call per recipient, or a list the implementation loops over. Fan-out stays an implementation detail.
- An optional idempotency or dedupe key is worth reserving, because Knock supports it natively.

**Read side:**
- `listForUser(userId)` returns notifications newest-first, each with `{ id, recipientId, type, title, body, url?, data, createdAt, readAt: Date | null }`.
- `unreadCount(userId)`.
- `markRead(userId, id)` and `markAllRead(userId)`, plus `markUnread` if the UI wants it (MagicBell and Courier support it).
- `seenAt` and `archivedAt` are optional extras for later. They need not be in v1, but the timestamp style leaves room for them.

**What does *not* fit the common denominator** (keep it out of the seam, or optional): actors and tenants (Knock-centric), snoozing (Novu), multi-action buttons, channel routing and preferences, and real-time websockets (each vendor ships its own client).

**Architectural caveat:** every vendor's main read path is *browser → vendor* with a vendor token, not *browser → Cadence server → vendor*. A seam that only reads server-side, through a Cadence loader, works with Knock and MagicBell (both have server-readable APIs). For Novu and Courier it may need their server/REST APIs rather than their prebuilt UI components. This matters when deciding whether the seam lives purely on the server, as `MailTransport` does.
