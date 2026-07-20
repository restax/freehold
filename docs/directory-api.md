# Directory syndication API

Freehold's coordinator directory merges two sources into one searchable list,
filterable by **Freehold Enabled** or **Public Directory**:

| Source | Who they are | What a user can do |
|---|---|---|
| Freehold Enabled | Workspaces on this Freehold instance that opted in | Hand them a file directly (engagements) |
| Public Directory | Coordinators syndicated from FindTCPros | Contact them on their public profile |

Syndication runs both directions, and the two feeds use the same row shape so
either side can merge the other's.

---

## Outbound — Freehold publishes (built)

```
GET /api/directory/feed
```

Returns every workspace that opted in, and only the fields they filled in for
publication. No authentication by default: this is exactly the listing a
workspace asked to have published. Set `FREEHOLD_DIRECTORY_FEED_TOKEN` to
require `Authorization: Bearer <token>` instead.

```json
{
  "source": "freehold",
  "generatedAt": "2026-07-20T09:30:00.000Z",
  "listings": [
    {
      "slug": "maplewood-transactions",
      "name": "Maplewood Transactions",
      "states": ["FL", "TX"],
      "specializations": ["Residential"],
      "software": ["Dotloop", "DocuSign"],
      "availability": "Per transaction",
      "pricingModel": "Per transaction",
      "yearsExperience": 8,
      "remote": true,
      "blurb": "Buy-side residential, 48-hour turnaround",
      "contactEmail": "hello@maplewood.example",
      "freeholdEnabled": true
    }
  ]
}
```

Never included: transactions, clients, contacts, documents, people, or any
workspace that has not opted in. `Cache-Control: public, max-age=300`, and
`Access-Control-Allow-Origin: *` so a browser-side directory can read it.

**For FindTCPros:** poll this endpoint and render matching rows with a
"Freehold Enabled" badge. `slug` is stable per workspace and is the natural
upsert key.

---

## Inbound — Freehold consumes (built, awaiting the endpoint)

Configure with environment variables; without `FINDTCPROS_FEED_URL` the
directory simply shows Freehold workspaces only, which is the self-hosted
default.

```bash
FINDTCPROS_FEED_URL=https://findtcpros.vercel.app/api/directory/feed
FINDTCPROS_FEED_TOKEN=optional-bearer-token
```

### What FindTCPros needs to expose

A `GET` endpoint returning JSON: either a bare array of rows, or
`{ "listings": [...] }`. Every field except `slug` and `name` is optional.

| Field | Type | Notes |
|---|---|---|
| `slug` | string | **Required.** Stable id; also the profile path |
| `name` | string | **Required.** |
| `state` or `states` | string / string[] | Two-letter codes; anything else is dropped |
| `city` | string | |
| `specializations` | string[] | `Residential`, `Commercial`, `Luxury`, `Land` |
| `software` | string[] | `Dotloop`, `DocuSign`, `DocuSign Rooms`, `SkySlope`, `Command`, `ZipForms`, `Paperless Pipeline`, `Brokermint`, `TransactionDesk` |
| `availability` | string | `Per transaction`, `Part-time`, `Full-time` |
| `pricingModel` | string | `Per transaction`, `Monthly retainer`, `Both` |
| `licenseStatus` | string | `Licensed agent`, `Unlicensed admin`, `Licensed broker` |
| `yearsExperience` | number | |
| `remote` / `verified` | boolean | Must be a real boolean; `"yes"` reads as false |
| `rating` / `reviewCount` | number | |
| `blurb` | string | |
| `profileUrl` | string | Absolute or relative; **must resolve to the feed's own origin** |

The vocabularies above match the FindTCPros filter lists exactly, so a merged
filter means the same thing on both sides.

### How Freehold treats the feed

It is a third party, so every failure degrades to "no public listings" rather
than breaking the page:

- 4 s timeout, cached for an hour, at most 2000 rows read
- Non-200, malformed JSON, or a non-array body → quiet notice, Freehold rows still render
- A row missing `slug` or `name`, or with wrong types in any field, is skipped — one bad row never breaks the list
- Text renders as text; a `profileUrl` on any other origin is discarded, so a compromised feed cannot redirect users elsewhere
- `engageable` is never honored from the feed. Public coordinators have no account on this instance, so there is nobody to grant access to; only Freehold workspaces can be handed a file.

### Trying it before the endpoint exists

Point the variable at any static JSON matching the shape above:

```bash
FINDTCPROS_FEED_URL=http://localhost:4999/feed.json pnpm --filter @freehold/web dev
```
