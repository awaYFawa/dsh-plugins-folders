# Changelog

All notable changes to **dsh-plugins-folders** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [SemVer](https://semver.org/).

## [1.1.0] — 2025-10-26

### Added

- Plugin folders: create, rename, delete folders and move installed plugins into them; unassigned plugins fall into "Unclassified".
- Per-plugin and per-group enable switches wired to `remote.pluginManager.setBundleEnabled`.
- Batch selection with "Move to…" and batch enable/disable, plus one-step undo for every change.
- Search across all folders by plugin name or description.
- Long-press (~320 ms) drag reordering for both plugins and folders, persisted with the grouping.
- Right-click uninstall with confirmation; uninstalled plugins are recorded (name, title, install source, time — up to 60) and can be reinstalled in one click or dropped from the record.
- Chinese and English copy that follows the host locale.

### Changed

- Panel renders inside the `shell.overlay` slot (order 20) instead of taking over the plugin page tabs.
- Styles are injected into `document.head` through `ctx.effect`, so they survive panel remounts.
- Reordering uses slot arithmetic (number of group midlines crossed) with a 10 px dead zone, 4 px activation threshold and 130 ms throttle.

### Fixed

- Panel rendering error caused by an over-wide `cut()` marker removing sibling icon definitions.
- `inject` declarations for the nested `remote.pluginManager` service (must be listed separately from `remote`).
- Residual `transform` left behind after a drag ended, which shifted rows on the next render.

## [1.0.0] — 2025-10-25

### Added

- Initial release: folder grouping for the DSH Plugins page, with per-plugin switches and local persistence.

[1.1.0]: https://github.com/awaYFawa/dsh-plugins-folders/releases/tag/v1.1.0
[1.0.0]: https://github.com/awaYFawa/dsh-plugins-folders/releases/tag/v1.0.0