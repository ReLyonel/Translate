/** Target profile; runtime certification is deliberately separate from source support. */
export const foundryV14Profile = Object.freeze({
  id: 'foundry-v14.368', targetVersion: '14.368', rulesVersion: 'integrity-4',
  defaultProvider: 'ollama', defaultModel: 'translategemma:27b', babeleRequired: false,
  json: 'source-documents', scripts: ['js', 'mjs', 'cjs'],
  nativePackPublishing: false, nativeLocalizationPublishing: true,
  runtimeValidation: 'NOT_RUN', laterVersions: 'REQUIRE_VALIDATION',
  tokenOrderPolicy: 'STRICT',
});
