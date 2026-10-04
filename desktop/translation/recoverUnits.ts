import { ProtectedContentEngine as Protection } from '../../src/services/protected-content/protectedContentEngine';
import type { TranslateRequest, RecoveryDiagnostic } from '../contracts';

export async function recoverUnits(texts:string[],translate:(request:TranslateRequest)=>Promise<string[]>,signal:AbortSignal,language:TranslateRequest['sourceLanguage'],onFailure:(index:number,reason:RecoveryDiagnostic['reason'])=>void,contexts?:NonNullable<TranslateRequest['units']>[number]['context'][]) {
  const protectedValues=texts.map(text=>Protection.protect(text));
  let responses:string[];
  try {
    signal.throwIfAborted();responses=await translate({sourceLanguage:language,texts:protectedValues.map(value=>value.protectedText),onUnitFailure:onFailure,units:texts.map((sourceText,index)=>({sourceText,context:contexts?.[index]}))});signal.throwIfAborted();
    if(!Array.isArray(responses)||responses.length!==texts.length)throw new Error('RESPONSE_COUNT');
  }catch(error) {
    signal.throwIfAborted();
    // Persistence/disk failures are job failures, never provider recovery.
    if((error as NodeJS.ErrnoException)?.code)throw error;
    texts.forEach((_,index)=>onFailure(index,'PROVIDER_RESPONSE_INVALID'));return texts;
  }
  return texts.map((original,index)=>{
    if(typeof responses[index]!=='string' || !responses[index].trim()){onFailure(index,'EMPTY_TRANSLATION');return original;}
    const restored=Protection.restore(responses[index],protectedValues[index].tokens);
    if(!restored.isValid){onFailure(index,'PROTECTED_CONTENT_INVALID');return original;}
    return restored.restoredText;
  });
}
