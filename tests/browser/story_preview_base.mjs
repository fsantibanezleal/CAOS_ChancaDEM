// Real Chromium regression for the shared story checker at Pages mount paths.
// Run from the repository with CAOS_TEMP_ROOT set, using node --test on this file.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const frontend = join(repository, 'frontend');
const { servePages } = createRequire(join(frontend, 'package.json'))('@fasl-work/caos-app-shell/serve');
const execute = promisify(execFile);
const routes = ['/story/first', '/story/second', '/story/third'];

async function checkPreview(basePath, suppliedOrigin = false, failBrowserLaunch = false) {
  assert.ok(process.env.CAOS_TEMP_ROOT, 'set the external CAOS_TEMP_ROOT before running browser checks');
  const temporaryParent = resolve(process.env.CAOS_TEMP_ROOT);
  mkdirSync(temporaryParent, { recursive: true });
  const root = mkdtempSync(join(temporaryParent, 'story-preview-'));
  let server;
  try {
    const scripts = join(root, 'frontend/scripts');
    mkdirSync(scripts, { recursive: true });
    symlinkSync(join(frontend, 'node_modules'), join(root, 'frontend/node_modules'), 'junction');
    writeFileSync(join(root, 'product.json'), JSON.stringify({ showcase: { story_routes: routes } }));
    writeFileSync(join(root, 'frontend/package.json'), '{"type":"module"}\n');
    for (const name of ['check_story_mode.mjs', 'serve.mjs']) cpSync(join(frontend, 'scripts', name), join(scripts, name));
    const html = `<!doctype html><html lang="en"><body>
      <main data-story><nav>${routes.map((route, index) => `<a data-story-link href="${basePath}${route.slice(1)}"><span class="caos-story-step-number">${index + 1}</span></a>`).join('')}</nav>
      <div class="caos-story-controls"><button aria-pressed="false">Play</button></div>
      <a class="caos-story-exit" href="${basePath}app?case=fixture">Exit</a></main>
      <script>
        const route = path => path.endsWith('/') ? path.slice(0, -1) : path;
        for (const link of document.querySelectorAll('[data-story-link]')) {
          if (route(new URL(link.href).pathname) === route(location.pathname)) link.setAttribute('aria-current', 'step');
        }
        const play = document.querySelector('button');
        play.addEventListener('click', () => play.setAttribute('aria-pressed', String(play.getAttribute('aria-pressed') !== 'true')));
      </script></body></html>`;
    const dist = join(root, 'frontend/dist');
    for (const route of ['', '/app', ...routes]) {
      const directory = join(dist, route);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, 'index.html'), html);
    }
    if (suppliedOrigin) server = await servePages(dist, basePath);
    const args = [join(scripts, 'check_story_mode.mjs'), ...(server ? [server.url] : [])];
    const execution = execute(process.execPath, args, {
      cwd: root,
      env: {
        ...process.env,
        VITE_BASE: suppliedOrigin ? '/a-different-local-mount/' : basePath,
        ...(failBrowserLaunch ? { PLAYWRIGHT_BROWSERS_PATH: join(root, 'no-browser-installed') } : {}),
      },
      timeout: 40_000,
      windowsHide: true,
    });
    if (failBrowserLaunch) {
      await assert.rejects(execution, (error) => {
        assert.match(error.stderr, /Executable doesn't exist/);
        assert.equal(error.killed, false, 'a failed launch closes the owned server and lets the process exit');
        return true;
      });
      return;
    }
    const result = await execution;
    assert.match(result.stdout, /check_story_mode: 3 declared story steps/);
    assert.equal(result.stderr, '');
  } finally {
    await server?.close();
    assert.ok(root.startsWith(temporaryParent + sep), 'cleanup stays inside the external test root');
    rmSync(root, { recursive: true, force: true });
  }
}

test('the story smoke checks a root preview', { timeout: 45_000 }, async () => {
  await checkPreview('/');
});

test('adversarial: the story smoke checks Pages subpaths and nested mounts', { timeout: 90_000 }, async () => {
  await checkPreview('/product-preview/');
  await checkPreview('/group/product-preview/');
});

test('adversarial: a supplied origin takes precedence over the local preview mount', { timeout: 45_000 }, async () => {
  await checkPreview('/external-preview/', true);
});

test('adversarial: a failed Chromium launch closes the owned preview', { timeout: 45_000 }, async () => {
  await checkPreview('/failed-launch/', false, true);
});
