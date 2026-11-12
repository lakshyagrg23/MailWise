import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Each case runs assertEnv() in a fresh process with ONLY the given variables (and no .env file),
// because config/env.js reads the environment once at import.
const run = (vars) =>
    spawnSync(
        process.execPath,
        ['--input-type=module', '-e', "import { assertEnv } from './config/env.js'; assertEnv(); console.log('boot-ok')"],
        {
            cwd: serverDir,
            encoding: 'utf8',
            env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, DOTENV_CONFIG_PATH: '/nonexistent.env', ...vars },
        }
    );

const good = {
    SESSION_SECRET: 'a'.repeat(20),
    DATABASE_URL: 'postgresql://x:x@localhost:1/x',
    FRONTEND_URL: 'http://localhost:3000',
};

test('refuses to boot and lists everything missing at once', () => {
    const r = run({});
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /SESSION_SECRET/);
    assert.match(r.stderr, /DATABASE_URL/);
    assert.match(r.stderr, /FRONTEND_URL/);
});

test('rejects a short SESSION_SECRET', () => {
    const r = run({ ...good, SESSION_SECRET: 'short' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /SESSION_SECRET/);
});

test('boots with only the required variables, warning about Google and Gemini', () => {
    const r = run(good);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /boot-ok/);
    assert.match(r.stderr, /GOOGLE_CLIENT_ID/);
    assert.match(r.stderr, /GEMINI_API_KEY/);
});

test('is silent when everything is configured', () => {
    const r = run({
        ...good,
        GOOGLE_CLIENT_ID: 'a', GOOGLE_CLIENT_SECRET: 'b', GOOGLE_REDIRECT_URI: 'c', GEMINI_API_KEY: 'd',
    });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr.trim(), '');
});
