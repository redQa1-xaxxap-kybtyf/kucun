import { spawn } from 'child_process';
import path from 'path';

const modeArg = (process.argv[2] || '').toLowerCase();
const isProd =
  modeArg === 'prod' ||
  modeArg === 'production' ||
  process.env.NODE_ENV === 'production';
const npmCli =
  process.env.npm_execpath ||
  path.join(process.cwd(), 'node_modules', 'npm', 'bin', 'npm-cli.js');

const mainProcessScript = isProd ? 'start' : 'dev';
const schedulerScript = 'scheduler:start';

interface ManagedProcess {
  name: string;
  proc: ReturnType<typeof spawn>;
}

function spawnScript(script: string, name = script): ManagedProcess {
  const child = spawn(process.execPath, [npmCli, 'run', script], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', code => {
    console.log(`\n[${name}] exited with code ${code ?? 0}`);
    shutdown(code ?? 0, name);
  });

  child.on('error', error => {
    console.error(`Failed to start ${name}:`, error);
    shutdown(1, name);
  });

  return { name, proc: child };
}

const children: ManagedProcess[] = [
  spawnScript(mainProcessScript, isProd ? 'next:start' : 'next:dev'),
  spawnScript(schedulerScript, 'shipping-scheduler'),
];

function shutdown(exitCode: number, reason?: string) {
  for (const child of children) {
    if (!child.proc.killed) {
      child.proc.kill('SIGTERM');
    }
  }

  if (reason) {
    console.log(`\nShutting down due to ${reason}.`);
  }

  process.exit(exitCode);
}

(['SIGINT', 'SIGTERM'] as NodeJS.Signals[]).forEach(signal => {
  process.on(signal, () => {
    console.log(`\nReceived ${signal}, stopping processes...`);
    shutdown(0, signal);
  });
});
