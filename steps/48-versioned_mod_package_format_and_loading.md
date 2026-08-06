# Milestone 48: Versioned Mod Package Format And Loading

## Status

Planned

## Objective

Define a safe, versioned package boundary for SDK-authored content without
allowing arbitrary code execution.

## Scope

Specify package metadata, maps, items, modes, UI metadata, audio declarations,
animation declarations, dependency/version rules, validation, loading, and
rejection behavior.

## Required Deliverables

- Versioned JSON package schema and canonical hashing rules.
- Safe loader boundary for all supported content categories.
- Duplicate, dependency, unknown-version, malformed-data, and executable-field rejection.
- Migration/version policy and package authoring documentation.

## Acceptance Criteria

- Valid packages load into detached public SDK documents only.
- Package hashes and load results are deterministic across repeated loads.
- Arbitrary code, module paths, device APIs, and unsupported internal imports are rejected.
- Dependencies are explicit, bounded, and validated before content is admitted.
- Loaded content remains compatible with map, item, mode, replay, and repository validators.

## Required Verification

- Schema, security, hash, loader, malformed-input, and version-migration tests.
- Cross-system fixtures for packages containing maps, items, modes, and presentation data.
- TypeScript, fast suite, and SDK-only import/dependency gate.

## Dependencies

Depends on applicable content milestones 41 through 47, especially 41, 45, and 47.

## Explicit Non-Goals

- No JavaScript plugin execution or arbitrary mod code.
- No direct exposure of `ItemLoader` or internal runtime constructors as authoring APIs.
- No package registry, marketplace, or network distribution product.
