# Changelog

All notable changes to **dsh-plugins-folders** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [SemVer](https://semver.org/).

## [1.2.6] — 2025-11-04

### Fixed

- 浮标拖到顶部（宿主的标题栏、Windows 窗口按钮那一条）会点不动——那块是窗口拖拽区，鼠标事件被系统吃掉。现在上边界留出一条安全缝：拖动与窗口变化时都按 `--dsh-windows-titlebar-height`（宿主公布的高度，+8px 余量，读不到就 56px）夹住，浮标不会压进标题栏。

## [1.2.5] — 2025-11-03

### Fixed

- 全屏时把「插件分组」浮标拖到角落，再缩小窗口浮标会跑到可视区外（看起来像消失了）。现在窗口尺寸一变就把它按按钮实际尺寸夹回视口内，并把修正后的坐标写回 `localStorage`；面板开关切换时也重新校一次。
- 「插件分组」文案强制单行（`white-space: nowrap`），浮标再窄也不换行。

## [1.2.4] — 2025-11-03

### Changed

- 「插件分组」浮动入口（`shell.overlay` 里的浮标）改成**可拖动**：按住拖到任意位置，松手记住坐标（`localStorage` 键 `dsh-plugins-folders:launcher-pos`），下次打开还在那儿。
  - 默认位置仍是右下角；拖出视口会被夹回来。
  - 拖动超过 4px 才算拖动，松手不会误开面板。

### Reverted

- 撤销 1.2.3 对「重启 Harness」按钮的拖动改造：它回到面板右下角固定不动（`position: absolute; right: 16px; bottom: 16px`）。

## [1.2.3] — 2025-11-03

### Changed

- 「重启 Harness」按钮改成可拖动：按住按钮拖到面板里任意位置，松手记住坐标（`localStorage` 键 `dsh-plugins-folders:restart-dock`），下次打开还在那儿。
  - 默认位置仍是面板右下角；拖出可视区会被夹回面板范围内。
  - 拖动超过 4px 才算拖动，松手不会误触发重启（拖动结束后的那一次 click 被吞掉）。
  - 拖到靠上位置（`top < 150`）时，进行中／失败的浮层改为朝下弹，不会顶出面板。

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