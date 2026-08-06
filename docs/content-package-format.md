# KORE Content Package Format

Milestone 48 packages are versioned JSON only. A package has `schemaVersion: 1`
and a manifest (`id`, display `name`, semver `version`, and optional bounded
`dependencies`). It may contain canonical SDK documents in `maps`, `items`, and
`modes`, plus declarative `ui`, `audio`, and `presentation` metadata.

Use `kore.contentPackage.load(value)` at the content boundary. It validates the
package, existing map/item/mode contracts, dependency and cross-document
references, and returns a structured-cloned package with its canonical hash.
`kore.contentPackage.canonicalize` sorts object keys and package collections;
the hash is computed from that canonical JSON and is independent of property or
document declaration order.

Package declarations cannot contain functions, executable fields, module paths,
device APIs, arbitrary imports, URLs for assets, or unknown schema fields.
There is no plugin execution hook. New package schema versions require an
explicit migration in the loader; unknown versions are rejected rather than
silently downgraded. Dependencies are metadata only and are not fetched or
executed by this loader.

The public authoring example is `examples/08-kore-content-package.ts`. Package
authors should construct maps and items with `kore.createDefaultMap()` and
`kore.createItem()`, then serialize detached documents before loading them.
