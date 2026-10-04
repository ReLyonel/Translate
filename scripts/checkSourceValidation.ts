import fs from 'node:fs/promises';
import path from 'node:path';
import { FoundryValidator } from '../src/services/validation/foundryValidator';
import { JsonEngine } from '../src/services/json/jsonEngine';
import { ProtectedContentEngine } from '../src/services/protected-content/protectedContentEngine';
const report = JSON.parse(await fs.readFile('reports/module-validation/copy-report.json','utf8'));
for (const error of report.errors) {
  const name = error.split(': no traducido')[0];
  const original = JSON.parse(await fs.readFile(path.join(process.argv[2],name),'utf8'));
  const result = FoundryValidator.validate(original,original,{translatedCount:0,confirmedTermsCount:0,reviewedTermsCount:0,uncertainTermsCount:0});
  console.log(JSON.stringify({name, originalValid:result.isValid, issues:Object.fromEntries(Object.entries(result).filter(([key,value])=>Array.isArray(value) && value.length))}));
  const changes = JsonEngine.analyze(original).fields.filter(field=>field.classification==='TRANSLATABLE').map(field=>{ const protectedValue=ProtectedContentEngine.protect(field.originalValue); const restored=ProtectedContentEngine.restore(protectedValue.protectedText,protectedValue.tokens); if(!restored.isValid) console.log(JSON.stringify({path:field.path,errors:restored.errors})); return {path:field.path,value:restored.restoredText}; });
  const rebuilt=JsonEngine.reconstruct(original,changes); const validation=FoundryValidator.validate(original,rebuilt,{translatedCount:changes.length,confirmedTermsCount:0,reviewedTermsCount:0,uncertainTermsCount:0});
  console.log(JSON.stringify({unchanged:JSON.stringify(original)===JSON.stringify(rebuilt), issues:Object.fromEntries(Object.entries(validation).filter(([key,value])=>Array.isArray(value)&&value.length))}));
}
