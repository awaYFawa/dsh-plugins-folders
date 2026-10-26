/**
 * @dsh-user/dsh-plugins-folders — 浏览器半边（client bundle）
 *
 * 右下角浮动按钮 → 右侧抽屉：用文件夹给已安装插件分类，并直接管理它们的开关。
 *
 * 能力：
 *   - 新建 / 重命名 / 删除文件夹；把插件移入文件夹或移回「未分类」
 *   - 每行自带开关（remote.pluginManager.setBundleEnabled），单条即时启停
 *   - 分组标题带整组开关：全开 → 一键全关，否则一键全开
 *   - 每行复选框 + 批量操作条：批量启用 / 批量停用 / 批量移动到文件夹
 *   - 已启用的插件排在前面；行内显示头像、简介、版本与状态
 *
 * 写操作一律串行执行，随即重新拉取清单；`application` 不是 `applied` 的结果
 * 会作为提示显示（例如需要重启）。
 */
window.__ModuleLoader__.load({
  id: "@dsh-user/dsh-plugins-folders",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    var React = require("react");
    var h = React.createElement;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useMemo = React.useMemo;
    var useCallback = React.useCallback;
    var useRef = React.useRef;
    var useLayoutEffect = React.useLayoutEffect;

    var STORAGE_KEY = "dsh.plugins-folders.v1";
    var RECORD_KEY = "dsh.plugins-folders.uninstalled.v1";
    var SELF = "@dsh-user/dsh-plugins-folders";

    // ── 文案 ──────────────────────────────────────────────────────────
    var DICT = {
      zh: {
        launcher: "插件分组",
        title: "插件分组",
        intro: "已启用的插件排在前面。开关直接作用于真实插件，分组只影响本页展示。",
        close: "关闭",
        newFolder: "新建文件夹",
        folderNamePlaceholder: "例如：界面增强",
        create: "创建",
        save: "保存",
        cancel: "取消",
        rename: "重命名",
        remove: "删除",
        confirmRemove: "确认删除",
        unclassified: "未分类",
        moveTo: "所在分组",
        moveManyTo: "移动到…",
        open: "打开",
        empty: "还没有已安装的插件。",
        emptyFolder: "这个文件夹还是空的。",
        loading: "正在读取插件列表…",
        failed: "读取插件列表失败：",
        retry: "重试",
        count: "个插件",
        enabled: "已启用",
        disabled: "已停用",
        enable: "启用",
        disable: "停用",
        crashed: "分组面板渲染出错：",
        expand: "展开",
        collapse: "收起",
        noFolderYet: "还没有文件夹",
        selectAll: "全选",
        clearSelection: "清空",
        selected: "已选",
        items: "项",
        groupOn: "整组启用",
        groupOff: "整组停用",
        readOnly: "这个插件由上级配置接管，页面不能改它的开关",
        busy: "处理中…",
        done: "完成",
        restartHint: "改动已保存，需要重启 Harness 才生效",
        confirmAsk: "即将对",
        confirmYes: "确认执行",
        undoToggle: "已切换开关",
        undoMove: "已移动分组",
        undo: "撤销",
        undoDone: "已撤销",
        uninstall: "卸载插件",
        uninstallAsk: "即将卸载",
        uninstallHint: "卸载后无法从这里撤销",
        cannotUninstall: "不能卸载分组插件自己",
        manageRow: "右键可管理这个插件",
        searchPlaceholder: "搜索插件名称或简介",
        clearSearch: "清空搜索",
        noMatch: "没有匹配的插件",
        uninstalled: "已卸载",
        reinstall: "重新安装",
        removeRecord: "移除记录",
        reinstallHint: "按卸载前的安装地址重新安装",
        uninstallRecorded: "已记入卸载记录，可从这里重新安装",
      },
      en: {
        launcher: "Plugin folders",
        title: "Plugin folders",
        intro: "Enabled plugins come first. Switches act on the real plugin; grouping only changes this view.",
        close: "Close",
        newFolder: "New folder",
        folderNamePlaceholder: "e.g. Interface",
        create: "Create",
        save: "Save",
        cancel: "Cancel",
        rename: "Rename",
        remove: "Delete",
        confirmRemove: "Confirm delete",
        unclassified: "Uncategorized",
        moveTo: "Folder",
        moveManyTo: "Move to…",
        open: "Open",
        empty: "No installed plugins yet.",
        emptyFolder: "This folder is still empty.",
        loading: "Reading the plugin list…",
        failed: "Could not read the plugin list: ",
        retry: "Retry",
        count: "plugins",
        enabled: "Enabled",
        disabled: "Disabled",
        enable: "Enable",
        disable: "Disable",
        crashed: "The folders panel failed to render: ",
        expand: "Expand",
        collapse: "Collapse",
        noFolderYet: "No folders yet",
        selectAll: "Select all",
        clearSelection: "Clear",
        selected: "Selected",
        items: "items",
        groupOn: "Enable all",
        groupOff: "Disable all",
        readOnly: "A higher configuration layer owns this plugin's switch",
        busy: "Working…",
        done: "Done",
        restartHint: "Saved — restart Harness for this change to take effect",
        confirmAsk: "Apply to",
        confirmYes: "Confirm",
        undoToggle: "Toggled",
        undoMove: "Moved",
        undo: "Undo",
        undoDone: "Undone",
        uninstall: "Uninstall plugin",
        uninstallAsk: "Uninstall",
        uninstallHint: "Uninstalling cannot be undone here",
        cannotUninstall: "The folders plugin cannot uninstall itself",
        manageRow: "Right-click to manage this plugin",
        searchPlaceholder: "Search plugin name or description",
        clearSearch: "Clear search",
        noMatch: "No matching plugins",
        uninstalled: "Uninstalled",
        reinstall: "Reinstall",
        removeRecord: "Remove entry",
        reinstallHint: "Reinstall from the address recorded at uninstall",
        uninstallRecorded: "Recorded — you can reinstall it from here",
      },
    };

    var ctxRef = null;

    function currentLang() {
      try {
        var locale = ctxRef && ctxRef.get ? ctxRef.get("locale") : null;
        var snapshot = null;
        if (locale) {
          if (typeof locale.getLocale === "function") snapshot = locale.getLocale();
          else if (typeof locale.getSnapshot === "function") snapshot = locale.getSnapshot();
        }
        var id = snapshot && (snapshot.id || snapshot.localeId || snapshot.locale || snapshot.current);
        if (typeof id === "string") return id.toLowerCase().indexOf("en") === 0 ? "en" : "zh";
      } catch (error) {
        /* 读不到语言就按中文渲染 */
      }
      return "zh";
    }

    function text() {
      return DICT[currentLang()] || DICT.zh;
    }

    // ── 数据：宿主插件清单 ────────────────────────────────────────────
    function shortName(name) {
      var value = String(name || "");
      if (value.charAt(0) === "@") {
        var slash = value.indexOf("/");
        if (slash >= 0) value = value.slice(slash + 1);
      }
      return value.replace(/^dsh-(?:host-|client-)?/, "");
    }

    function localeText(value) {
      if (typeof value === "string") return value;
      if (value && typeof value === "object") {
        var lang = currentLang();
        var keys = lang === "en" ? ["en", "en-US", "zh", "zh-CN"] : ["zh", "zh-CN", "en", "en-US"];
        for (var index = 0; index < keys.length; index += 1) {
          if (typeof value[keys[index]] === "string") return value[keys[index]];
        }
        var names = Object.keys(value);
        for (var position = 0; position < names.length; position += 1) {
          if (typeof value[names[position]] === "string") return value[names[position]];
        }
      }
      return undefined;
    }

    function getManager() {
      try {
        var remote = ctxRef && ctxRef.get ? ctxRef.get("remote") : null;
        return (remote && remote.pluginManager) || null;
      } catch (error) {
        return null;
      }
    }

    function itemFrom(name, meta, version, enabled, readOnlyReason, installTarget) {
      var target = null;
      if (installTarget && typeof installTarget === "object" && typeof installTarget.spec === "string") {
        target = {
          spec: installTarget.spec,
          version: typeof installTarget.version === "string" ? installTarget.version : "",
        };
      }
      return {
        name: name,
        title: localeText(meta && meta.title) || shortName(name),
        description: localeText(meta && meta.description) || "",
        icon: typeof (meta && meta.icon) === "string" ? meta.icon : "",
        version: typeof version === "string" ? version : "",
        enabled: enabled === true,
        readOnly: typeof readOnlyReason === "string" && readOnlyReason.length > 0,
        readOnlyReason: typeof readOnlyReason === "string" ? readOnlyReason : "",
        installTarget: target,
      };
    }

    function fromInjection() {
      try {
        var payload = window.__DSH_PLUGINS_FOLDERS__;
        if (!payload || !Array.isArray(payload.packages)) return null;
        var items = [];
        for (var index = 0; index < payload.packages.length; index += 1) {
          var entry = payload.packages[index];
          if (!entry || typeof entry.name !== "string") continue;
          items.push(itemFrom(entry.name, entry.meta, entry.version, entry.enabled, "host-snapshot", null));
        }
        return items;
      } catch (error) {
        return null;
      }
    }

    function fromRemote() {
      var manager = getManager();
      if (!manager || typeof manager.listBundles !== "function") {
        return Promise.reject(new Error("remote.pluginManager 不可用"));
      }
      return new Promise(function (resolve, reject) {
        var pluginsCall =
          typeof manager.listPlugins === "function" ? manager.listPlugins() : Promise.resolve(null);
        Promise.all([manager.listBundles(), pluginsCall])
          .then(function (outcome) {
            var bundles = outcome[0];
            if (!bundles || bundles.ok !== true) {
              var failure = bundles && bundles.error;
              throw new Error((failure && (failure.message || failure.code)) || "宿主没有返回插件列表");
            }
            var live = outcome[1] && outcome[1].ok === true ? outcome[1].value || [] : [];
            var byEntry = {};
            for (var index = 0; index < live.length; index += 1) {
              if (live[index] && typeof live[index].entryId === "string") {
                byEntry[live[index].entryId] = live[index];
              }
            }
            var list = Array.isArray(bundles.value) ? bundles.value : [];
            var items = [];
            for (var position = 0; position < list.length; position += 1) {
              var bundle = list[position];
              if (!bundle || typeof bundle.name !== "string") continue;
              if (bundle.installed === false) continue;
              var rows = Array.isArray(bundle.rows) ? bundle.rows : [];
              var enabled = bundle.enabled === true;
              if (!enabled) {
                for (var rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
                  var row = rows[rowIndex];
                  var entry = row && typeof row.entryId === "string" ? byEntry[row.entryId] : null;
                  if ((entry && entry.enabled === true) || (row && row.enabled === true)) {
                    enabled = true;
                    break;
                  }
                }
              }
              var meta = bundle.meta;
              if ((!meta || meta.description === undefined) && typeof bundle.description === "string") {
                meta = { title: meta && meta.title, description: bundle.description, icon: meta && meta.icon };
              }
              items.push(itemFrom(bundle.name, meta, bundle.version, enabled, bundle.readOnlyReason, bundle.installTarget));
            }
            resolve({ source: "remote", items: items });
          })
          .catch(reject);
      });
    }

    function collect() {
      var injected = fromInjection();
      return fromRemote().then(
        function (result) {
          return result;
        },
        function (error) {
          if (injected && injected.length > 0) {
            return { source: "host", items: injected, readOnly: true };
          }
          return {
            source: "none",
            items: [],
            error: String((error && error.message) || error || "unknown"),
          };
        }
      );
    }

    /** 打开/关闭一个 bundle；非 applied 的结果当作失败上报。 */
    function callSetEnabled(name, enabled) {
      var manager = getManager();
      if (!manager || typeof manager.setBundleEnabled !== "function") {
        return Promise.reject(new Error("remote.pluginManager.setBundleEnabled 不可用"));
      }
      return Promise.resolve(manager.setBundleEnabled(name, enabled)).then(function (result) {
        if (result && typeof result === "object") {
          if (result.application === "failed") {
            var code = result.error && result.error.code;
            throw new Error("failed" + (code ? " · " + code : ""));
          }
          if (result.application === "restart-required") return { restart: true };
        }
        return result;
      });
    }

    // ── 分组存储 ──────────────────────────────────────────────────────
    var idSeq = 0;

    function newId() {
      idSeq += 1;
      return "f" + Date.now().toString(36) + idSeq.toString(36);
    }

    function normalize(store) {
      var source = store && Array.isArray(store.folders) ? store.folders : [];
      var seenIds = {};
      var folders = [];
      for (var index = 0; index < source.length; index += 1) {
        var folder = source[index];
        if (!folder || typeof folder.name !== "string") continue;
        var id = typeof folder.id === "string" && folder.id ? folder.id : newId();
        if (seenIds[id]) id = newId();
        seenIds[id] = true;
        var items = [];
        var seenItems = {};
        var rawItems = Array.isArray(folder.items) ? folder.items : [];
        for (var itemIndex = 0; itemIndex < rawItems.length; itemIndex += 1) {
          var name = rawItems[itemIndex];
          if (typeof name !== "string" || seenItems[name]) continue;
          seenItems[name] = true;
          items.push(name);
        }
        folders.push({ id: id, name: folder.name, items: items });
      }
      return { version: 1, folders: folders };
    }

    function readStore() {
      try {
        var raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return { version: 1, folders: [] };
        return normalize(JSON.parse(raw));
      } catch (error) {
        return { version: 1, folders: [] };
      }
    }

    function writeStore(store) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      } catch (error) {
        /* 隐私模式等场景写入失败时，本次会话仍然可用 */
      }
    }

    // ── 卸载记录 ──────────────────────────────────────────────────────
    function readRecords() {
      try {
        var raw = window.localStorage.getItem(RECORD_KEY);
        if (!raw) return [];
        var list = JSON.parse(raw);
        if (!Array.isArray(list)) return [];
        var records = [];
        for (var index = 0; index < list.length; index += 1) {
          var entry = list[index];
          if (!entry || typeof entry.name !== "string") continue;
          records.push({
            name: entry.name,
            title: typeof entry.title === "string" && entry.title ? entry.title : shortName(entry.name),
            version: typeof entry.version === "string" ? entry.version : "",
            icon: typeof entry.icon === "string" ? entry.icon : "",
            spec: typeof entry.spec === "string" && entry.spec ? entry.spec : entry.name,
            at: typeof entry.at === "number" ? entry.at : Date.now(),
          });
        }
        return records;
      } catch (error) {
        return [];
      }
    }

    function writeRecords(records) {
      try {
        window.localStorage.setItem(RECORD_KEY, JSON.stringify(records));
      } catch (error) {
        /* 写不进就只在本会话可见 */
      }
    }

    // ── 样式（注入 document.head）────────────────────────────────────
    var CSS = [
      ".pf-launcher{position:fixed;right:20px;bottom:20px;z-index:70;pointer-events:auto;display:inline-flex;align-items:center;gap:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);border-radius:999px;padding:8px 14px 8px 12px;font-size:12px;font-weight:500;line-height:1.4;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.16);transition:background-color .2s ease,transform .2s cubic-bezier(.22,1,.36,1),box-shadow .2s ease}",
      ".pf-launcher:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,var(--dsw-alias-bg-overlay));transform:translateY(-1px);box-shadow:0 10px 26px rgba(0,0,0,.2)}",
      ".pf-launcher:active{transform:translateY(0) scale(.98)}",
      ".pf-launcher svg{color:var(--dsw-alias-brand-primary);flex:none}",
      ".pf-mask{position:fixed;inset:0;z-index:75;pointer-events:auto;background:rgba(0,0,0,.26);animation:pf-fade-in .26s ease}",
      "@keyframes pf-fade-in{from{opacity:0}to{opacity:1}}",
      ".pf-drawer{position:fixed;top:0;right:0;bottom:0;z-index:76;pointer-events:auto;width:min(430px,94vw);display:flex;flex-direction:column;background:var(--dsw-alias-bg-overlay);border-left:1px solid var(--dsw-alias-border-l1);box-shadow:-18px 0 48px rgba(0,0,0,.2);animation:pf-drawer-in .34s cubic-bezier(.22,1,.36,1)}",
      "@keyframes pf-drawer-in{from{opacity:0;transform:translateX(44px)}to{opacity:1;transform:none}}",
      ".pf-drawer-head{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid var(--dsw-alias-border-l1)}",
      ".pf-drawer-head svg{color:var(--dsw-alias-brand-primary);flex:none}",
      ".pf-drawer-title{font-size:14px;font-weight:600;flex:1 1 auto;min-width:0}",
      ".pf-icon-btn{appearance:none;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);border-radius:8px;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none;transition:background-color .16s ease,color .16s ease}",
      ".pf-icon-btn:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);color:var(--dsw-alias-label-primary)}",
      ".pf-icon-btn:disabled{opacity:.45;cursor:default}",
      ".pf-drawer-body{flex:1 1 auto;overflow:auto;padding:12px 14px 26px}",
      ".pf-root{display:flex;flex-direction:column;gap:12px;color:var(--dsw-alias-label-primary);font:inherit}",
      ".pf-head{display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap}",
      ".pf-head-text{display:flex;flex-direction:column;gap:4px;min-width:160px;flex:1 1 180px}",
      ".pf-sub{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary)}",
      ".pf-root .pf-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:8px;padding:5px 11px;font-size:12px;line-height:1.4;cursor:pointer;white-space:nowrap;transition:background-color .16s ease,border-color .16s ease,transform .12s ease}",
      ".pf-root .pf-btn:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);border-color:var(--dsw-alias-border-l2)}",
      ".pf-root .pf-btn:active{transform:scale(.97)}",
      ".pf-root .pf-btn:disabled{opacity:.45;cursor:default}",
      ".pf-root .pf-btn-primary{appearance:none;border:1px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:#fff;border-radius:8px;padding:5px 12px;font-size:12px;line-height:1.4;cursor:pointer;white-space:nowrap;transition:filter .16s ease,transform .12s ease}",
      ".pf-root .pf-btn-primary:hover{filter:brightness(1.1)}",
      ".pf-root .pf-btn-primary:active{transform:scale(.97)}",
      ".pf-root .pf-btn-primary:disabled{opacity:.5;cursor:default;filter:none}",
      ".pf-root .pf-btn-danger{appearance:none;border:1px solid var(--dsw-alias-state-error-primary);background:transparent;color:var(--dsw-alias-state-error-primary);border-radius:8px;padding:5px 11px;font-size:12px;line-height:1.4;cursor:pointer;white-space:nowrap;transition:background-color .16s ease,transform .12s ease}",
      ".pf-root .pf-btn-danger:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent)}",
      ".pf-root .pf-input{appearance:none;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:5px 9px;font-size:12px;line-height:1.5;outline:none;min-width:0;transition:border-color .16s ease,box-shadow .16s ease}",
      ".pf-root .pf-input:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent)}",
      ".pf-topbar{position:sticky;top:-12px;z-index:7;margin:0 -14px;padding:10px 14px 8px;display:flex;flex-direction:column;gap:8px;background:var(--dsw-alias-bg-overlay);box-shadow:0 10px 14px -12px rgba(0,0,0,.4)}",
      ".pf-confirm{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-layer-1));border-radius:10px;animation:pf-fade-in .22s ease}",
      ".pf-confirm-text{font-size:12px;line-height:1.5;flex:1 1 160px}",
      ".pf-undo{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;animation:pf-fade-in .22s ease}",
      ".pf-undo-text{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);flex:1 1 140px}",
      ".pf-search{display:flex;align-items:center;gap:6px}",
      ".pf-search-input{flex:1 1 auto;padding:6px 10px;font-size:12px}",
      ".pf-search-input::-webkit-search-cancel-button{display:none}",
      ".pf-batch{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;animation:pf-fade-in .22s ease}",
      ".pf-batch-count{font-size:12px;font-weight:600;margin-right:2px}",
      ".pf-notice{font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);border-radius:8px;padding:7px 9px}",
      ".pf-root .pf-card{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:12px;padding:4px 10px 6px;transition:border-color .2s ease}",
      ".pf-root .pf-card:hover{border-color:var(--dsw-alias-border-l2)}",
      ".pf-root .pf-card-head{display:flex;align-items:center;gap:6px;padding:7px 4px;user-select:none;border-radius:8px;transition:background-color .16s ease}",
      ".pf-root .pf-card-head:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}",
      ".pf-caret{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;color:var(--dsw-alias-label-secondary);transition:transform .3s cubic-bezier(.22,1,.36,1);flex:none}",
      ".pf-root .pf-card[data-open='true'] .pf-caret{transform:rotate(90deg)}",
      ".pf-folder{display:inline-flex;color:var(--dsw-alias-brand-primary);flex:none}",
      ".pf-card-title{font-size:13px;font-weight:600;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".pf-count{font-size:11px;color:var(--dsw-alias-label-secondary);flex:none}",
      ".pf-card-body{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .34s cubic-bezier(.22,1,.36,1),opacity .24s ease}",
      ".pf-root .pf-card[data-open='true'] .pf-card-body{grid-template-rows:1fr;opacity:1}",
      ".pf-card-inner{overflow:hidden;min-height:0;transition:transform .34s cubic-bezier(.22,1,.36,1)}",
      ".pf-root .pf-card[data-open='true'] .pf-card-inner{transform:none}",
      ".pf-root .pf-card[data-open='false'] .pf-card-inner{transform:translateY(-6px)}",
      ".pf-rows{display:flex;flex-direction:column;gap:2px;padding:2px 0 4px}",
      ".pf-row{display:flex;align-items:center;gap:9px;min-width:0;padding:8px 6px;border-radius:10px;background:transparent;transition:background-color .18s ease}",
      ".pf-root .pf-row:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent)}",
      ".pf-check{appearance:none;flex:none;width:15px;height:15px;margin:0;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;background:transparent;cursor:pointer;position:relative;transition:background-color .14s ease,border-color .14s ease}",
      ".pf-check:hover{border-color:var(--dsw-alias-brand-primary)}",
      ".pf-check:checked{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}",
      ".pf-check:checked::after{content:'';position:absolute;left:4px;top:1px;width:5px;height:9px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}",
      ".pf-art{flex:none;width:36px;height:36px;border:.5px solid var(--dsw-alias-border-l3,var(--dsw-alias-border-l1));border-radius:var(--dsw-radius-md,10px);background:var(--dsw-alias-bg-layer-2);display:inline-flex;align-items:center;justify-content:center;overflow:hidden;transition:border-color .16s ease}",
      ".pf-root .pf-row:hover .pf-art{border-color:var(--dsw-alias-border-l2)}",
      ".pf-art img{width:26px;height:26px;object-fit:contain;display:block}",
      ".pf-art svg{width:22px;height:22px;color:var(--dsw-alias-label-secondary)}",
      ".pf-main{display:flex;flex-direction:column;gap:2px;flex:1 1 auto;min-width:0}",
      ".pf-title-line{display:flex;align-items:center;gap:6px;min-width:0}",
      ".pf-title{font-size:12.5px;font-weight:500;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".pf-ver{font-size:10.5px;color:var(--dsw-alias-label-secondary);flex:none}",
      ".pf-desc{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
      ".pf-switch{appearance:none;flex:none;width:34px;height:19px;padding:0;border:0;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 24%,transparent);position:relative;cursor:pointer;transition:background-color .2s cubic-bezier(.22,1,.36,1)}",
      ".pf-switch::after{content:'';position:absolute;top:2.5px;left:2.5px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .22s cubic-bezier(.22,1,.36,1)}",
      ".pf-switch[aria-checked='true']{background:var(--dsw-alias-brand-primary)}",
      ".pf-switch[aria-checked='true']::after{transform:translateX(15px)}",
      ".pf-switch:hover{filter:brightness(1.05)}",
      ".pf-switch:disabled{opacity:.45;cursor:default}",
      ".pf-switch.pf-switch-sm{width:26px;height:15px}",
      ".pf-switch.pf-switch-sm::after{width:10px;height:10px;top:2.5px;left:2.5px}",
      ".pf-switch.pf-switch-sm[aria-checked='true']::after{transform:translateX(11px)}",
      ".pf-root .pf-picker{appearance:none;display:inline-flex;align-items:center;gap:5px;justify-content:space-between;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:4px 7px;font-size:11px;line-height:1.5;max-width:104px;cursor:pointer;outline:none;transition:background-color .16s ease,border-color .16s ease}",
      ".pf-root .pf-picker:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);border-color:var(--dsw-alias-border-l2)}",
      ".pf-root .pf-picker[data-open='true']{border-color:var(--dsw-alias-brand-primary)}",
      ".pf-picker-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".pf-picker-caret{display:inline-flex;color:var(--dsw-alias-label-secondary);flex:none;transition:transform .18s ease}",
      ".pf-root .pf-picker[data-open='true'][data-placement='up'] .pf-picker-caret{transform:rotate(180deg)}",
      ".pf-root .pf-picker[data-open='true'][data-placement='down'] .pf-picker-caret{transform:rotate(0deg)}",
      ".pf-menu{position:fixed;z-index:90;transform-origin:top center;animation:pf-menu-in .22s cubic-bezier(.34,1.25,.64,1)}",
      ".pf-menu[data-placement='up']{transform-origin:bottom center;animation-name:pf-menu-in-up}",
      "@keyframes pf-menu-in{from{opacity:0;transform:translateY(-8px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}",
      "@keyframes pf-menu-in-up{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}",
      ".pf-menu-title{font-size:11px;line-height:1.4;color:var(--dsw-alias-label-secondary);padding:5px 9px 6px;border-bottom:1px solid var(--dsw-alias-border-l1);margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".pf-option-danger{color:var(--dsw-alias-state-error-primary)}",
      ".pf-option-danger:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent)}",
      ".pf-option:disabled{opacity:.5;cursor:default}",
      ".pf-menu-inner{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);border-radius:10px;padding:4px;box-shadow:0 12px 32px rgba(0,0,0,.22);max-height:260px;overflow:auto}",
      ".pf-option{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;text-align:left;border:0;background:transparent;color:var(--dsw-alias-label-primary);border-radius:8px;padding:7px 9px;font-size:12px;line-height:1.5;cursor:pointer;transition:background-color .14s ease}",
      ".pf-option:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 9%,transparent)}",
      ".pf-option[data-current='true']{font-weight:600}",
      ".pf-option[data-current='true']::after{content:'';margin-left:auto;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-brand-primary)}",
      ".pf-drag-wrap{touch-action:none}",
      ".pf-drag-wrap[data-dragging='true'] .pf-card{border-color:var(--dsw-alias-border-l2);box-shadow:0 12px 30px rgba(0,0,0,.2);transform:scale(1.008);transition:box-shadow .24s cubic-bezier(.22,1,.36,1),transform .24s cubic-bezier(.22,1,.36,1),border-color .24s cubic-bezier(.22,1,.36,1)}",
      ".pf-drag-wrap[data-dragging='true'] .pf-card-head{cursor:grabbing}",
      ".pf-empty{font-size:12px;color:var(--dsw-alias-label-secondary);padding:8px 2px 10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
    ].join("");

    // ── 图标 ──────────────────────────────────────────────────────────
    function caretIcon() {
      return h(
        "svg",
        { viewBox: "0 0 16 16", width: 11, height: 11, "aria-hidden": true, fill: "currentColor" },
        h("path", { d: "M6 3.2 10.8 8 6 12.8 4.9 11.7 8.6 8 4.9 4.3Z" })
      );
    }

    function chevronDown() {
      return h(
        "svg",
        { viewBox: "0 0 16 16", width: 10, height: 10, "aria-hidden": true, fill: "currentColor" },
        h("path", { d: "M3.2 6 8 10.8 12.8 6 11.7 4.9 8 8.6 4.3 4.9Z" })
      );
    }

    function folderGlyph() {
      return h(
        "svg",
        { viewBox: "0 0 16 16", width: 15, height: 15, "aria-hidden": true, fill: "currentColor" },
        h("path", {
          d: "M1.6 4.1c0-.7.5-1.2 1.2-1.2h3.1c.3 0 .6.2.8.4l.7 1h5.8c.7 0 1.2.5 1.2 1.2v6.4c0 .7-.5 1.2-1.2 1.2H2.8c-.7 0-1.2-.5-1.2-1.2V4.1Z",
          opacity: 0.9,
        })
      );
    }

    function closeIcon() {
      return h(
        "svg",
        { viewBox: "0 0 16 16", width: 12, height: 12, "aria-hidden": true, fill: "currentColor" },
        h("path", {
          d: "M4.2 3.1 8 6.9l3.8-3.8 1.1 1.1L9.1 8l3.8 3.8-1.1 1.1L8 9.1l-3.8 3.8-1.1-1.1L6.9 8 3.1 4.2Z",
        })
      );
    }

    function pencilIcon() {
      return h(
        "svg",
        { viewBox: "0 0 16 16", width: 12, height: 12, "aria-hidden": true, fill: "currentColor" },
        h("path", {
          d: "M11.3 1.9a1.4 1.4 0 0 1 2 0l.8.8a1.4 1.4 0 0 1 0 2l-7.6 7.6-3.1.9.9-3.1 7-7.2Zm-6 6.7-.5 1.6 1.6-.5 5.8-5.8-1.1-1.1-5.8 5.8Z",
        })
      );
    }

    function trashIcon() {
      return h(
        "svg",
        { viewBox: "0 0 16 16", width: 12, height: 12, "aria-hidden": true, fill: "currentColor" },
        h("path", {
          d: "M6 2h4l.6 1H13v1.4H3V3h2.4L6 2Zm-1.6 4h7.2l-.5 7.2a1 1 0 0 1-1 .8H5.9a1 1 0 0 1-1-.8L4.4 6Z",
        })
      );
    }

    function defaultArt() {
      return h(
        "svg",
        { viewBox: "0 0 24 24", "aria-hidden": true, fill: "none", stroke: "currentColor", strokeWidth: 1.5 },
        h("path", { d: "M8 4.5h5.2L18 9.3v10.2H8z", strokeLinejoin: "round" }),
        h("path", { d: "M13 4.5v5h5", strokeLinejoin: "round" }),
        h("path", { d: "M5.5 7.5V19c0 .8.6 1.5 1.4 1.5h8.3", opacity: 0.45, strokeLinecap: "round" })
      );
    }

    function assign(target) {
      for (var index = 1; index < arguments.length; index += 1) {
        var source = arguments[index];
        if (!source) continue;
        var keys = Object.keys(source);
        for (var keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
          target[keys[keyIndex]] = source[keys[keyIndex]];
        }
      }
      return target;
    }

    /** 已启用的排前面，其次按标题；同状态保持名称顺序。 */
    function sortMembers(list) {
      return list.slice().sort(function (left, right) {
        if (left.enabled !== right.enabled) return left.enabled ? -1 : 1;
        return left.title.localeCompare(right.title, "zh-Hans-CN");
      });
    }

    /**
     * FLIP：重排后用位移反向补偿再过渡回原位，让卡片"滑"过去而不是瞬移。
     *
     * 两个关键点（都是踩过的坑）：
     *  1. 位置一律用 `offsetTop` 量 —— `getBoundingClientRect().top` 会把正在播放的
     *     transform 和滚动位置一起算进去，导致 delta 累积、卡片来回乱跳；
     *  2. 只有拖动进行中才播放动画，其余渲染（搜索、展开、菜单）只更新快照，
     *     否则任何无关重渲染都会误判成"位移"并抖一下。
     *
     * @param refs - 保存每一行 DOM 的 ref map
     * @param previous - 上一帧的位置快照（会被就地更新）
     * @param active - 是否处于拖动中；false 时只记录位置
     */
    function animateReorder(refs, previous, active) {
      var measured = {};
      Object.keys(refs.current).forEach(function (id) {
        var element = refs.current[id];
        if (!element) return;
        measured[id] = typeof element.offsetTop === "number" ? element.offsetTop : 0;
      });
      if (!active) {
        /* 非拖动：只更新快照，并清掉上一轮可能残留的补偿位移，
           否则动画被打断的元素会永久停在半路上。 */
        Object.keys(refs.current).forEach(function (id) {
          var element = refs.current[id];
          if (element && element.style && element.style.transform) {
            element.style.transform = "";
            element.style.transition = "";
          }
        });
        previous.current = measured;
        return;
      }
      Object.keys(measured).forEach(function (id) {
        var last = previous.current[id];
        var next = measured[id];
        if (last === undefined || next === undefined) return;
        var delta = last - next;
        if (Math.abs(delta) < 3) return;
        var element = refs.current[id];
        if (!element || !element.style) return;
        element.style.transition = "none";
        element.style.transform = "translateY(" + delta + "px)";
        void element.offsetHeight;
        element.style.transition = "transform .2s cubic-bezier(.22,1,.36,1)";
        element.style.transform = "translateY(0)";
      });
      previous.current = measured;
    }

    // ── 渲染错误边界 ──────────────────────────────────────────────────
    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }

      static getDerivedStateFromError(error) {
        return { error: error };
      }

      componentDidCatch(error, info) {
        try {
          console.error("[dsh-plugins-folders]", error, info);
        } catch (ignored) {
          /* ignore */
        }
      }

      render() {
        if (this.state.error) {
          return h(
            "div",
            { className: "pf-empty", style: { color: "var(--dsw-alias-state-error-primary)" } },
            text().crashed + String((this.state.error && this.state.error.message) || this.state.error)
          );
        }
        return this.props.children;
      }
    }

    // ── 分组面板（抽屉内容）──────────────────────────────────────────
    function FoldersPanel() {
      var copy = text();
      var scanState = useState({ status: "loading", source: "", items: [], error: "", readOnly: false });
      var scan = scanState[0];
      var setScan = scanState[1];

      var storeState = useState(readStore);
      var store = storeState[0];
      var setStore = storeState[1];

      var reloadState = useState(0);
      var reload = reloadState[0];
      var setReload = reloadState[1];

      var collapsedState = useState({});
      var collapsed = collapsedState[0];
      var setCollapsed = collapsedState[1];

      var badIconsState = useState({});
      var badIcons = badIconsState[0];
      var setBadIcons = badIconsState[1];

      var menuState = useState(null);
      var menu = menuState[0];
      var setMenu = menuState[1];

      var selectedState = useState({});
      var selected = selectedState[0];
      var setSelected = selectedState[1];

      var busyState = useState({});
      var busy = busyState[0];
      var setBusy = busyState[1];

      var noticeState = useState("");
      var notice = noticeState[0];
      var setNotice = noticeState[1];

      var askState = useState(null);
      var ask = askState[0];
      var setAsk = askState[1];

      var undoState = useState(null);
      var undo = undoState[0];
      var setUndo = undoState[1];

      var queryState = useState("");
      var query = queryState[0];
      var setQuery = queryState[1];

      var recordsState = useState(readRecords);
      var records = recordsState[0];
      var setRecords = recordsState[1];

      var creatingState = useState(false);
      var creating = creatingState[0];
      var setCreating = creatingState[1];

      var draftState = useState("");
      var draft = draftState[0];
      var setDraft = draftState[1];

      var renamingState = useState(null);
      var renamingId = renamingState[0];
      var setRenamingId = renamingState[1];

      var renameDraftState = useState("");
      var renameDraft = renameDraftState[0];
      var setRenameDraft = renameDraftState[1];

      var confirmState = useState(null);
      var confirmId = confirmState[0];
      var setConfirmId = confirmState[1];

      var folderDragState = useState(null);
      var folderDrag = folderDragState[0];
      var setFolderDrag = folderDragState[1];

      var folderRefs = useRef({});
      var dragEndedAt = useRef(0);
      var dragLastY = useRef(0);
      var dragLastSwap = useRef(0);

      useEffect(function () {
        var alive = true;
        setScan({ status: "loading", source: "", items: [], error: "", readOnly: false });
        collect().then(function (result) {
          if (!alive) return;
          if (result.source === "none") {
            try {
              console.error("[dsh-plugins-folders] 读取插件列表失败", result.error);
            } catch (ignored) {
              /* ignore */
            }
            setScan({ status: "error", source: "none", items: [], error: result.error || "unknown", readOnly: false });
            return;
          }
          setScan({
            status: "ready",
            source: result.source,
            items: result.items,
            error: "",
            readOnly: result.readOnly === true,
          });
        });
        return function () {
          alive = false;
        };
      }, [reload]);

      useEffect(
        function () {
          if (!menu) return undefined;
          var close = function () {
            setMenu(null);
          };
          var onPointerDown = function (event) {
            var target = event.target;
            if (target && typeof target.closest === "function" && target.closest(".pf-menu")) return;
            if (target && typeof target.closest === "function" && target.closest(".pf-picker")) return;
            close();
          };
          var onKey = function (event) {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          };
          document.addEventListener("mousedown", onPointerDown, true);
          document.addEventListener("keydown", onKey, true);
          window.addEventListener("resize", close);
          window.addEventListener("scroll", close, true);
          return function () {
            document.removeEventListener("mousedown", onPointerDown, true);
            document.removeEventListener("keydown", onKey, true);
            window.removeEventListener("resize", close);
            window.removeEventListener("scroll", close, true);
          };
        },
        [menu]
      );

      var commit = useCallback(function (next) {
        var normalized = normalize(next);
        setStore(normalized);
        writeStore(normalized);
      }, []);

      var folders = store.folders;
      var foldersListRef = useRef(folders);
      foldersListRef.current = folders;

      /* 抽屉里的文件夹卡片：长按拖动排序，与「插件分组管理」页同一套手感。 */
      useEffect(
        function () {
          if (!folderDrag) return undefined;
          var move = function (event) {
            var list = foldersListRef.current;
            var current = -1;
            for (var index = 0; index < list.length; index += 1) {
              if (list[index].id === folderDrag.id) {
                current = index;
                break;
              }
            }
            if (current < 0) return;

            /* 防抖：指针几乎没动就不重算；换位后冷却一会儿。 */
            if (Math.abs(event.clientY - dragLastY.current) < 4) return;
            var now = Date.now();
            if (now - dragLastSwap.current < 130) return;

            /* 槽位模型：slot = 指针越过了多少行的中线。
               越过 0 行 → 插到最前；越过 n 行 → 插到第 n 行之后。
               向下时 slot 会变大、向上时变小，两个方向用同一套判定。 */
            var slot = 0;
            var lastCrossed = null;
            var firstMid = null;
            for (var probe = 0; probe < list.length; probe += 1) {
              var element = folderRefs.current[list[probe].id];
              if (!element || typeof element.getBoundingClientRect !== "function") continue;
              var rect = element.getBoundingClientRect();
              var mid = rect.top + rect.height / 2;
              if (firstMid === null) firstMid = mid;
              if (event.clientY > mid) {
                slot = probe + 1;
                lastCrossed = mid;
              } else {
                break;
              }
            }

            /* slot 等于「原位」或「原位之后一位」都表示没变化 */
            if (slot === current || slot === current + 1) {
              dragLastY.current = event.clientY;
              return;
            }

            /* 死区：必须离最后越过的中线 14px 以上，避免临界点来回换 */
            var anchor = lastCrossed !== null ? lastCrossed : firstMid;
            if (anchor !== null) {
              var gap = lastCrossed !== null ? event.clientY - anchor : anchor - event.clientY;
              if (gap < 10) {
                dragLastY.current = event.clientY;
                return;
              }
            }

            var target = slot > current ? slot - 1 : slot;
            dragLastSwap.current = now;
            dragLastY.current = event.clientY;
            var next = list.slice();
            var moved = next.splice(current, 1)[0];
            next.splice(target, 0, moved);
            commit({ folders: next });
          };
          var stop = function () {
            dragEndedAt.current = Date.now();
            setFolderDrag(null);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", stop);
          window.addEventListener("pointercancel", stop);
          return function () {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", stop);
            window.removeEventListener("pointercancel", stop);
          };
        },
        [folderDrag, commit]
      );

      var folderRects = useRef({});
      useLayoutEffect(function () {
        animateReorder(folderRefs, folderRects, folderDrag !== null);
      });

      var known = useMemo(
        function () {
          var map = {};
          for (var index = 0; index < scan.items.length; index += 1) {
            map[scan.items[index].name] = scan.items[index];
          }
          return map;
        },
        [scan.items]
      );

      function membersOf(folder) {
        var members = [];
        for (var index = 0; index < folder.items.length; index += 1) {
          var entry = known[folder.items[index]];
          if (entry) members.push(entry);
        }
        return sortMembers(members);
      }

      var assigned = {};
      for (var folderIndex = 0; folderIndex < folders.length; folderIndex += 1) {
        var folderItems = folders[folderIndex].items;
        for (var itemIndex = 0; itemIndex < folderItems.length; itemIndex += 1) {
          assigned[folderItems[itemIndex]] = true;
        }
      }
      var loose = sortMembers(
        scan.items.filter(function (item) {
          return !assigned[item.name];
        })
      );

      function matchItem(item) {
        var needle = query.trim().toLowerCase();
        if (!needle) return true;
        return (
          ((item.title || "") + "\n" + (item.name || "") + "\n" + (item.description || "")).toLowerCase().indexOf(needle) >= 0
        );
      }

      var searching = query.trim().length > 0;
      var visibleFolders = folders.filter(function (folder) {
        return !searching || membersOf(folder).some(matchItem);
      });
      var visibleLoose = loose.filter(matchItem);
      var visibleRecords = records.filter(function (record) {
        if (!searching) return true;
        return (record.title + "\n" + record.name).toLowerCase().indexOf(query.trim().toLowerCase()) >= 0;
      });
      var visibleCount =
        visibleFolders.reduce(function (sum, folder) {
          return sum + membersOf(folder).filter(matchItem).length;
        }, 0) + visibleLoose.length;

      var selectedNames = Object.keys(selected).filter(function (name) {
        return selected[name] === true && known[name] !== undefined;
      });

      // ── 开关与批量 ────────────────────────────────────────────────
      /** 执行一批开关变更；pairs: [{ name, enabled }]，undoFrom 记录操作前的状态。 */
      function applyStates(pairs, undoFrom) {
        var targets = pairs.filter(function (pair) {
          var item = known[pair.name];
          return item && !item.readOnly && !scan.readOnly;
        });
        if (targets.length === 0) return;
        setNotice("");
        setAsk(null);
        var pending = {};
        targets.forEach(function (pair) {
          pending[pair.name] = true;
        });
        setBusy(pending);
        var failures = [];
        var restarts = 0;
        var cursor = 0;
        var step = function () {
          if (cursor >= targets.length) {
            setBusy({});
            setSelected({});
            setReload(function (value) {
              return value + 1;
            });
            var messages = failures.slice(0, 3);
            if (restarts > 0) messages.push(copy.restartHint);
            if (messages.length > 0) {
              setNotice(messages.join("；") + (failures.length > 3 ? "；…" : ""));
            }
            return;
          }
          var pair = targets[cursor];
          cursor += 1;
          callSetEnabled(pair.name, pair.enabled)
            .then(function (result) {
              if (result && result.restart === true) restarts += 1;
            })
            .catch(function (error) {
              failures.push(pair.name + "：" + String((error && error.message) || error));
            })
            .then(step);
        };
        step();
        if (undoFrom) {
          setUndo({
            kind: "toggle",
            names: targets.map(function (pair) {
              return pair.name;
            }),
            from: undoFrom,
            count: targets.length,
          });
        }
      }

      function applyBatch(names, enabled) {
        var from = {};
        names.forEach(function (name) {
          if (known[name]) from[name] = known[name].enabled === true;
        });
        applyStates(
          names.map(function (name) {
            return { name: name, enabled: enabled };
          }),
          from
        );
      }

      function toggleOne(item) {
        if (item.readOnly || scan.readOnly) return;
        applyBatch([item.name], !item.enabled);
      }

      function toggleGroup(members) {
        var targets = members.filter(function (member) {
          return !member.readOnly;
        });
        if (targets.length === 0) return;
        var allOn = targets.every(function (member) {
          return member.enabled === true;
        });
        applyBatch(
          targets.map(function (member) {
            return member.name;
          }),
          !allOn
        );
      }

      function isOpen(groupId) {
        if (query.trim()) return true;
        if (Object.prototype.hasOwnProperty.call(collapsed, groupId)) return collapsed[groupId] === true;
        /* 文件夹默认收起，「未分类」默认展开 */
        return groupId === "__loose";
      }

      function toggleCollapse(groupId) {
        setCollapsed(function (previous) {
          var next = assign({}, previous);
          next[groupId] = previous[groupId] !== true;
          return next;
        });
      }

      /** 卡片上长按 320ms 进入拖动；行内按钮/输入框/开关不触发。 */
      function startFolderPress(folder, event) {
        if (event.button !== undefined && event.button !== 0) return;
        var target = event.target;
        if (
          target &&
          typeof target.closest === "function" &&
          target.closest(".pf-row, .pf-btn, .pf-picker, .pf-switch, .pf-check, input, textarea, button")
        ) {
          return;
        }
        var startX = event.clientX;
        var startY = event.clientY;
        var fired = false;
        var timer = setTimeout(function () {
          fired = true;
          dragLastY.current = startY;
          dragLastSwap.current = 0;
          setFolderDrag({ id: folder.id });
        }, 320);
        var detach = function () {
          clearTimeout(timer);
          window.removeEventListener("pointermove", maybeCancel);
          window.removeEventListener("pointerup", detach);
          window.removeEventListener("pointercancel", detach);
        };
        var maybeCancel = function (moveEvent) {
          if (fired) return;
          if (Math.abs(moveEvent.clientX - startX) > 8 || Math.abs(moveEvent.clientY - startY) > 8) detach();
        };
        window.addEventListener("pointermove", maybeCancel);
        window.addEventListener("pointerup", detach);
        window.addEventListener("pointercancel", detach);
      }

      function toggleSelect(name) {
        setSelected(function (previous) {
          var next = assign({}, previous);
          if (previous[name] === true) delete next[name];
          else next[name] = true;
          return next;
        });
      }

      function selectAllVisible() {
        var next = {};
        visibleFolders.forEach(function (folder) {
          membersOf(folder)
            .filter(matchItem)
            .forEach(function (member) {
              if (!member.readOnly) next[member.name] = true;
            });
        });
        visibleLoose.forEach(function (member) {
          if (!member.readOnly) next[member.name] = true;
        });
        setSelected(next);
      }

      function createFolder() {
        var name = draft.trim();
        if (!name) return;
        commit({ folders: folders.concat([{ id: newId(), name: name, items: [] }]) });
        setDraft("");
        setCreating(false);
      }

      function renameFolder(id) {
        var name = renameDraft.trim();
        if (!name) {
          setRenamingId(null);
          return;
        }
        commit({
          folders: folders.map(function (folder) {
            return folder.id === id ? { id: folder.id, name: name, items: folder.items } : folder;
          }),
        });
        setRenamingId(null);
        setRenameDraft("");
      }

      function deleteFolder(id) {
        commit({
          folders: folders.filter(function (folder) {
            return folder.id !== id;
          }),
        });
        setConfirmId(null);
        if (menu && menu.folderId === id) setMenu(null);
      }

      function currentFolderOf(name) {
        for (var index = 0; index < folders.length; index += 1) {
          if (folders[index].items.indexOf(name) >= 0) return folders[index].id;
        }
        return "";
      }

      /** 移动一批插件到目标分组，并记录操作前的归属供撤销。 */
      function applyMove(names, folderId) {
        if (names.length === 0) return;
        var from = {};
        names.forEach(function (name) {
          from[name] = currentFolderOf(name);
        });
        commit({
          folders: folders.map(function (folder) {
            var kept = folder.items.filter(function (entry) {
              return names.indexOf(entry) < 0;
            });
            if (folder.id === folderId) {
              names.forEach(function (name) {
                if (kept.indexOf(name) < 0) kept.push(name);
              });
            }
            return { id: folder.id, name: folder.name, items: kept };
          }),
        });
        setAsk(null);
        setMenu(null);
        setSelected({});
        setUndo({ kind: "move", names: names.slice(), from: from, count: names.length });
      }

      /** 撤销移动：把每个插件放回它原来的分组（"" 表示未分类）。 */
      function restorePlacement(assignment) {
        var names = Object.keys(assignment);
        commit({
          folders: folders.map(function (folder) {
            var kept = folder.items.filter(function (entry) {
              return assignment[entry] === undefined;
            });
            names.forEach(function (name) {
              if ((assignment[name] || "") === folder.id && kept.indexOf(name) < 0) kept.push(name);
            });
            return { id: folder.id, name: folder.name, items: kept };
          }),
        });
        setUndo(null);
      }

      function undoLast() {
        var action = undo;
        if (!action) return;
        setUndo(null);
        if (action.kind === "toggle") {
          applyStates(
            action.names.map(function (name) {
              return { name: name, enabled: action.from[name] === true };
            }),
            null
          );
          return;
        }
        restorePlacement(action.from);
      }

      /** 卸载一个或多个插件包；成功的会记入「已卸载」以便重新安装。 */
      function applyRemove(names) {
        var manager = getManager();
        if (!manager || typeof manager.removeBundle !== "function") {
          setNotice("remote.pluginManager.removeBundle 不可用");
          setAsk(null);
          return;
        }
        var targets = names.filter(function (name) {
          var item = known[name];
          return name !== SELF && item && !item.readOnly && !scan.readOnly;
        });
        setAsk(null);
        if (targets.length === 0) return;
        setNotice("");
        var pending = {};
        targets.forEach(function (name) {
          pending[name] = true;
        });
        setBusy(pending);
        var failures = [];
        var succeeded = [];
        var cursor = 0;
        var step = function () {
          if (cursor >= targets.length) {
            setBusy({});
            setSelected({});
            setUndo(null);
            commit({
              folders: folders.map(function (folder) {
                return {
                  id: folder.id,
                  name: folder.name,
                  items: folder.items.filter(function (entry) {
                    return targets.indexOf(entry) < 0;
                  }),
                };
              }),
            });
            setReload(function (value) {
              return value + 1;
            });
            if (succeeded.length > 0) rememberRemoved(succeeded);
            if (failures.length > 0) setNotice(failures.join("；"));
            else if (succeeded.length > 0) setNotice(copy.uninstallRecorded);
            return;
          }
          var name = targets[cursor];
          cursor += 1;
          Promise.resolve(manager.removeBundle(name))
            .then(function (result) {
              if (result && typeof result === "object" && result.application === "failed") {
                var code = result.error && result.error.code;
                throw new Error("failed" + (code ? " · " + code : ""));
              }
              succeeded.push(name);
            })
            .catch(function (error) {
              failures.push(name + "：" + String((error && error.message) || error));
            })
            .then(step);
        };
        step();
      }

      /** 把成功的卸载写进记录（含卸载前的安装地址，供重新安装使用）。 */
      function rememberRemoved(names) {
        var added = names.map(function (name) {
          var item = known[name];
          return {
            name: name,
            title: item ? item.title : shortName(name),
            version: item ? item.version : "",
            icon: item ? item.icon : "",
            spec: item && item.installTarget && item.installTarget.spec ? item.installTarget.spec : name,
            at: Date.now(),
          };
        });
        setRecords(function (previous) {
          var kept = previous.filter(function (record) {
            return names.indexOf(record.name) < 0;
          });
          var next = added.concat(kept).slice(0, 60);
          writeRecords(next);
          return next;
        });
      }

      /** 安装结果可能先返回请求号，再等它落定。 */
      function settleInstall(manager, result) {
        var requestId =
          result && typeof result === "object" ? result.installRequestId || result.requestId : undefined;
        if (typeof requestId === "string" && typeof manager.waitForInstall === "function") {
          return Promise.resolve(manager.waitForInstall(requestId)).then(function (settled) {
            return settled === null || settled === undefined ? result : settleInstall(manager, settled);
          });
        }
        if (result && typeof result === "object" && result.application === "failed") {
          var code = result.error && result.error.code;
          throw new Error("failed" + (code ? " · " + code : ""));
        }
        return result;
      }

      function reinstall(record) {
        var manager = getManager();
        if (!manager || typeof manager.installBundle !== "function") {
          setNotice("remote.pluginManager.installBundle 不可用");
          return;
        }
        setNotice("");
        var pending = {};
        pending[record.name] = true;
        setBusy(pending);
        Promise.resolve(manager.installBundle(record.spec || record.name))
          .then(function (result) {
            return settleInstall(manager, result);
          })
          .then(function () {
            setRecords(function (previous) {
              var next = previous.filter(function (entry) {
                return entry.name !== record.name;
              });
              writeRecords(next);
              return next;
            });
            setReload(function (value) {
              return value + 1;
            });
          })
          .catch(function (error) {
            setNotice(record.name + " 重新安装失败：" + String((error && error.message) || error));
          })
          .then(function () {
            setBusy({});
          });
      }

      function forgetRecord(name) {
        setRecords(function (previous) {
          var next = previous.filter(function (record) {
            return record.name !== name;
          });
          writeRecords(next);
          return next;
        });
      }

      function runAsk() {
        if (!ask) return;
        if (ask.kind === "toggle") applyBatch(ask.names, ask.enabled === true);
        else if (ask.kind === "remove") applyRemove(ask.names);
        else applyMove(ask.names, ask.folderId || null);
      }

      function estimateMenuHeight(itemCount) {
        return Math.min(itemCount * 31 + 12, 268);
      }

      /** 统一摆位：下方放不下就翻到上方，并记录方向供箭头与动画使用。 */
      function placeMenu(options, rect) {
        var width = options.width || 200;
        var height = options.height || 200;
        var left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
        var above = rect.bottom + 6 + height > window.innerHeight - 8;
        var top = above ? Math.max(8, rect.top - 6 - height) : rect.bottom + 6;
        return assign({}, options, {
          left: left,
          top: top,
          width: width,
          height: height,
          placement: above ? "up" : "down",
        });
      }

      function openMenu(item, folderId, event) {
        event.stopPropagation();
        if (menu && menu.kind !== "context" && menu.batch !== true && menu.name === item.name) {
          setMenu(null);
          return;
        }
        setMenu(
          placeMenu(
            {
              kind: "folder",
              name: item.name,
              folderId: folderId || "",
              batch: false,
              width: 200,
              height: estimateMenuHeight(1 + Math.max(1, folders.length)),
            },
            event.currentTarget.getBoundingClientRect()
          )
        );
      }

      function openBatchMenu(event) {
        event.stopPropagation();
        if (menu && menu.batch === true) {
          setMenu(null);
          return;
        }
        setMenu(
          placeMenu(
            {
              kind: "folder",
              name: null,
              folderId: "",
              batch: true,
              width: 200,
              height: estimateMenuHeight(1 + Math.max(1, folders.length)),
            },
            event.currentTarget.getBoundingClientRect()
          )
        );
      }

      function openContextMenu(item, event) {
        event.preventDefault();
        event.stopPropagation();
        var width = 188;
        var height = 92;
        setMenu(
          placeMenu(
            { kind: "context", name: item.name, folderId: "", batch: false, width: width, height: height },
            { left: event.clientX, right: event.clientX + width, top: event.clientY, bottom: event.clientY }
          )
        );
      }

      function folderLabel(folderId) {
        if (!folderId) return copy.unclassified;
        for (var index = 0; index < folders.length; index += 1) {
          if (folders[index].id === folderId) return folders[index].name;
        }
        return copy.unclassified;
      }

      function artwork(item) {
        if (item.icon && badIcons[item.name] !== true) {
          return h("img", {
            src: item.icon,
            alt: "",
            draggable: false,
            onError: function () {
              setBadIcons(function (previous) {
                if (previous[item.name] === true) return previous;
                var next = assign({}, previous);
                next[item.name] = true;
                return next;
              });
            },
          });
        }
        return defaultArt();
      }

      function renderRow(item, currentFolderId) {
        var open = menu !== null && menu.kind !== "context" && menu.batch !== true && menu.name === item.name;
        var pending = busy[item.name] === true;
        var locked = item.readOnly || scan.readOnly;
        return h(
          "div",
          {
            key: item.name,
            className: "pf-row",
            title: copy.manageRow,
            onContextMenu: function (event) {
              openContextMenu(item, event);
            },
          },
          h("input", {
            type: "checkbox",
            className: "pf-check",
            checked: selected[item.name] === true,
            disabled: locked,
            "aria-label": item.title,
            onChange: function () {
              toggleSelect(item.name);
            },
          }),
          h("span", { className: "pf-art", "aria-hidden": true }, artwork(item)),
          h(
            "div",
            { className: "pf-main" },
            h(
              "div",
              { className: "pf-title-line" },
              h("span", { className: "pf-title", title: item.name }, item.title),
              item.version ? h("span", { className: "pf-ver" }, "v" + item.version) : null
            ),
            item.description ? h("div", { className: "pf-desc" }, item.description) : null
          ),
          h("button", {
            type: "button",
            className: "pf-switch",
            role: "switch",
            "aria-checked": item.enabled ? "true" : "false",
            disabled: locked || pending,
            title: locked ? copy.readOnly : pending ? copy.busy : item.enabled ? copy.disable : copy.enable,
            "aria-label": (item.enabled ? copy.disable : copy.enable) + " · " + item.title,
            onClick: function () {
              toggleOne(item);
            },
          }),
          h(
            "button",
            {
              type: "button",
              className: "pf-picker",
              "data-open": open ? "true" : "false",
              "data-placement": open ? menu.placement || "down" : "down",
              "aria-haspopup": "menu",
              "aria-expanded": open ? "true" : "false",
              title: copy.moveTo,
              onClick: function (event) {
                openMenu(item, currentFolderId, event);
              },
            },
            h("span", { className: "pf-picker-label" }, folderLabel(currentFolderId)),
            h("span", { className: "pf-picker-caret", "aria-hidden": true }, chevronDown())
          )
        );
      }

      /** 长按拖动刚结束时浏览器还会补一个 click，别让它顺手把分组折叠了。 */
      function guardedToggle(groupId) {
        if (Date.now() - dragEndedAt.current < 400) return;
        toggleCollapse(groupId);
      }

      function renderGroup(groupId, name, members, actions, emptyText, currentFolderId) {
        var open = isOpen(groupId);
        var manageable = members.filter(function (member) {
          return !member.readOnly;
        });
        var allOn =
          manageable.length > 0 &&
          manageable.every(function (member) {
            return member.enabled === true;
          });
        return h(
          "section",
          { key: groupId, className: "pf-card", "data-open": open ? "true" : "false" },
          h(
            "div",
            { className: "pf-card-head" },
            h(
              "button",
              {
                type: "button",
                className: "pf-icon-btn",
                "aria-expanded": open ? "true" : "false",
                title: open ? copy.collapse : copy.expand,
                "aria-label": open ? copy.collapse : copy.expand,
                onClick: function (event) {
                  event.stopPropagation();
                  guardedToggle(groupId);
                },
              },
              h("span", { className: "pf-caret", "aria-hidden": true }, caretIcon())
            ),
            h("span", { className: "pf-folder", "aria-hidden": true }, folderGlyph()),
            h(
              "span",
              {
                className: "pf-card-title",
                title: name,
                onClick: function () {
                  guardedToggle(groupId);
                },
              },
              name
            ),
            h("span", { className: "pf-count" }, members.length + " " + copy.count),
            h("span", { style: { flex: "1 1 auto" } }),
            h("button", {
              type: "button",
              className: "pf-switch pf-switch-sm",
              role: "switch",
              "aria-checked": allOn ? "true" : "false",
              disabled: manageable.length === 0 || scan.readOnly,
              title: allOn ? copy.groupOff : copy.groupOn,
              "aria-label": allOn ? copy.groupOff : copy.groupOn,
              onClick: function (event) {
                event.stopPropagation();
                toggleGroup(members);
              },
            }),
            actions
              ? h(
                  "div",
                  {
                    style: { display: "flex", gap: "2px", alignItems: "center" },
                    onClick: function (event) {
                      event.stopPropagation();
                    },
                  },
                  actions
                )
              : null
          ),
          h(
            "div",
            { className: "pf-card-body" },
            h(
              "div",
              { className: "pf-card-inner" },
              members.length === 0
                ? h("div", { className: "pf-empty" }, emptyText)
                : h(
                    "div",
                    { className: "pf-rows" },
                    members.map(function (member) {
                      return renderRow(member, currentFolderId);
                    })
                  )
            )
          )
        );
      }

      function renderFolder(folder) {
        var members = membersOf(folder).filter(matchItem);
        var renaming = renamingId === folder.id;
        var confirming = confirmId === folder.id;
        var actions = renaming
          ? [
              h("input", {
                key: "input",
                className: "pf-input",
                value: renameDraft,
                autoFocus: true,
                style: { width: "112px", fontSize: "11.5px", padding: "3px 6px" },
                onClick: function (event) {
                  event.stopPropagation();
                },
                onChange: function (event) {
                  setRenameDraft(event.target.value);
                },
                onKeyDown: function (event) {
                  event.stopPropagation();
                  if (event.key === "Enter") renameFolder(folder.id);
                  if (event.key === "Escape") setRenamingId(null);
                },
              }),
              h(
                "button",
                {
                  key: "ok",
                  type: "button",
                  className: "pf-btn-primary",
                  style: { padding: "3px 8px", fontSize: "11.5px" },
                  onClick: function () {
                    renameFolder(folder.id);
                  },
                },
                copy.save
              ),
              h(
                "button",
                {
                  key: "cancel",
                  type: "button",
                  className: "pf-btn",
                  style: { padding: "3px 8px", fontSize: "11.5px" },
                  onClick: function () {
                    setRenamingId(null);
                  },
                },
                copy.cancel
              ),
            ]
          : [
              h(
                "button",
                {
                  key: "rename",
                  type: "button",
                  className: "pf-icon-btn",
                  title: copy.rename,
                  "aria-label": copy.rename,
                  onClick: function () {
                    setRenamingId(folder.id);
                    setRenameDraft(folder.name);
                    setConfirmId(null);
                  },
                },
                pencilIcon()
              ),
              confirming
                ? h(
                    "button",
                    {
                      key: "confirm",
                      type: "button",
                      className: "pf-btn-danger",
                      style: { padding: "3px 8px", fontSize: "11.5px" },
                      onClick: function () {
                        deleteFolder(folder.id);
                      },
                    },
                    copy.confirmRemove
                  )
                : h(
                    "button",
                    {
                      key: "delete",
                      type: "button",
                      className: "pf-icon-btn",
                      title: copy.remove,
                      "aria-label": copy.remove,
                      onClick: function () {
                        setConfirmId(folder.id);
                        setRenamingId(null);
                      },
                    },
                    trashIcon()
                  ),
            ];
        var dragging = folderDrag !== null && folderDrag.id === folder.id;
        return h(
          "div",
          {
            key: folder.id,
            ref: function (element) {
              folderRefs.current[folder.id] = element;
            },
            className: "pf-drag-wrap",
            "data-dragging": dragging ? "true" : "false",
            onPointerDown: function (event) {
              startFolderPress(folder, event);
            },
          },
          renderGroup(folder.id, folder.name, members, actions, copy.emptyFolder, folder.id)
        );
      }

      function renderRecord(record) {
        return h(
          "div",
          { key: record.name, className: "pf-row" },
          h(
            "span",
            { className: "pf-art", "aria-hidden": true },
            record.icon ? h("img", { src: record.icon, alt: "", draggable: false }) : defaultArt()
          ),
          h(
            "div",
            { className: "pf-main" },
            h(
              "div",
              { className: "pf-title-line" },
              h("span", { className: "pf-title", title: record.name }, record.title),
              record.version ? h("span", { className: "pf-ver" }, "v" + record.version) : null
            ),
            h("div", { className: "pf-desc" }, record.spec || record.name)
          ),
          h(
            "button",
            {
              type: "button",
              className: "pf-btn-primary",
              disabled: busy[record.name] === true,
              title: copy.reinstallHint,
              onClick: function () {
                reinstall(record);
              },
            },
            copy.reinstall
          ),
          h(
            "button",
            {
              type: "button",
              className: "pf-btn",
              onClick: function () {
                forgetRecord(record.name);
              },
            },
            copy.removeRecord
          )
        );
      }

      function renderUninstalled() {
        if (records.length === 0 || visibleRecords.length === 0) return null;
        var open = isOpen("__removed");
        return h(
          "section",
          { key: "__removed", className: "pf-card", "data-open": open ? "true" : "false" },
          h(
            "div",
            { className: "pf-card-head" },
            h(
              "button",
              {
                type: "button",
                className: "pf-icon-btn",
                "aria-expanded": open ? "true" : "false",
                title: open ? copy.collapse : copy.expand,
                "aria-label": open ? copy.collapse : copy.expand,
                onClick: function (event) {
                  event.stopPropagation();
                  toggleCollapse("__removed");
                },
              },
              h("span", { className: "pf-caret", "aria-hidden": true }, caretIcon())
            ),
            h(
              "span",
              { className: "pf-folder", style: { color: "var(--dsw-alias-label-secondary)" }, "aria-hidden": true },
              trashIcon()
            ),
            h(
              "span",
              { className: "pf-card-title", title: copy.uninstalled, onClick: function () { toggleCollapse("__removed"); } },
              copy.uninstalled
            ),
            h("span", { className: "pf-count" }, visibleRecords.length + " " + copy.count)
          ),
          h(
            "div",
            { className: "pf-card-body" },
            h("div", { className: "pf-card-inner" }, h("div", { className: "pf-rows" }, visibleRecords.map(renderRecord)))
          )
        );
      }

      function renderMenu() {
        if (!menu) return null;
        var batch = menu.batch === true;
        if (menu.kind === "context") {
          var target = known[menu.name];
          var lockedRow = !target || target.readOnly || scan.readOnly || menu.name === SELF;
          return h(
            "div",
            {
              className: "pf-menu",
              role: "menu",
              "data-placement": menu.placement || "down",
              style: { left: menu.left + "px", top: menu.top + "px", width: menu.width + "px" },
              onClick: function (event) {
                event.stopPropagation();
              },
            },
            h(
              "div",
              { className: "pf-menu-inner" },
              h("div", { className: "pf-menu-title", title: menu.name }, target ? target.title : menu.name),
              h(
                "button",
                {
                  type: "button",
                  className: "pf-option pf-option-danger",
                  role: "menuitem",
                  disabled: lockedRow,
                  title: lockedRow
                    ? menu.name === SELF
                      ? copy.cannotUninstall
                      : copy.readOnly
                    : copy.uninstallHint,
                  onClick: function () {
                    if (lockedRow) return;
                    setMenu(null);
                    setAsk({ kind: "remove", names: [menu.name] });
                  },
                },
                copy.uninstall
              )
            )
          );
        }
        return h(
          "div",
          {
            className: "pf-menu",
            role: "menu",
            "data-placement": menu.placement || "down",
            style: { left: menu.left + "px", top: menu.top + "px", width: menu.width + "px" },
            onClick: function (event) {
              event.stopPropagation();
            },
          },
          h(
            "div",
            { className: "pf-menu-inner" },
            h(
              "button",
              {
                type: "button",
                className: "pf-option",
                role: "menuitem",
                "data-current": !batch && menu.folderId === "" ? "true" : "false",
                onClick: function () {
                  if (batch) {
                    setMenu(null);
                    setAsk({ kind: "move", folderId: "", names: selectedNames.slice() });
                  } else {
                    applyMove([menu.name], null);
                  }
                },
              },
              copy.unclassified
            ),
            folders.length === 0
              ? h("div", { className: "pf-empty", style: { padding: "6px 9px" } }, copy.noFolderYet)
              : folders.map(function (folder) {
                  return h(
                    "button",
                    {
                      key: folder.id,
                      type: "button",
                      className: "pf-option",
                      role: "menuitem",
                      "data-current": !batch && menu.folderId === folder.id ? "true" : "false",
                      onClick: function () {
                        if (batch) {
                          setMenu(null);
                          setAsk({ kind: "move", folderId: folder.id, names: selectedNames.slice() });
                        } else {
                          applyMove([menu.name], folder.id);
                        }
                      },
                    },
                    folder.name
                  );
                })
          )
        );
      }

      function renderBatchBar() {
        if (selectedNames.length === 0) return null;
        var pending = Object.keys(busy).length > 0 || ask !== null;
        return h(
          "div",
          { className: "pf-batch" },
          h("span", { className: "pf-batch-count" }, copy.selected + " " + selectedNames.length + " " + copy.items),
          h(
            "button",
            {
              type: "button",
              className: "pf-btn-primary",
              disabled: pending || scan.readOnly,
              onClick: function () {
                setAsk({ kind: "toggle", enabled: true, names: selectedNames.slice() });
              },
            },
            copy.enable
          ),
          h(
            "button",
            {
              type: "button",
              className: "pf-btn",
              disabled: pending || scan.readOnly,
              onClick: function () {
                setAsk({ kind: "toggle", enabled: false, names: selectedNames.slice() });
              },
            },
            copy.disable
          ),
          h(
            "button",
            {
              type: "button",
              className: "pf-btn",
              title: copy.moveManyTo,
              onClick: openBatchMenu,
            },
            copy.moveManyTo
          ),
          h(
            "button",
            {
              type: "button",
              className: "pf-btn",
              onClick: selectAllVisible,
            },
            copy.selectAll
          ),
          h(
            "button",
            {
              type: "button",
              className: "pf-btn",
              onClick: function () {
                setSelected({});
              },
            },
            copy.clearSelection
          )
        );
      }

      function renderAsk() {
        if (!ask) return null;
        var label;
        if (ask.kind === "toggle") {
          label = (ask.enabled === true ? copy.enable : copy.disable) + " " + ask.names.length + " " + copy.items;
        } else if (ask.kind === "remove") {
          label = copy.uninstallAsk + " " + ask.names.length + " " + copy.items + " · " + copy.uninstallHint;
        } else {
          label =
            copy.moveManyTo + " " + folderLabel(ask.folderId || "") + " · " + ask.names.length + " " + copy.items;
        }
        return h(
          "div",
          { className: "pf-confirm" },
          h("span", { className: "pf-confirm-text" }, copy.confirmAsk + " " + label + "？"),
          h(
            "button",
            {
              type: "button",
              className: ask.kind === "remove" ? "pf-btn-danger" : "pf-btn-primary",
              onClick: runAsk,
            },
            copy.confirmYes
          ),
          h(
            "button",
            {
              type: "button",
              className: "pf-btn",
              onClick: function () {
                setAsk(null);
              },
            },
            copy.cancel
          )
        );
      }

      function renderUndo() {
        if (!undo) return null;
        return h(
          "div",
          { className: "pf-undo" },
          h(
            "span",
            { className: "pf-undo-text" },
            (undo.kind === "toggle" ? copy.undoToggle : copy.undoMove) + " " + undo.count + " " + copy.items
          ),
          h(
            "button",
            {
              type: "button",
              className: "pf-btn",
              disabled: Object.keys(busy).length > 0,
              onClick: undoLast,
            },
            copy.undo
          ),
          h(
            "button",
            {
              type: "button",
              className: "pf-icon-btn",
              title: copy.close,
              "aria-label": copy.close,
              onClick: function () {
                setUndo(null);
              },
            },
            closeIcon()
          )
        );
      }

      var hasTop = selectedNames.length > 0 || ask !== null || undo !== null || notice !== "";

      var body = null;
      if (scan.status === "loading") {
        body = h("div", { className: "pf-empty" }, copy.loading);
      } else if (scan.status === "error") {
        body = h(
          "div",
          { className: "pf-empty", style: { color: "var(--dsw-alias-state-error-primary)" } },
          h("span", null, copy.failed + scan.error),
          h(
            "button",
            {
              type: "button",
              className: "pf-btn",
              onClick: function () {
                setReload(function (value) {
                  return value + 1;
                });
              },
            },
            copy.retry
          )
        );
      } else {
        body = h(
          React.Fragment,
          null,
          visibleFolders.map(renderFolder),
          visibleLoose.length > 0
            ? renderGroup("__loose", copy.unclassified, visibleLoose, null, copy.emptyFolder, null)
            : null,
          renderUninstalled(),
          scan.items.length === 0 ? h("div", { className: "pf-empty" }, copy.empty) : null,
          searching && visibleCount === 0 && visibleRecords.length === 0
            ? h("div", { className: "pf-empty" }, copy.noMatch)
            : null
        );
      }

      return h(
        "div",
        { className: "pf-root" },
        h(
          "div",
          { className: "pf-head" },
          h("div", { className: "pf-head-text" }, h("div", { className: "pf-sub" }, copy.intro)),
          h(
            "div",
            { style: { display: "flex", gap: "6px", alignItems: "center" } },
            creating
              ? [
                  h("input", {
                    key: "draft",
                    className: "pf-input",
                    value: draft,
                    autoFocus: true,
                    placeholder: copy.folderNamePlaceholder,
                    style: { width: "130px" },
                    onChange: function (event) {
                      setDraft(event.target.value);
                    },
                    onKeyDown: function (event) {
                      if (event.key === "Enter") createFolder();
                      if (event.key === "Escape") {
                        setCreating(false);
                        setDraft("");
                      }
                    },
                  }),
                  h(
                    "button",
                    {
                      key: "create",
                      type: "button",
                      className: "pf-btn-primary",
                      onClick: createFolder,
                    },
                    copy.create
                  ),
                  h(
                    "button",
                    {
                      key: "cancel",
                      type: "button",
                      className: "pf-btn",
                      onClick: function () {
                        setCreating(false);
                        setDraft("");
                      },
                    },
                    copy.cancel
                  ),
                ]
              : h(
                  "button",
                  {
                    type: "button",
                    className: "pf-btn-primary",
                    onClick: function () {
                      setCreating(true);
                      setDraft("");
                    },
                  },
                  copy.newFolder
                )
          )
        ),
        h(
          "div",
          { className: "pf-search" },
          h("input", {
            className: "pf-input pf-search-input",
            type: "search",
            value: query,
            placeholder: copy.searchPlaceholder,
            "aria-label": copy.searchPlaceholder,
            onChange: function (event) {
              setQuery(event.target.value);
            },
            onKeyDown: function (event) {
              if (event.key === "Escape") setQuery("");
            },
          }),
          searching
            ? h(
                "button",
                {
                  type: "button",
                  className: "pf-icon-btn",
                  title: copy.clearSearch,
                  "aria-label": copy.clearSearch,
                  onClick: function () {
                    setQuery("");
                  },
                },
                closeIcon()
              )
            : null
        ),
        hasTop
          ? h(
              "div",
              { className: "pf-topbar" },
              renderBatchBar(),
              renderAsk(),
              renderUndo(),
              notice ? h("div", { className: "pf-notice" }, notice) : null
            )
          : null,
        body,
        renderMenu()
      );
    }

    // ── 浮动入口 + 抽屉 ──────────────────────────────────────────────
    function PluginsFoldersLauncher() {
      var copy = text();
      var openState = useState(false);
      var open = openState[0];
      var setOpen = openState[1];

      useEffect(
        function () {
          if (!open) return undefined;
          var onKey = function (event) {
            if (event.key === "Escape") setOpen(false);
          };
          document.addEventListener("keydown", onKey, true);
          return function () {
            document.removeEventListener("keydown", onKey, true);
          };
        },
        [open]
      );

      if (!open) {
        return h(
          "button",
          {
            type: "button",
            className: "pf-launcher",
            title: copy.launcher,
            "aria-haspopup": "dialog",
            "aria-expanded": "false",
            onClick: function () {
              setOpen(true);
            },
          },
          h("span", { style: { display: "inline-flex" }, "aria-hidden": true }, folderGlyph()),
          h("span", null, copy.launcher)
        );
      }

      return h(
        React.Fragment,
        null,
        h("div", {
          className: "pf-mask",
          onClick: function () {
            setOpen(false);
          },
        }),
        h(
          "aside",
          { className: "pf-drawer", role: "dialog", "aria-modal": "true", "aria-label": copy.title },
          h(
            "div",
            { className: "pf-drawer-head" },
            h("span", { style: { display: "inline-flex" }, "aria-hidden": true }, folderGlyph()),
            h("span", { className: "pf-drawer-title" }, copy.title),
            h(
              "button",
              {
                type: "button",
                className: "pf-icon-btn",
                title: copy.close,
                "aria-label": copy.close,
                onClick: function () {
                  setOpen(false);
                },
              },
              closeIcon()
            )
          ),
          h("div", { className: "pf-drawer-body" }, h(FoldersPanel, null))
        )
      );
    }

    function LauncherSafe() {
      return h(ErrorBoundary, null, h(PluginsFoldersLauncher, null));
    }

    // ── 插件主体 ───────────────────────────────────────────────────────
    /**
     * Cordis 的受限 ctx 按“点路径”声明依赖：宿主自己的插件写的是
     * ["slots","locale","remote","remote.pluginManager", …]。
     * 只写 "remote" 不够——访问 remote.pluginManager 前必须把这条路径列进来。
     */
    var inject = ["slots", "locale", "remote", "remote.pluginManager"];

    function apply(ctx) {
      ctxRef = ctx;

      // 样式注入 head：组件内 <style> 在隔离容器里可能失效
      try {
        ctx.effect(function () {
          var tag = document.createElement("style");
          tag.setAttribute("data-dsh-plugins-folders", "");
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return function () {
            try {
              tag.remove();
            } catch (error) {
              /* 卸载时标签可能已被移除 */
            }
          };
        }, "dsh-plugins-folders: styles");
      } catch (error) {
        if (ctx.logger && ctx.logger.warn) {
          ctx.logger.warn("dsh-plugins-folders: 样式注入失败", error);
        }
      }

      try {
        ctx.effect(function () {
          var disposers = [];
          var attempts = 0;
          var timer = setInterval(function () {
            attempts += 1;
            if (attempts > 40) {
              clearInterval(timer);
              if (ctx.logger && ctx.logger.warn) {
                ctx.logger.warn("dsh-plugins-folders: 等待 slots 服务超时，本次未注册入口");
              }
              return;
            }
            try {
              var slots = ctx.get("slots");
              if (!slots || typeof slots.inject !== "function") return;
              disposers.push(
                slots.inject("shell.overlay", function () {
                  return slots.register(
                    {
                      name: "shell.overlay",
                      id: "plugins-folders",
                      order: 20,
                    },
                    LauncherSafe
                  );
                })
              );
              clearInterval(timer);
            } catch (error) {
              if (ctx.logger && ctx.logger.warn) {
                ctx.logger.warn("dsh-plugins-folders: 浮动入口注册失败", error);
              }
            }
          }, 300);
          return function () {
            clearInterval(timer);
            disposers.forEach(function (fn) {
              try {
                if (typeof fn === "function") fn();
              } catch (error) {
                /* 卸载顺序由框架决定，重复释放直接忽略 */
              }
            });
          };
        }, "dsh-plugins-folders: shell.overlay");
      } catch (error) {
        if (ctx.logger && ctx.logger.warn) {
          ctx.logger.warn("dsh-plugins-folders: client boot failed", error);
        }
      }
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
