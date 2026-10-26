/**
 * Host half of the plugins-folders bundle.
 *
 * The grouping UI lives in the browser, but the inventory of installed bundles does not
 * always reach a third-party Client module (a non-host consumer can be refused by the
 * Client Remote namespace). So this half takes snapshots of the bundle inventory through
 * the Host service and embeds the latest one into the served index HTML as
 * `window.__DSH_PLUGINS_FOLDERS__`. The Client prefers the live Remote call and falls
 * back to this snapshot.
 *
 * Every step is defensive: the plugin exists to add one tab, so a missing service or a
 * failing inventory read must never keep the Host row from activating.
 */

/** @param {unknown[]} bundles */
function summarize(bundles) {
  const list = Array.isArray(bundles) ? bundles : [];
  const packages = [];
  for (const bundle of list) {
    if (!bundle || typeof bundle.name !== 'string') continue;
    if (bundle.installed === false) continue;
    const rows = Array.isArray(bundle.rows) ? bundle.rows : [];
    let enabled = bundle.enabled === true;
    if (!enabled) {
      for (const row of rows) {
        if (row && row.enabled === true) {
          enabled = true;
          break;
        }
      }
    }
    packages.push({
      name: bundle.name,
      meta: {
        title: bundle.meta && bundle.meta.title !== undefined ? bundle.meta.title : undefined,
        description:
          bundle.meta && bundle.meta.description !== undefined
            ? bundle.meta.description
            : typeof bundle.description === 'string'
              ? bundle.description
              : undefined,
        icon: bundle.meta && typeof bundle.meta.icon === 'string' ? bundle.meta.icon : undefined,
      },
      version: typeof bundle.version === 'string' ? bundle.version : '',
      enabled,
    });
  }
  packages.sort((left, right) => {
    const a = String(typeof left.meta.title === 'string' ? left.meta.title : left.name);
    const b = String(typeof right.meta.title === 'string' ? right.meta.title : right.name);
    return a.localeCompare(b);
  });
  return packages;
}

function injectSnapshot(html, payload) {
  if (!payload || typeof html !== 'string') return html;
  const json = JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  const tag = `<script>window.__DSH_PLUGINS_FOLDERS__=${json};</script>`;
  const at = html.lastIndexOf('</head>');
  return at >= 0 ? html.slice(0, at) + tag + html.slice(at) : tag + html;
}

/**
 * @param {any} ctx
 */
export function apply(ctx) {
  const state = { payload: null };

  const refresh = () => {
    const manager = ctx.get('pluginManager');
    if (!manager || typeof manager.listBundles !== 'function') return;
    Promise.resolve()
      .then(() => manager.listBundles())
      .then((bundles) => {
        state.payload = { at: Date.now(), packages: summarize(bundles) };
      })
      .catch((error) => {
        state.payload = {
          at: Date.now(),
          packages: [],
          error: String((error && error.message) || error || 'listBundles failed'),
        };
      });
  };

  try {
    refresh();
  } catch (error) {
    /* 清单读不到不影响页签本身 */
  }

  try {
    ctx.effect(() => ctx.on('plugin-manager/changed', refresh), 'plugins-folders: refresh on change');
  } catch (error) {
    /* 事件名在未来版本可能不同 */
  }

  try {
    const webServer = ctx.get('webServer');
    if (webServer && typeof webServer.tapIndex === 'function') {
      ctx.effect(
        () => webServer.tapIndex((html) => injectSnapshot(html, state.payload)),
        'plugins-folders: index snapshot'
      );
    }
  } catch (error) {
    /* 没有 HTTP 渲染入口时只保留 Client 侧通路 */
  }
}
