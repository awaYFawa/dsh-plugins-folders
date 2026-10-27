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

import { spawn } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 一键重启的两条本地路由（同源，只在 127.0.0.1 的 GUI 上可达）。 */
const RESTART_PATH = '/plugins-folders/restart';
const PING_PATH = '/plugins-folders/ping';
/** 默认留 4 秒：让 202 响应先回到浏览器、界面切到“重启中”。 */
const RESTART_DELAY_SECONDS = 4;
/** 打包目录里随包分发的重启脚本。 */
const RESTART_SCRIPT = fileURLToPath(new URL('./restart.ps1', import.meta.url));
/** 找不到进程可执行文件时的兜底（本机安装位置）。 */
const FALLBACK_EXE = 'D:\\Users\\YF\\AppData\\Local\\Programs\\DeepSeek Harness\\DeepSeek Harness.exe';

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

// ── 一键重启的宿主侧 ────────────────────────────────────────────────
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  try {
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(body),
    });
    res.end(body);
  } catch (error) {
    /* 客户端已经断开 */
  }
}

/**
 * 宿主插件跑在 Harness 自己的进程里，`process.execPath` 就是 Harness 的可执行文件。
 * 在纯 `node` 下跑（web profile）时它指向 node.exe，那种情况用本机兜底路径。
 */
function resolveLauncherExe() {
  const current = typeof process.execPath === 'string' ? process.execPath : '';
  if (current && !/[\\/]node(\.exe)?$/i.test(current) && existsSync(current)) return current;
  return existsSync(FALLBACK_EXE) ? FALLBACK_EXE : '';
}

/** 拉起子进程时的诊断日志（排查“点了没反应”用），写在临时目录。 */
export function spawnLogPath() {
  return join(process.env.TEMP || process.env.TMP || '.', 'dsh-plugins-folders-spawn.log');
}

/** @param {string} message */
function spawnLog(message) {
  try {
    appendFileSync(spawnLogPath(), `${new Date().toISOString()} ${message}\n`);
  } catch {
    /* 诊断日志写不进去不影响重启 */
  }
}

/** 起一个脱离当前进程的 PowerShell，由它稍后关掉 Harness 再重新拉起。 */
function armRestart(delaySeconds) {
  if (!existsSync(RESTART_SCRIPT)) throw new Error(`缺少重启脚本：${RESTART_SCRIPT}`);
  const exe = resolveLauncherExe();
  const args = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    RESTART_SCRIPT,
    '-DelaySeconds',
    String(delaySeconds),
  ];
  if (exe) args.push('-Exe', exe);
  // 实测（Windows + Electron 主进程里 spawn）：
  //  1) `detached: true` 会让 powershell 立刻退出，脚本第一行都不执行；
  //  2) `stdio: 'ignore'`（NUL 句柄、没有控制台）同样起不来；
  //  3) 直接 spawn powershell 虽然能跑，但 Harness 一退出它也跟着没了。
  // 可行组合：让 `cmd /c start /min` 另起一个自带控制台的 powershell，cmd 立刻退出，
  // 于是这个 powershell 与 Harness 没有依赖关系，Harness 关掉后它照样把新实例拉起来。
  const child = spawn('cmd.exe', ['/c', 'start', '', '/min', 'powershell.exe', ...args], {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    detached: false,
    stdio: 'pipe',
    windowsHide: true,
  });
  spawnLog(`spawn powershell pid=${child.pid} args=${args.join(' ')}`);
  child.on('error', (error) => spawnLog(`spawn error: ${error.message}`));
  child.on('exit', (code, signal) => spawnLog(`child exit code=${code} signal=${signal}`));
  if (child.stdout) child.stdout.on('data', (chunk) => spawnLog(`out: ${String(chunk).slice(0, 300)}`));
  if (child.stderr) child.stderr.on('data', (chunk) => spawnLog(`err: ${String(chunk).slice(0, 300)}`));
  child.unref();
  if (typeof child.stdout?.unref === 'function') child.stdout.unref();
  if (typeof child.stderr?.unref === 'function') child.stderr.unref();
  return { pid: child.pid, exe, script: RESTART_SCRIPT };
}

function readDelay(rawUrl) {
  try {
    const query = new URL(String(rawUrl || ''), 'http://127.0.0.1').searchParams;
    const value = Number(query.get('delay'));
    if (!Number.isFinite(value)) return RESTART_DELAY_SECONDS;
    return Math.min(30, Math.max(2, Math.round(value)));
  } catch (error) {
    return RESTART_DELAY_SECONDS;
  }
}

/**
 * @param {any} ctx
 */
export function apply(ctx) {
  const state = { payload: null };

  // 诊断：宿主这半边到底有没有起来、webServer 在不在、路由注册成没成。
  try {
    const ws = ctx.get('webServer');
    const origin = ws && typeof ws.getOrigin === 'function' ? String(ws.getOrigin()) : '(no getOrigin)';
    spawnLog(
      `host-apply pid=${process.pid} webServer=${ws ? typeof ws : 'missing'} canRegister=${
        ws && typeof ws.register === 'function'
      } origin=${origin}`
    );
  } catch (error) {
    spawnLog(`host-apply probe failed: ${String((error && error.message) || error)}`);
  }

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

  // webServer 可能在插件 apply 之后才就绪。开机那一次就是这样：只 get 一次拿到 undefined，
  // 三条路由全部没注册，界面上点按钮就像没反应。改用 ctx.inject 等服务出现再注册。
  const describeError = (error) => String((error && error.message) || error || 'unknown');

  try {
    ctx.inject(['webServer'], (scope) => {
      const webServer = scope.get('webServer');
      spawnLog(`host-inject webServer ready pid=${process.pid}`);

      try {
        if (webServer && typeof webServer.tapIndex === 'function') {
          scope.effect(
            () => webServer.tapIndex((html) => injectSnapshot(html, state.payload)),
            'plugins-folders: index snapshot'
          );
        }
      } catch (error) {
        spawnLog(`host-inject index tap threw: ${describeError(error)}`);
      }

      // 一键重启：三条同源路由。各自 try，一条失败不影响其余。
      const disposers = [];

      const routes = [
        {
          path: PING_PATH,
          handler: (req, res) => {
            req.resume();
            sendJson(res, 200, { ok: true, pid: process.pid, at: Date.now() });
          },
        },
        {
          path: RESTART_PATH,
          handler: (req, res) => {
            req.resume();
            if (req.method !== 'POST') {
              res.setHeader('allow', 'POST');
              sendJson(res, 405, { ok: false, error: 'method not allowed' });
              return;
            }
            const delay = readDelay(req.url);
            let armed = null;
            try {
              armed = armRestart(delay);
            } catch (error) {
              sendJson(res, 500, {
                ok: false,
                error: String((error && error.message) || error || 'restart failed'),
              });
              return;
            }
            sendJson(res, 202, {
              ok: true,
              delay,
              pid: process.pid,
              launcher: armed.pid,
              exe: armed.exe || null,
            });
          },
        },
      ];

      for (const route of routes) {
        try {
          disposers.push(webServer.register({ kind: 'exact', path: route.path, handler: route.handler }));
        } catch (error) {
          spawnLog(`host-inject register ${route.path} threw: ${describeError(error)}`);
        }
      }
      spawnLog(`host-inject routes registered count=${disposers.length}`);

      scope.effect(
        () => () => {
          for (const dispose of disposers) {
            try {
              dispose();
            } catch (error) {
              /* 卸载阶段路由可能已经没了 */
            }
          }
        },
        'plugins-folders: restart routes'
      );
    });
    spawnLog('host-apply webServer inject scheduled');
  } catch (error) {
    spawnLog(`host-apply inject threw: ${describeError(error)}`);
  }
}
