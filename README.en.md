# dsh-plugins-folders — folders for your DSH plugin list

A folder layer for the **Plugins** page of DeepSeek Harness: sort installed plugins into groups, flip a whole group on or off, search across groups, drag to reorder, and reinstall anything you removed from its uninstall record.

> After a few dozen plugins the list turns into an ever-growing conveyor belt. This plugin adds your own shelving on top of it — it never changes what a plugin does, only how the page presents it.

## Features

1. **Folders** — create, rename and delete folders; move any installed plugin into one. Anything unassigned lands in "Unclassified" and can be moved later.
2. **Per-plugin and per-group switches** — each row has its own switch wired to the real `remote.pluginManager.setBundleEnabled`; a group switch flips the whole group. Plugins locked by a higher-level config are marked read-only with the reason, instead of pretending to work.
3. **Batch operations** — select many rows, then "Move to…" another folder or toggle them together. Every change can be **undone**.
4. **Search** — filter by plugin name or description across all folders.
5. **Long-press drag reordering** — hold for ~320 ms to pick up a plugin or an entire folder and drop it where you want it. Order is stored with the grouping.
6. **Right-click uninstall with records** — right-click any row to uninstall the plugin (the folders plugin itself refuses to uninstall itself). Removed plugins are recorded under "Uninstalled" and can be **reinstalled in one click** from their original install source, or the record can be dropped.
7. **One-click Harness restart** — a fixed button in the panel corner quits the running instance and starts it again; the page reloads once the new instance answers.
8. **Follows the UI language** — ships Chinese and English copy, switched with the host locale.

## Install

### From the marketplace

Once the entry is listed, open **Plugins → Discover**, search for "Plugin folders", and install — or run:

```powershell
dsh plugin --profile web add github:awaYFawa/dsh-plugins-folders
```

### From source

```powershell
git clone https://github.com/awaYFawa/dsh-plugins-folders.git
cd dsh-plugins-folders
dsh plugin --profile web add .
```

Restart `dsh web` afterwards. The plugin is plain ESM with no runtime dependencies — no build step, no `npm install`.

### Uninstall

```powershell
dsh plugin --profile web rm @dsh-user/dsh-plugins-folders
```

Grouping data lives in the browser's `localStorage` and survives plugin removal; clear the two keys listed below if you want it gone.

## Usage

Open the Plugins page: a "Plugin folders" launcher appears from the `shell.overlay` slot (order 20). Click it to open the panel.

| Task | How |
|---|---|
| Create a folder | "New folder" at the top, type a name, "Create" |
| Put a plugin in a folder | The row's "Folder" dropdown, or select many and use "Move to…" |
| Rename / delete a folder | Pencil / trash next to the folder title; deleting a folder never deletes plugins |
| Toggle a plugin | The row switch, or the group switch next to the folder title |
| Reorder | Long-press ~320 ms, then drag; both plugins and folders move |
| Uninstall | Right-click the row → "Uninstall plugin" → confirm |
| Reinstall | Expand "Uninstalled" → "Reinstall" (uses the original install source) |
| Find a plugin | The search box at the top, matching name or description |

**About the switches, honestly**

- Folders only affect this page's presentation; they do not change load order or dependencies between plugins.
- Some plugins are controlled by a higher-level config and cannot be toggled from the page. The row says so and explains why.
- Toggles apply to the real plugin state immediately; if a plugin needs a Harness restart, the panel says "Saved — restart Harness to apply" rather than implying it is live.

## Data and privacy

Everything stays in your local browser `localStorage`. Nothing is uploaded, no network calls are made, and no host config files are written:

| Key | Contents |
|---|---|
| `dsh.plugins-folders.v1` | Folder structure (names, order, members, collapsed state) |
| `dsh.plugins-folders.uninstalled.v1` | Uninstall records (up to 60: name, title, install source, timestamp) |

Records include the plugin's original install source (e.g. `github:owner/repo` or a package name) purely so "Reinstall" can work; you can drop any record from the panel.

## Layout

```
dsh-plugins-folders/
├── package.json          # dsh.bundle manifest + client entry
├── cordis.patch.yml      # inserts the plugins-folders bundle
├── index.js              # host half: publishes the plugin inventory to the client
├── client.js             # client half: panel logic and styles
├── locale/
│   ├── zh.json
│   └── en.json
├── icon.svg              # vector icon
└── assets/
    └── icon-180.png      # raster tile used by storefronts
```

## Requirements

- DeepSeek Harness, web platform (`platform: web`); works whenever the `shell.overlay` slot exists.
- Uses the host-provided `slots`, `locale` and `remote.pluginManager` services — no extra npm packages.
- The host must expose `remote.pluginManager.setBundleEnabled`; when it does not, the panel reports a clear error instead of failing silently.

## FAQ

**No launcher on the Plugins page?**
Check that `dsh web` was restarted, then look for `dsh-plugins-folders` warnings in the browser console (a missing slot only warns; it never breaks the page).

**My folders disappeared.**
They live in the current browser's `localStorage` — another browser, another profile, or cleared site data means an empty structure. Your plugins are untouched; regroup them.

**Does uninstalling a plugin remove the folders plugin too?**
No. The panel explicitly refuses to uninstall itself ("Cannot uninstall the folders plugin itself").

**A switch does nothing.**
That plugin is probably owned by a higher-level config (read-only), or a previous action for it is still running ("Working…").

## License

[MIT](./LICENSE)