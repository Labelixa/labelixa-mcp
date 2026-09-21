# Changelog

All notable changes to the `labelixa-mcp` npm package are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/).

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
