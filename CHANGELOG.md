# Changelog

All notable changes to **dsh-plugins-folders** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [SemVer](https://semver.org/).

## [1.2.2] — 2025-10-27

### Changed

- 重启后拉起的进程改走 WMI（`Invoke-CimMethod Win32_Process`）。Harness 用 job object 包住自己的子进程，在里面起 Electron 会是「进程有、窗口没有」然后自己退出；WMI 由 WmiPrvSE 托管，新进程不在那个 job 里，窗口才正常出现。
- `restart.ps1` 只留这一条拉起路径（原先三级回退全都不成立），等窗口 40 秒；失败时把最新 crash 日志尾 12 行写进日志。

### Removed

- 排查用的一次性诊断代码：全页点击埋点、`uiLog()`、`POST /plugins-folders/log` 路由与 `LOG_PATH`、按钮挂载埋点。
- 从不可达的确认浮层分支（点击早已直接触发重启）、其文案与 `.pf-restart-ok` 样式。
- `restart.ps1` 里已证伪的三级回退与 `Get-ReplayCommandLine` 复刻命令行逻辑。

### Docs

- `README.md` / `README.en.md` 互加语言切换行；`package.json` 描述与 GitHub 仓库简介改为中英双语。

## [1.2.1] — 2025-10-26

### Changed

- 「重启 Harness」按钮从抽屉标题栏挪到**插件分组面板（抽屉）自己的右下角**，钉成常驻胶囊（`.pf-restart-dock`，`position: absolute; right: 16px; bottom: 16px`）。
  - 不跟标题抢位置，抽屉头部被宿主裁掉也不影响——那正是「点了没反应」的常见现场：诊断日志里只有一长串 `restart-btn-mount`，从来没有一次点击落到 `.pf-restart-btn` 上。
  - 列表滚动时不跟着跑；抽屉主体底部留白从 26px 提到 74px，最后一行不会被按钮压住。
  - 进行中／失败的浮层改为朝上弹（`bottom: calc(100% + 10px)`），不会再被抽屉底边切掉。
  - 抽屉标题栏不再放按钮，入口只剩一个。

## [1.2.0] — 2025-10-26

### Added

- 「重启 Harness」button on the right of the panel title: one click quits the running instance and starts it again, then the page reloads by itself.
  - Host half registers two same-origin routes, `POST /plugins-folders/restart` and `GET /plugins-folders/ping`.
  - The restart is performed by a detached PowerShell child (`restart.ps1`) that sends `WM_CLOSE` first, force-kills leftovers, then relaunches the executable — so the restart still completes after the Harness process itself is gone.
  - Clicking asks for confirmation, shows a "restarting" state, and polls the ping route until the new instance answers before calling `location.reload()`.

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