# Changelog

All notable changes to the `labelixa-mcp` npm package are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/).

## [0.5.2] - 2026-10-31

### Changed
- `zpl_command_help`: commands that are valid with either prefix
  (`^CC`/`~CC`, `^CT`/`~CT`) now carry a `prefixes` list (`["^", "~"]`);
  the `syntax` string keeps the primary spelling.

### Security
- Upgrade `zod` from 3.25.76 to 4.6.7 (GHSA-mrhx-c7xc-m3w5: memory
  exhaustion while validating oversized constrained collections) and
  refresh the lockfile (`body-parser`, `fast-uri`, `ip-address`). Tool
  names, inputs and outputs are unchanged.

## [0.5.1] - 2026-10-23

### Changed
- README: the list of remote-only tools now names
  `printer_language_to_zpl` (SATO SBPL, Datamax DPL and Intermec IPL to
  ZPL) on the hosted server https://api.labelixa.com/mcp. This package's
  own tools and code are unchanged.

## [0.5.0] - 2026-10-20

### Changed
- JSON tool results use English field names and English code values.
  The Labelixa API names some fields in Turkish (`ozet`, `mesaj`,
  `risk.seviye`, a report section's `durum`) and sends some code words
  in Turkish (`dusuk`, `degerlendirilmedi`); they are now renamed before
  the result reaches the assistant: `summary`, `message`, `risk.level`,
  `status`, `low`, `not_evaluated`, and so on. Affects `zpl_validate`,
  `epl_validate`, `tspl_validate`, `cpcl_validate`, `language_detect`,
  `zpl_compatibility` and `explain_zpl`. The words are the same ones the
  hosted server (https://api.labelixa.com/mcp) uses. Free text, rule
  codes and unknown fields pass through unchanged. If you parse these
  results yourself, update the field names.
- `zpl_command_help` returns the same field names as the hosted server:
  `command`, `name`, `syntax`, `example_fragment`, `rendered_by_preview`,
  `parameters` (plus `category` and `description`).
- Error results carry the server's sentence only instead of the raw JSON
  error body. Extra fields of an error (for example the list of valid
  models) follow the sentence with English names.

## [0.4.2] - 2026-10-15

### Changed
- `zpl_validate` and `explain_zpl` descriptions now state what each one is
  for: `zpl_validate` is the fast pass/fail lint with machine-readable
  diagnostics to run while generating or editing ZPL; `explain_zpl` is the
  human-readable, scored report for reviewing a finished label. The two
  descriptions used to overlap enough that assistants picked the wrong
  tool (seen in a public tool-directory review). Inputs and outputs are
  unchanged.

### Fixed
- Trailing slashes are stripped from the configured base URL with a loop
  instead of the `/\/+$/` regular expression, which had polynomial
  backtracking on adversarial input (CodeQL `js/polynomial-redos`).

## [0.4.1] - 2026-09-28

### Security
- Numeric tool inputs are checked before any request: `dpmm` must be 6, 8,
  12 or 24; `width_in` and `height_in` finite, above 0 and at most 15;
  `index` an integer from 0 to 10000; `source` and `target` 152, 203, 300
  or 600. `1e999` in JSON parses to Infinity, and such values used to
  reach the request path and query string.
- Requests no longer follow redirects. fetch removes only `Authorization`
  when a redirect changes host; the `X-API-Key` header would have been
  carried along. A redirect is reported as an error with its status.

## [0.4.0] - 2026-09-16

### Added
- `zpl_command_help` accepts an optional `locale` (`en` default, `tr`,
  `de`), forwarded to the REST catalog as the documented `?lang=` query
  parameter. Only the command name and the descriptions change; the
  command code, syntax string, example and parameter names are protocol
  and are identical in every language — translating them would produce
  ZPL that does not run. An unsupported value is rejected by the server
  with 400 instead of falling back silently, so a caller that asks for a
  language it cannot get hears about it.

### Changed
- `zpl_command_help` now answers in English by default. It previously
  returned the catalog's Turkish source text (`^XZ` came back as
  "Format Sonu") while the tool description, field names and error
  messages were already English.

## [0.3.5] - 2026-09-16

### Changed
- Package description and keywords describe the product by capability
  (render, validate, debug, convert) and name all four label languages
  (ZPL, EPL, TSPL, CPCL); the hosted endpoint `https://api.labelixa.com/mcp`
  is stated explicitly.
- README leads with the remote server (no install), then this package;
  Claude Code and generic `url` client configuration added.
- Registry manifest (`server.json`): capability-based description,
  `repository` set to the public source mirror
  (`github.com/Labelixa/labelixa-mcp`), publisher-provided metadata block
  with the canonical identity (endpoint, website, languages, positioning).
- No tool or behaviour change.

## [0.3.4] - 2026-09-13

### Changed
- Internal identifiers, file names and comments translated to English;
  no API change. The tool module is now `tools.mjs`.
- Error texts returned to the assistant are in English.

### Added
- Publish guard (`scripts/check-publish.mjs`, run by `prepublishOnly`):
  publishing fails when a shipped file contains internal ticket ids,
  non-English text or unreleased markers.

## [0.3.3] - 2026-09-10

### Fixed
- The MIT license text is now included in the package (`LICENSE` added
  to `files`).
- `repository` and `bugs` point to the package's public repository
  (`github.com/Labelixa/labelixa-mcp`).

## [0.3.2] - 2026-09-09

### Fixed
- The version is read from `package.json` by both `server.mjs` and the
  tool module, so the User-Agent, the MCP server info and the npm
  metadata always agree.
- Tool descriptions for `zpl_compatibility` and `explain_zpl` show the
  valid model format (`zebra/zd421`, i.e. `manufacturer/model`).
- Package metadata: `bugs.url` points to a live page and a support
  e-mail was added.

### Changed
- Registry manifest (`server.json`): `websiteUrl` added and the version
  aligned with `package.json`.
- Package description clarified.

## [0.3.1] - 2026-08-27

### Changed
- Package metadata only: `repository.url` updated. Tools, contracts and
  remote behaviour unchanged.

## [0.3.0] - 2026-08-26

### Added
- `zpl_command_help`: the catalog entry of a single ZPL command — name,
  syntax, parameters and whether the preview engine actually renders it;
  printer-side commands are marked honestly.
- `convert_zpl_dpi`: rescales ZPL coordinates between resolutions;
  `^GF`/`~DG` bitmap data is not rescaled and a warning block precedes
  the output.
- `explain_zpl`: sectioned health report with an honest score — sections
  that cannot be assessed say so instead of counting; optional `model`.

## [0.2.0] - 2026-08-25

### Added
- `language_detect` (ZPL/EPL/TSPL/CPCL detection; returns a confidence
  tier, not a percentage), `epl_validate`, `tspl_validate`,
  `cpcl_validate` (positioned diagnostics) and `zpl_compatibility` (risk
  analysis against a printer model; not an emulator).
- All tools are thin 1:1 wrappers over documented REST endpoints; errors
  carry the server text and an unknown model is reported as the server's
  404.

## [0.1.1] - 2026-08-25

### Added
- `mcpName: "com.labelixa/zpl"` in `package.json`, required by the MCP
  Registry when it validates the npm package.
- `server.json` registry manifest (remote endpoint + npm package).

## [0.1.0] - 2026-08-25

### Added
- First release: `zpl_preview`, `zpl_validate`, `barcode_generate`.
