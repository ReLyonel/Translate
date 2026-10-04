import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { discoverModule } from '../desktop/moduleDiscovery';
import { runBatch } from '../desktop/jobs';
const root = await fs.realpath(process.argv[2]);
const discovered = await discoverModule(root);
async function hashes() {
  const result: Record<string,string> = {};
  for (const file of discovered.files) result[file.relative] = createHash('sha256').update(await fs.readFile(file.absolute)).digest('hex');
  return result;
}
const originals = await hashes();
const output = path.resolve('reports/module-validation/copy-' + Date.now()); await fs.mkdir(path.dirname(output),{recursive:true});
let last = -1;
// Deterministic identity provider verifies traversal/copy and validation without thousands of inference calls.
const result = await runBatch(root,output,async request => request.texts,new AbortController().signal,progress => { const count = Math.floor(progress.completed / 500); if (count !== last) { last = count; console.log(`${progress.completed}/${progress.total}; fallos=${progress.failed}`); } },'auto',undefined,'module');
const copy = await discoverModule(output);
const originalsUnchanged = JSON.stringify(originals) === JSON.stringify(await hashes());
let unchangedResources = 0;
for (const file of copy.files.filter(file=>!file.kind)) if (createHash('sha256').update(await fs.readFile(file.absolute)).digest('hex') === originals[file.relative]) unchangedResources++;
const report = {...result, provider:'deterministic identity (not a linguistic translation)', originalsUnchanged, inputFiles:discovered.files.length, outputFiles:copy.files.length, unchangedResources, resources:discovered.files.filter(file=>!file.kind).length, output};
await fs.writeFile(path.resolve('reports/module-validation/copy-report.json'),JSON.stringify(report,null,2)); console.log(JSON.stringify(report));
if (!originalsUnchanged || report.inputFiles !== report.outputFiles || report.resources !== unchangedResources) process.exitCode = 1;
