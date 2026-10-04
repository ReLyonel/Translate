import path from 'node:path';import fs from 'node:fs/promises';
import { MemoryStore } from '../desktop/memory/store';
const [directory,action,value]=process.argv.slice(2);
if(!directory||!['list','approve','glossary'].includes(action))throw new Error('Uso: bunx tsx scripts/manageMemory.ts DIRECTORIO_MEMORIA list|approve|glossary [ID|ARCHIVO_JSON]');
const store=await new MemoryStore(path.resolve(directory)).load();
if(action==='list')console.log(JSON.stringify(store.entries(),null,2));
if(action==='approve'){if(!value)throw new Error('Indica el ID revisado explicitamente.');await store.approve(value);console.log('Traduccion aprobada tras validacion.');}
if(action==='glossary'){if(!value)throw new Error('Indica el archivo JSON de terminos revisados.');await store.setGlossary(JSON.parse(await fs.readFile(value,'utf8')));console.log('Glosario guardado.');}
