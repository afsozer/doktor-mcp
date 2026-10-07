# Doktor MCP

> **Beta**: See [package.json](package.json) and [CHANGELOG.md](CHANGELOG.md) for the current version.

**Project page:** [avfatihsozer.com/en/projects/doktor-mcp](https://avfatihsozer.com/en/projects/doktor-mcp) · Türkçe: [README.md](README.md)

`doktor-mcp` is a standalone TypeScript/Node.js MCP scaffold that produces **source-grounded legal
information packs** for physicians. It does not give categorical final legal opinions and does
not tell the physician what to do. It matches questions against official legislation text and
reasoned high court decision text; without issuing definitive rulings, it can offer
source-grounded conditional assessments (e.g. "the sources tend in this direction").

Adapter boundaries are prepared for:

- `legislation` (legislation)
- `yargitay`
- `danistay`
- `aym`

General internet articles, blogs, news, law firm promotional pages and forums are **not**
source inputs for this project.

## Source Engine Port

The source engine layer provides the hardening that live adapters need:

- Bedesten requests use a shared `HttpClient` and `RateLimiter` path with bounded retries,
  `Retry-After` handling, exponential backoff, jitter and request telemetry.
- Live source errors stay structured and JSON-only. Source diagnostics can carry retry count,
  backoff duration, status and content type without writing logs into the CLI JSON output.
- `src/sources/sourceRegistry.ts` exposes simplified source capability, rate limit and cache
  policy metadata for legislation and precedent sources.
- Bedesten/Court of Cassation adapters keep metadata-only decisions out of verified precedent
  output; official legislation returns a structured `unavailable` result when official search,
  document retrieval or article extraction cannot support a citation.

## Live Legislation Status

The live official legislation adapter is wired into optional MCP tool flows:

- adapter: `LiveOfficialLegislationAdapter`
- official source: Presidency of the Republic of Türkiye Legislation Information System (`mevzuat.gov.tr`)
- search capability: parser for the official `MevzuatDatatable` search request
- full-text capability: official `MevzuatMetin` document retrieval
- current extraction evidence: PDF text extraction and article parsing for mapped legislation

Health legislation is the first live mapping path. Patient rights and informed consent questions
use the official generated PDF path for the Regulation on Patient Rights `4847` (including mapped
articles `24` and `26`). Health law mappings also cover the Regulation on Medical Deontology, the
Law on the Practice of Medicine and Its Branches (Law No. 1219) and the Basic Law on Health
Services. KVKK article `6` can be used for personal health data and privacy questions as
supporting general legislation, after the health-specific sources.

When an official document does not arrive in an extractable format, or a mapped article cannot
be extracted, the live adapter returns structured `unavailable` output instead of producing a
provision.

Live source errors use this contract:

```json
{
  "status": "unavailable",
  "source": "mevzuat.gov.tr",
  "errorCode": "provision_not_found",
  "message": "Official text was retrieved but the mapped article could not be extracted.",
  "retryable": false,
  "recommendedNextStep": "Inspect the official text parser before using this provision in an answer."
}
```

## MVP Scope

The scaffold includes:

- MCP server registration and tool handler scaffolding
- type contracts for official legislation evidence, court decision evidence, classification,
  precedent status and the legal information pack
- mock legislation and high court adapters
- a live official legislation adapter for official source verification
- MCP `sourceMode` routing for live legislation
- health-first legislation mappings and source trace metadata
- health law pipeline components:
  - question classifier
  - legislation mapper
  - precedent filter
  - answer compiler
- a local JSON smoke command
- Vitest coverage for the initial source-safety rules

The precedent filter currently exposes these statuses:

- `precedent_usable`: full text, legal reasoning and factual relevance are present
- `limited_value`: full text is present but relevance is weak
- `procedural_only`: no reasoning on the merits; procedural text, mere affirmance or mere reversal
- `metadata_only`: citation metadata without full text
- `no_reasoning`: full text is present but there is no legal reasoning

Only `precedent_usable` records enter the verified precedent section of the compiled pack.

## Response Contract

Every tool response carries a `dataOrigin` field. This field states where the response came from:

| `dataOrigin` | Meaning |
|---|---|
| `"mock"` | The response contains fixture (fictional) data. It is **not** real legislation or a real decision. |
| `"live"` | The response came from live sources (mevzuat.gov.tr, Bedesten, Council of State). |
| `"snapshot"` | The response is a previously recorded snapshot of a live source. |
| `"computed"` | The response is purely a computation result (such as the classifier). It contains no source data. |
| `"client-provided"` | The response is based on input supplied by the client. |

When `dataOrigin: "mock"`, the response also carries a `mockDataWarning` field:

```json
{
  "dataOrigin": "mock",
  "mockDataWarning": "BU YANIT KURGU (FIXTURE) VERİSİDİR. Gerçek mevzuat veya mahkeme kararı DEĞİLDİR. Gerçek kaynaklar için sourceMode: 'live' kullanın."
}
```

This warning is added in a way that cannot be missed, so that mock data does not look like a
real legislation citation. No extra prefix is added to physician-facing text fields such as
`shortAnswer`; the top-level `dataOrigin` and `mockDataWarning` fields are sufficient.

The `prepare_doctor_legal_information_pack` response also carries a `packId` field.
This is a 6-digit hex identifier starting with the `"pack-"` prefix (e.g. `"pack-3f9a2c"`).
By passing the `packId` to the `drill_down_pack_item` tool you can expand on a specific
article or decision without rebuilding the pack. The `packId` is kept in server memory
for 30 minutes.

The structured pack is shaped around the requested physician-facing sections:

1. `shortAnswer`
2. `legalClassification`
   - `criminal`
   - `civilCompensation`
   - `disciplinaryAdministrative`
   - `patientRights`
   - `privacyKvkk`
   - `professionalEthics`
3. `relevantLegislation`
   - legislation name
   - article number
   - citation copied verbatim from the source provision
   - link to the facts
4. `verifiedHighCourtPrecedents`
   - court/chamber, date, docket (esas) and decision (karar) numbers
   - summary of facts, legal assessment, outcome
   - similarity/difference note
5. `missingInformation`
6. `lawyerReviewPoints`

Every legislation entry carries a source document id and a verbatim source citation. Every
verified precedent entry must pass the reasoned-precedent filter.

## Deliberately Out of Scope

The MVP does not include:

- a live Constitutional Court (AYM) high court client (the AYM decisions database is an HTML-only interface; there is no JSON API, so it is marked `synthetic_only`)
- categorical risk level scoring without source references or conditional language ("risk level high/low")
- urgent action instructions
- drafting petitions or defense submissions
- final legal conclusions
- categorical statements such as "there is liability" or "there is no liability"
- The tool may offer source-grounded conditional assessments (e.g. "the sources tend in this direction"), but never gives a categorical final ruling
- model-only legal propositions not verified against MCP source records

## New in v0.44.0

- **`assessmentTone`**: Optional parameter (`"strict"` | `"grounded-advisory"`, default: `"grounded-advisory"`). In `strict` mode only source lists are returned (no assessment). In `grounded-advisory` mode a `preliminaryAssessment` containing a source-grounded conditional assessment is added.
- **`preliminaryAssessment`**: Optional response field containing `summary` and `sentences[]`. Each sentence has `text`, `sourceRef` and `sourceLabel`. The sentences use the actual outcome/reasoning from precedents and verbatim excerpts from legislation, never boilerplate.
- **Legislation in-force metadata**: Provisions carry `inForce`, `lastAmendedDate` and `repealed` fields (it never assumes "in force" by default).
- **Decision deduplication**: Cross-source duplicates (e.g. the same decision coming from both the Court of Cassation and Bedesten) are deduplicated; the richest version is kept.
- **Full Turkish diacritics policy**: All physician-facing text uses correct Turkish characters (no ASCII substitution).
- See [CHANGELOG.md](./CHANGELOG.md) for the full version history and [COMPATIBILITY.md](./docs/COMPATIBILITY.md) for stability tiers.

Rate limiting is reserved for live clients: the intended behavior is practical public-source
traffic with adaptive backoff after a real block or source error, not aggressive throttling
without evidence of pressure.

## MCP Tools

- `classify_medical_legal_question`
- `search_health_legislation`
- `get_legislation_provisions`
- `search_health_precedents`
- `filter_reasoned_precedents`
- `prepare_doctor_legal_information_pack`
- `drill_down_pack_item`: Follow-up question. Expands on a specific article/decision via `packId` without rebuilding the pack. Example: `{ "packId": "pack-3f9a2c", "followUpQuestion": "madde 24 ne diyor?" }`
- `get_decision_full_text`: Retrieves the full text of a specific court decision. Example: `{ "documentId": "yargitay:99001", "sourceMode": "live" }`

### Response Contract Notes

Every tool response carries a `dataOrigin` field (`"mock"`, `"live"`, `"snapshot"`, `"computed"`, `"client-provided"`). In mock mode a `mockDataWarning` field is added.

Adding the `includeDiagnostics: true` parameter to a `prepare_doctor_legal_information_pack` call returns the full audit trail (selection diagnostics, source trace, etc.).

Legislation-facing MCP inputs accept an optional `sourceMode`:

```json
{
  "question": "kişisel sağlık verisi mahremiyet",
  "sourceMode": "live"
}
```

`sourceMode` defaults to `"live"` (since 0.59.0); fixture data must be requested explicitly with `"mock"`.
`search_health_legislation`, `get_legislation_provisions` and
`prepare_doctor_legal_information_pack` can use `"live"`. The live information pack keeps the
same MVP shape and adds `sourceUnavailable` only when the official legislation source cannot
return a verified provision.

Mock mode uses local fixture provisions. Live mode uses official legislation text from
`mevzuat.gov.tr`, plus the live Court of Cassation and Council of State precedent adapters. AYM
is mock-only and is disabled in live mode rather than being used as a fallback.

## Health Legislation Priority

The live mapping layer sorts physician questions into health law topic clusters:

- informed consent / consent
- medical intervention
- patient rights
- patient privacy
- personal health data
- records, files and discharge summary (epicrisis)
- emergency intervention
- referral and consultation
- the physician's duty of care
- professional ethics

Each mapping carries the target legislation, target article numbers, search terms, a selection
rationale and a health law priority. When several mappings fit, the pack orders primary health
legislation before supporting general legislation. For example, a personal health data privacy
question may return the Regulation on Patient Rights before KVKK; KVKK is not used as a broad
fallback for unrelated physician questions.

## Source Trace

`sourceTrace` audits live legislation output rather than providing legal reasoning. Each trace
shows how a provision passed from the health law mapping to the official document and the
article extraction step:

- the original `query`
- `matchedHealthMapping` and, when there is no match, the mapping candidates tried
- `officialSearchRequest`, the official search result count and compact official results
- `selectedSearchResult` and `selectedResultReason`
- landing/detail URL and the direct or generated PDF URL
- `contentType`, extraction method, extracted article numbers and retrieval duration

Live `search_health_legislation` includes the trace alongside the selected provisions. Live
`get_legislation_provisions` carries a trace on every returned provision. Live
`prepare_doctor_legal_information_pack` keeps the trace both in the relevant legislation entries
and in the pack-level `sourceTrace` array, so the compiled citation can be checked against the
same extracted provision.

An `unavailable` live pack also preserves the audit context:

```json
{
  "sourceUnavailable": [
    {
      "status": "unavailable",
      "source": "mevzuat.gov.tr",
      "errorCode": "document_not_found",
      "sourceTrace": [
        {
          "query": "bilinmeyen konu",
          "matchedHealthMapping": null,
          "attemptedHealthMappings": ["mevzuat:7.5.4847", "mevzuat:1.5.6698"]
        }
      ]
    }
  ]
}
```

`matchedHealthMapping` and `selectedResultReason` show the topic cluster, the health law
priority and whether the selected mapping is primary health legislation or supporting general
legislation. Trace fields only explain source selection and extraction. They do not produce
legal propositions and never replace the verbatim official provision text.

## Provision Ranking

Live provision ranking runs deterministic scoring after official article extraction. It selects
a compact set of source articles for the pack; it does not produce article text, legal advice or
categorical legal conclusions.

Ranking signals:

- physician query terms
- the mapped health law topic cluster
- mapping search terms
- article heading text, when the extracted article starts with a usable heading
- keyword matches inside the extracted article text
- mapped article list bonus
- health law priority and primary/supporting role ordering

The live trace shows `candidateArticleNumbers`, `rankedArticleNumbers`, `rejectedArticleNumbers`
and `rankingMethod`. Every returned live provision also carries its own deterministic score,
matched terms, ranking reasons and whether it came from the manually mapped article list. The
live adapter limits a single legislation document to a small ranked set of articles (currently
at most three provisions). Extracted mapped articles come first; high-signal ranked fallback
articles are considered only when the mapped articles are missing from the extraction. The trace
preserves both the selected and the rejected candidate trail.

KVKK stays `supporting_general` for personal health data and privacy questions. It does not
replace primary health legislation in ranking or in pack ordering. The Court of Cassation,
Council of State and AYM adapters remain mock adapters.

## Selection Diagnostics

Selection diagnostics provide a short audit view of source selection: while `sourceTrace` still
contains the official request, document, extraction, candidate, ranking and `unavailable` detail,
the diagnostics summarize what was selected without requiring a full trace read.

Compact diagnostics include:

- query and `sourceMode`
- selected legislation and provision counts
- for each selected legislation: its role, topic cluster, priority, article numbers, a summary of
  rejected article numbers and the selection rationale
- for each selected provision: its score, matched terms, top ranking reasons and mapped-article flag
- `unavailable` and warning counts

Example live summary:

```json
{
  "selectionDiagnostics": {
    "query": "kisisel saglik verisi mahremiyet",
    "sourceMode": "live",
    "selectedLegislationCount": 2,
    "selectedProvisionCount": 2,
    "selectedLegislations": [
      {
        "legislationName": "Hasta Haklari Yonetmeligi",
        "legislationRole": "health_primary",
        "topicCluster": "patient_privacy",
        "selectedArticleNumbers": ["21"]
      },
      {
        "legislationName": "Kisisel Verilerin Korunmasi Kanunu",
        "legislationRole": "supporting_general",
        "topicCluster": "personal_health_data",
        "selectedArticleNumbers": ["6"]
      }
    ],
    "unavailableCount": 0
  }
}
```

Diagnostics are audit metadata only. They do not replace official provision citations, do not
produce legal propositions and keep KVKK in its supporting-general role. The Court of Cassation,
Council of State and AYM adapters remain mock adapters.

## Decision Source Trace

`DecisionSourceTrace` audits the decision pipeline for every court decision candidate.
It is the precedent-side counterpart of `LegislationSourceTrace`. Each trace carries:

- the original `query`
- `source` and `court` (yargitay / danistay / aym)
- `searchRequest` (null for mock adapters)
- `searchResultsCount` and `selectedResult`
- `documentId` / `sourceId`
- `fullTextAvailable` and `fullTextRetrievalMethod`
- `retrievedAt`
- `eligibilityStatus`: the precedent filter result
- `eligibilityReasons`: the positive criteria the decision meets
- `exclusionReasons`: the specific reason(s) for exclusion, if any
- `error`, if retrieval failed

Decision source traces are audit metadata only. They do not produce legal reasoning and never
add a court decision to the pack unless the decision passes all eligibility criteria.

## Reasoned-Decision Eligibility

`assessDecisionEligibility` (in `src/health/decisionEligibility.ts`) applies the precedent filter
rules and returns a structured `EligibilityResult` with a status, positive eligibility reasons and
exclusion reasons.

A decision is **excluded** from the verified precedents section if any of the following applies:

- `fullTextAvailable: false`: the full decision text is not available (→ `metadata_only`)
- `legalReasoning` is empty or missing (→ `no_reasoning`)
- The decision text contains a purely procedural marker: `salt onama`, `salt bozma`, `usul karar`
  (mere affirmance, mere reversal, procedural decision) (→ `procedural_only`)
- The legal reasoning is only `onama` (affirmance) or `bozma` (reversal) without content on the
  merits (→ `procedural_only`)
- There is no `relevanceNote` linking the decision to the health law facts (→ `limited_value`)

Only `precedent_usable` decisions enter the pack's `verifiedHighCourtPrecedents` section.
`limited_value`, `procedural_only`, `no_reasoning` and `metadata_only` decisions are excluded.

## Precedent Diagnostics

`PrecedentSelectionDiagnostics` is the compact audit view for decision selection; it is the
counterpart of `LegislationSelectionDiagnostics` on the legislation side. It appears as
`precedentDiagnostics` in every `prepare_doctor_legal_information_pack` response and in the
`filter_reasoned_precedents` tool response.

The diagnostics include:

- `query`: the original question
- `selectedPrecedentCount` / `excludedDecisionCount`
- `selectedPrecedents[]`: court, chamber, date, docket/decision numbers, status, matched health
  topics and eligibility reasons
- `excludedDecisions[]`: court, date, status and exclusion reasons

The diagnostics only summarize selection and exclusion. They provide no legal interpretation and
add no decision to the pack.

## Live Court of Cassation Adapter

The first live court decision adapter: `LiveYargitayAdapter`
(`src/sources/yargitay/liveYargitayAdapter.ts`). The Council of State and AYM remain mock adapters.

**Source and endpoint:** Targets `https://bedesten.adalet.gov.tr/emsal-karar/searchDocuments`
with the `YARGITAYKARARI` filter. JSON POST body containing the health law search term.
Retries three times with adaptive backoff for 429 and 5xx errors.

**`sourceMode: "live"` precedent behavior:**

- `search_health_precedents` uses the live Court of Cassation adapter; the Council of State and AYM stay mock.
- With `sourceMode: "live"`, `prepare_doctor_legal_information_pack` searches live Court of
  Cassation decisions in addition to live legislation.
- Health law search terms are mapped from the classified question: `riza/rıza/onam` →
  `"aydınlatılmış rıza"`, `tibbi/müdahale` → `"tıbbi müdahale"`, etc.
- Only `precedent_usable` decisions enter `verifiedHighCourtPrecedents`. All others are
  recorded in `precedentDiagnostics.excludedDecisions` with exclusion reasons.

**`DecisionSourceTrace` live example:**

```json
{
  "query": "aydınlatılmış rıza",
  "source": "yargitay",
  "court": "yargitay",
  "searchRequest": {
    "url": "https://bedesten.adalet.gov.tr/emsal-karar/searchDocuments",
    "phrase": "aydınlatılmış rıza",
    "pageSize": 5
  },
  "searchResultsCount": 12,
  "selectedResult": { "documentId": "yargitay:99001" },
  "selectedResultReason": "Health law term 'aydınlatılmış rıza' matched Yargıtay emsal search.",
  "fullTextAvailable": true,
  "fullTextRetrievalMethod": "html-text",
  "retrievedAt": "2026-05-22T10:00:00.000Z",
  "eligibilityStatus": "precedent_usable",
  "eligibilityReasons": [
    "Tam karar metni mevcut.",
    "Hukuki gerekçe alanı dolu.",
    "Sağlık hukuku olayıyla bağlantı kurulmuş.",
    "Emsal olarak kullanılabilir."
  ],
  "exclusionReasons": []
}
```

**Live source error behavior:** If `bedesten.adalet.gov.tr` is unreachable or returns a response
that cannot be parsed, the adapter returns a structured `unavailable` result:

```json
{
  "status": "unavailable",
  "source": "yargitay.gov.tr",
  "errorCode": "source_error",
  "message": "Yargıtay request failed: fetch failed",
  "retryable": true,
  "recommendedNextStep": "Retry after checking network access to bedesten.adalet.gov.tr.",
  "sourceTrace": [{ "query": "aydınlatılmış rıza", "searchRequest": { ... } }]
}
```

No decision is ever fabricated. The pack keeps working with mock Council of State and AYM results
and shows 0 selected precedents in `precedentDiagnostics` for the Court of Cassation source.

The Council of State and AYM adapters remain mock adapters.

## Multi-Source Live Precedent Pipeline

The live Council of State adapter, the central health law query expansion module, per-source
diagnostics (`sourceSummaries`) and a file-based result cache.

### Live Council of State Adapter

`LiveDanistayAdapter` (`src/sources/danistay/liveDanistayAdapter.ts`)
targets `https://karararama.danistay.gov.tr/aramalist`. It follows the same retry, HTML full-text
extraction and eligibility assessment pattern as the Court of Cassation adapter. `court` is set
to `"danistay"` and document ids start with the `danistay:` prefix.

Instead of keeping its own term map, the adapter uses `pickHealthLawQuery` from the central
query expansion module.

### `precedentSources` Parameter

`prepare_doctor_legal_information_pack` and `search_health_precedents` now accept an optional
`precedentSources` array to choose which courts are queried in live mode:

```json
{
  "question": "aydınlatılmış rıza",
  "sourceMode": "live",
  "precedentSources": ["yargitay", "danistay"]
}
```

Valid values: `"yargitay"`, `"danistay"`, `"aym"`. If omitted, the default is all three.
AYM remains a mock adapter.

When one source is unreachable, the others continue. The pack is never blocked by a single
adapter failure.

### `assessmentTone` Parameter (v0.44.0)

`prepare_doctor_legal_information_pack` also accepts an optional `assessmentTone` parameter:

```json
{
  "question": "hasta hakları nelerdir",
  "sourceMode": "mock",
  "assessmentTone": "grounded-advisory"
}
```

| Value | Behavior |
|-------|----------|
| `"grounded-advisory"` (default) | The pack includes `preliminaryAssessment` with source-grounded conditional sentences. Each sentence carries a `sourceRef`. |
| `"strict"` | Previous behavior: only source lists are returned. No assessment text is produced. |

The `preliminaryAssessment` field contains `summary` (overview) and `sentences[]` (individual
assessment points). Each sentence has `text`, `sourceRef` and `sourceLabel`. The sentences use
the actual outcome/reasoning from precedents and verbatim excerpts from legislation, never
boilerplate. See [COMPATIBILITY.md](./docs/COMPATIBILITY.md) for stability guarantees.

### Health Law Query Expansion

`src/health/healthLawQueryExpansion.ts` provides deterministic term mapping shared by both the
Court of Cassation and Council of State adapters:

- `riza` / `onam` / `aydinlat` → `"aydınlatılmış rıza"`
- `komplikasyon` → `"komplikasyon tıbbi müdahale"`
- `malpraktis` → `"malpraktis hekim kusur"`
- `hekim` → `"hekimin özen yükümlülüğü"`
- `hasta` → `"hasta hakları"`
- `veri` / `mahrem` → `"sağlık verisi mahremiyet"`
- `kusur` → `"hizmet kusuru tıbbi müdahale"`
- `acil` → `"acil müdahale hekim yükümlülüğü"`

`pickHealthLawQuery` returns the highest-priority mapped term for a classified question.
`pickHealthLawQueries` returns up to N distinct terms for multi-term searches.

### `sourceSummaries` in `precedentDiagnostics`

`PrecedentSelectionDiagnostics` now includes `sourceSummaries[]` with a per-source breakdown:

```json
{
  "precedentDiagnostics": {
    "query": "aydınlatılmış rıza",
    "selectedPrecedentCount": 1,
    "excludedDecisionCount": 2,
    "sourceSummaries": [
      {
        "source": "yargitay",
        "mode": "live",
        "searched": true,
        "searchResultsCount": 5,
        "candidateCount": 2,
        "selectedCount": 1,
        "excludedCount": 1,
        "unavailableCount": 0,
        "errorCodes": []
      },
      {
        "source": "danistay",
        "mode": "live",
        "searched": false,
        "searchResultsCount": null,
        "candidateCount": 0,
        "selectedCount": 0,
        "excludedCount": 0,
        "unavailableCount": 1,
        "errorCodes": ["source_error"]
      }
    ]
  }
}
```

`selectedPrecedents[]` and `excludedDecisions[]` entries now also include a `source` field (the
same value as `court`) to state which adapter produced each decision.

### File-Based Cache

`PrecedentCache` (`src/sources/precedentCache.ts`) caches live adapter results under
`precedents/` in the cache directory (by default `~/.cache/doktor-mcp/precedents/`) with a one-hour TTL. Cache files are keyed by source, query and page size.
Cache write errors are non-fatal.

`smoke:precedents` supports three cache flags:

```powershell
# Use the cache (default)
npm run smoke:precedents -- "aydınlatılmış rıza"

# Skip cache reads and writes
npm run smoke:precedents -- "aydınlatılmış rıza" --no-cache

# Force a fresh fetch and overwrite the cache entry
npm run smoke:precedents -- "aydınlatılmış rıza" --refresh
```

The cache lives outside the repository; `.cache/`, used by older versions, stays in `.gitignore`.

## Precedent Source Calibration

Deep probe analysis and normalizer hardening. See `docs/LIVE_SOURCE_CALIBRATION.md` for the full
calibration workflow.

### Verified endpoint behavior (2026-05-22)

| Source | Status | Endpoint |
|--------|-------|----------|
| **Yargitay** | `reachable_json` | `bedesten.adalet.gov.tr/emsal-karar/searchDocuments` - active integration via the Bedesten proxy. |
| **Danistay** | `reachable_json` | `karararama.danistay.gov.tr/aramalist` - active integration. |
| **Bedesten** | `reachable_json` | `bedesten.adalet.gov.tr/emsal-karar/searchDocuments` - active unified integration. |
| **AYM** | `synthetic_only` | No live endpoint. Mock adapter only. |

### Probe CLI

```powershell
# Deep probe with HTML/SOAP analysis and fixture saving
npm run probe:precedents -- "aydınlatılmış rıza" -- --source yargitay --save-fixture
npm run probe:precedents -- "hizmet kusuru tıbbi müdahale" -- --source danistay --save-fixture
```

Probe output includes: HTTP status, content-type, HTML/SOAP analysis (title, form actions,
endpoint hints, body length, captcha/login detection), `calibrationStatus` and
`recommendedNextStep`.

### Non-JSON response classification

When a live adapter receives a non-JSON response, `DecisionSourceTrace.error` contains:

| Code | Meaning |
|------|--------|
| `non_json_response:html_shell_response` | HTTP 200 + small HTML SPA shell |
| `non_json_response:unexpected_html_response` | Login/large HTML |
| `non_json_response:xml_soap_response` | SOAP/XML service response |
| `non_json_response:captcha_or_block` | CAPTCHA detected |
| `non_json_response:empty_response` | Empty body |

### Raw fixture policy

- `fixtures/raw/` is gitignored: never commit raw response bodies.
- `fixtures/live-samples/` holds sanitized/synthetic fixtures: safe to commit.
- See `fixtures/live-samples/README.md` for the sanitized fixture format.

### Pack audit extended checks

`audit:pack` now also checks:

- Unreachable sources in `sourceSummaries` → warning with error codes
- `decisionSourceTrace.fullTextAvailable === false` on a verified precedent → error
- `decisionSourceTrace.eligibilityStatus !== "precedent_usable"` on a verified precedent → error

See `docs/PACK_AUDIT.md` for the full check reference.

## Production Setup

### Installing from npm

Node.js 20 or later is required. You can run the package with `npx` without installing it.
To add it to Claude Code:

```bash
claude mcp add doktor -- npx -y doktor-mcp
```

Cache files are written to the user's cache directory: `DOKTOR_MCP_CACHE_DIR` if set,
otherwise `$XDG_CACHE_HOME/doktor-mcp` or `~/.cache/doktor-mcp`.

### Source mode

`sourceMode` defaults to `"live"` (since 0.59.0): if `sourceMode` is not specified in the tool
call, queries go to the live official sources. To try fixture (fictional) data, pass
`sourceMode: "mock"` in the call or set `DOKTOR_MCP_DEFAULT_SOURCE_MODE=mock`; the response then
includes the `mockDataWarning` field.

### Example: Claude Desktop Configuration

```json
{
  "mcpServers": {
    "doktor-mcp": {
      "command": "npx",
      "args": ["-y", "doktor-mcp"]
    }
  }
}
```

### Valid Values

| Value | Meaning |
|-------|--------|
| `"mock"` | Returns fixture (fictional) data. It is **not** real legislation or a real decision. |
| `"live"` | Default. Queries live official sources (mevzuat.gov.tr, Court of Cassation, Council of State). |
| `"snapshot"` | Uses a previously recorded snapshot of a live source. |

If an invalid value is set (such as `DOKTOR_MCP_DEFAULT_SOURCE_MODE=production`),
a warning is written to stderr and the default `"live"` is used.

> **Note:** `DOKTOR_MCP_DEFAULT_SOURCE_MODE` is a more discoverable equivalent of
> `DOKTOR_MCP_SOURCE_MODE`. Both set `sourceMode`; when both are set,
> `DOKTOR_MCP_DEFAULT_SOURCE_MODE` is processed last.

## Development

```powershell
npm install
npm test
npm run build
npm run smoke -- "Aydinlatilmis riza kaydi eksikse hangi resmi kaynaklar eslesir?"
npm run smoke:legislation -- "kisisel saglik verisi mahremiyet"
npm run smoke:legislation -- "aydınlatılmış rıza"

# Both Court of Cassation and Council of State smoke (default)
npm run smoke:precedents -- "aydınlatılmış rıza"

# Specific sources
npm run smoke:precedents -- "hizmet kusuru" --precedentSources yargitay,danistay

# Cache control
npm run smoke:precedents -- "aydınlatılmış rıza" --no-cache
npm run smoke:precedents -- "aydınlatılmış rıza" --refresh

npm run smoke:mcp -- "kişisel sağlık verisi mahremiyet" -- --sourceMode live
npm run smoke:mcp -- "hasta haklari tibbi mudahale" -- --sourceMode live
npm run smoke:mcp -- "riza belgesi" -- --sourceMode mock
npm run dev:mcp
```

`smoke:precedents` queries the live Court of Cassation and Council of State adapters in parallel,
caches the results and prints JSON with per-source `results` containing `sourceTraces` and
`eligibilityStatus` for each candidate decision. If a source is unreachable, its structured
`unavailable` result is printed alongside the other source's output. JSON parseability is always
preserved.

`smoke:mcp` calls the full `prepare_doctor_legal_information_pack` handler.
With `sourceMode: "live"` it uses both live legislation and the live Court of Cassation + Council
of State adapters. The optional `precedentSources` parameter chooses which adapters are used.
AYM is mock-only and disabled in live mode.

After `npm run build`, run the compiled stdio MCP server with:

```powershell
npm run mcp
```

## Physician Question Benchmark Suite

A comprehensive quality evaluation and regression-test benchmark suite with live-source evaluation
metrics, focused on typical physician-centered legal questions.

### Purpose
- **Quality Measurement**: Systematically evaluates performance, legislation mapping, precedent count and schema compliance for 15-20 target questions across 15 distinct medico-legal categories.
- **Regression Prevention**: Enforces strict safety constraints such as: `Kisisel Verilerin Korunmasi Kanunu (KVKK)` not appearing in non-privacy packs, physician-centered deontology rules taking priority over general patient rights in refusal cases, and no mock-precedent fallback in live mode.

### How to Run

Use the benchmark runner script to run the tests and see the report outputs:

```powershell
# Run the full benchmark in mock mode (default)
npm run benchmark:doctor-questions

# Run in live mode (queries live legislation and precedents, reports live-source metrics)
npm run benchmark:doctor-questions -- --sourceMode live

# Equivalent live shortcut
npm run benchmark:doctor-questions:live

# Limit the run to the first N questions
npm run benchmark:doctor-questions -- --limit 5

# Specify a custom report directory (default exports/doctor-benchmark)
npm run benchmark:doctor-questions -- --out exports/my-custom-report
```

> [!WARNING]
> Running the benchmark with `--sourceMode live` makes real HTTP requests to the Presidency's legislation service (`mevzuat.gov.tr`) and to high court services (`bedesten.adalet.gov.tr` and `karararama.danistay.gov.tr`). To avoid rate limiting (HTTP 429) or IP restrictions from these servers, make sure you have a stable internet connection and keep the request volume reasonable.

### Mock vs Live Benchmark

Mock mode is a deterministic regression guard. It can fail the command when expected legislation,
priority, audit or safety invariants regress.

Live mode is an evaluation run. It keeps the same safety invariants, but source outages, empty
results, rate limits and `sourceUnavailable` entries are reported as metrics and warnings instead
of automatic failures. Unsafe precedent use, forbidden MVP fields, mock fallback in live mode or
audit errors remain hard regression failures.

### Benchmark Reports and Exports
Runs produce parseable JSON and Markdown reports in `exports/doctor-benchmark/` (gitignored):

- Mock mode:
  - `doctor-benchmark-report.json`
  - `doctor-benchmark-report.md`
- Live mode:
  - `live-benchmark-report.json`
  - `live-benchmark-report.md`

Reports include: `startedAt`, `completedAt`, `durationMs`, `passedRegressionCount`,
`failedRegressionCount`, `liveSourceUnavailableCount`, audit counts, legislation/precedent
coverage counts and per-question scoring.

Reports include live benchmark quality audit fields for every selected verified precedent:
court, chamber, decision date, docket/decision numbers, retrieval source, document id/source id,
source URL if any, full-text availability, reasoning detection, eligibility status/reasons, health
law relevance score, matched terms and presence of a decision source trace. The report does not
print the full decision text.

Mock fallback in live mode is a hard regression. AYM stays disabled/mock-only and cannot silently
provide live verified precedents. `sourceUnavailable`, empty live search results and transient
upstream source errors remain quality metrics and warnings unless they lead to an unsafe precedent
or a schema/audit violation.

### Scoring

Each question receives:

- `legislationMatchScore` between 0 and 2
- `priorityScore` between 0 and 2
- `precedentSafetyScore` between 0 and 2
- `sourceAvailabilityScore` between 0 and 2
- `auditScore` between 0 and 2
- `forbiddenFieldsScore` 0 or 2
- `totalScore`, `maxScore`, `scorePercent` and `qualityBand`

`qualityBand`: `good`, `acceptable`, `needs_tuning` or `unsafe`. Live source unavailability can
lower quality, but only safety violations or audit errors make an item `unsafe`.

Verified precedent scoring is deliberately strict. A selected verified precedent must be
`precedent_usable`, have verified full text and detected legal reasoning, and preserve a decision
source trace. Metadata-only, procedural-only, unreasoned, no-full-text or mock-retrieval records
cannot earn verified precedent credit in live mode. Weak health law relevance caps precedent
safety credit and is reported as a tuning warning rather than being hidden behind a high total
score.

On top of this audit layer the benchmark includes precedent relevance tuning. Per question and
source it reports weak relevance, sample decision ids, matched topic terms, missing expected topic
terms, a `whyWeak` explanation and suggested follow-up query terms. It also separates
`goodCleanCount` from `goodWithWarningsCount` and reports mean/median health law relevance scores.

Weak relevance means the decision passed the hard precedent safety gates, but the decision text
only matched broad health words or did not overlap strongly with the question's topic profile.
Topic profiles include: informed consent, malpractice/complication, emergency care, treatment
refusal, privacy/records, psychiatric privacy, violence/threats, referral, private hospital fee
disputes, public discipline, intensive care and pregnancy emergencies. Live source unavailability
remains a metric/warning; `unsafe` is reserved for safety violations such as mock fallback,
missing full text/reasoning/trace, or unusable precedent statuses leaking into verified output.

### Performance Benchmark Command

```sh
npm run benchmark:doctor-questions:performance
# or with a limit:
npm run benchmark:doctor-questions:performance -- --limit 5
```

The benchmark runs all 15 physician questions twice. The cold run goes to the live network and
fills the local file cache (`.cache/precedents-perf/`). The warm run immediately replays the same
queries from the cache. The report shows:

- Cold vs warm total duration and improvement %
- Per-source cold/warm mean ms, p95, cache hits, network requests
- Cache effectiveness: hit rate %, count served from cache, mean cache age
- Retry/backoff summary: total retries, backoff duration, rate-limit events, timeout count
- The 10 slowest query attempts (cold + warm combined)
- Performance warnings (non-blocking; hard failures remain test/build/audit)

### Interpreting p50/p95/p99

| Value | Meaning |
|---|---|
| p50 | Median query duration: half of the queries complete in this time or less |
| p95 | 95th percentile: tail latency; most queries are faster than this |
| p99 | 99th percentile: outlier latency; occasional slow queries |

Cold p95 > 60s points to a slow source (usually Court of Cassation/Bedesten PDF retrieval).
Warm p95 > 10s indicates the cache is not effective for the slowest queries (possible TTL
expiry, or cache misses for full-text retrievals inside the adapter).

### Cache Integration

The cache is disabled by default in normal live benchmark and smoke CLI runs. For the performance
benchmark a shared `PrecedentCache` (TTL 2s, directory `.cache/precedents-perf/`) is injected. The
cache stores the whole `searchAndNormalize` result per (source, query, pageSize) key. The warm run
replay is complete: no network calls are made for cached queries.

`.cache/` is gitignored. Cache entries are not committed.

---

See [CHANGELOG.md](./CHANGELOG.md) for the version history.

## License

Licensed under the GNU Affero General Public License, version 3 only
(`AGPL-3.0-only`); the full text is in [LICENSE](LICENSE). If you modify the
software and offer it to others over a network, you must make your modified
source code available to those users under the same licence. See
[SECURITY.md](SECURITY.md) for how to report a vulnerability.

Copyright © 2026 Alpaslan Fatih Sözer
