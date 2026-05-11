#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const nextDir = path.join(projectRoot, '.next');

function runCommand(command, args, { failureMessage }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    child.on('exit', (code, signal) => {
      if (signal || code !== 0) {
        console.error(`\n${failureMessage}`);
        if (signal) console.error(`Stopped by signal ${signal}.`);
        process.exit(code ?? 1);
      }

      resolve();
    });

    child.on('error', (error) => {
      console.error(`\n${failureMessage}`);
      console.error(error);
      process.exit(1);
    });
  });
}

async function cleanNextCache() {
  console.log('Cleaning .next before build...');

  if (process.platform === 'win32') {
    await runCommand('cmd', ['/c', 'rmdir', '/s', '/q', nextDir], {
      failureMessage: 'Failed to remove .next cache before build.',
    });
  } else {
    await runCommand('rm', ['-rf', nextDir], {
      failureMessage: 'Failed to remove .next cache before build.',
    });
  }

  try {
    await access(nextDir);
    console.error('\n.next still exists after cleanup.');
    console.error('Close any running `next dev` or `next build` process, then retry.');
    process.exit(1);
  } catch (error) {
    // Expected: .next does not exist after cleanup.
  }
}

function runBuild() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCommand, ['run', 'build'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? '1',
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`\nBuild stopped by signal ${signal}.`);
      process.exit(1);
    }

    process.exit(code ?? 1);
  });

  child.on('error', (error) => {
    console.error('\nFailed to start build.');
    console.error(error);
    process.exit(1);
  });
}

await cleanNextCache();
runBuild();
