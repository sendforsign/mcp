#!/usr/bin/env node
/*
 * Launcher that prefers compiled JS, falls back to TS via tsx when not built.
 * Ensures the package works even when published without prebuild.
 */
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const cwd = process.cwd();
const pkgRoot = __dirname ? join(__dirname, '..') : process.cwd();

const distEntry = join(pkgRoot, 'dist', 'index.js');
const tsEntry = join(pkgRoot, 'src', 'index.ts');

/**
 * Inherit stdio so MCP stdio transport works.
 */
function run(command, args) {
  const child = spawn(command, args, { stdio: 'inherit', cwd });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code == null ? 1 : code);
  });
  child.on('error', (err) => {
    console.error('[sendforsign-mcp] failed to start', err);
    process.exit(1);
  });
}

if (existsSync(distEntry)) {
  run(process.execPath, [distEntry]);
} else if (existsSync(tsEntry)) {
  // Use local dependency tsx (declared in dependencies) to run TS directly
  const tsxBin = join(pkgRoot, 'node_modules', '.bin', 'tsx');
  const tsxCmd = process.platform === 'win32' ? `${tsxBin}.cmd` : tsxBin;
  run(tsxCmd, [tsEntry]);
} else {
  console.error('[sendforsign-mcp] entry not found: dist/index.js or src/index.ts');
  process.exit(1);
}


