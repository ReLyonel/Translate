import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const executable = require('electron') as string;
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const child = spawn(executable, ['.', ...process.argv.slice(2)], { env: environment, stdio: 'inherit' });
child.on('error', () => { console.error('No se pudo iniciar Electron. Ejecuta node node_modules/electron/install.js.'); process.exit(1); });
child.on('exit', code => process.exit(code || 0));
