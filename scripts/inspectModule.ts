import fs from 'node:fs/promises';
import path from 'node:path';
import { discoverModule } from '../desktop/moduleDiscovery';
import { inspectScript } from '../desktop/scriptTranslation';
const input = await fs.realpath(process.argv[2]);
const discovery = await discoverModule(input);
const scripts = [];
for (const file of discovery.files.filter(file => file.kind === 'script')) {
  try { scripts.push({file:file.relative, texts:inspectScript(await fs.readFile(file.absolute,'utf8')).length}); }
  catch { scripts.push({file:file.relative, error:'Unsupported syntax'}); }
}
let bytes = 0; for (const file of discovery.files) bytes += (await fs.stat(file.absolute)).size;
const report = {files:discovery.files.length, bytes, sourceJson:discovery.files.filter(file=>file.kind==='json').length, scripts};
await fs.mkdir('reports/module-validation',{recursive:true}); await fs.writeFile(path.resolve('reports/module-validation/discovery.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
