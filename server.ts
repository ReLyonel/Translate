import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseTranslationResponse } from './src/services/translation/jsonResponseParser';
import {
  findRelevantMemoryTerms,
  loadTranslationMemoryTerms,
  mergeTerminology,
} from './src/services/translation/memoryContext';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number.parseInt(process.env.PORT || '3000', 10);
const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11500').replace(/\/$/, '');
const ollamaModel = process.env.OLLAMA_MODEL || 'translategemma:27b';
const numCtx = Number.parseInt(process.env.OLLAMA_NUM_CTX || '16384', 10);
const temperature = Number.parseFloat(process.env.OLLAMA_TEMPERATURE || '0');
const keepAlive = process.env.OLLAMA_KEEP_ALIVE || '30m';

let translationMemoryTerms = new Map<string, string>();

app.use(express.json({ limit: '50mb' }));

async function ollamaChat(
  messages: { role: 'system' | 'user'; content: string }[],
  expectedLength: number,
) {
  const response = await fetch(ollamaBaseUrl + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel,
      stream: false,
      keep_alive: keepAlive,
      messages,
      format: {
        type: 'object',
        properties: {
          translations: {
            type: 'array',
            items: { type: 'string' },
            minItems: expectedLength,
            maxItems: expectedLength,
          },
        },
        required: ['translations'],
        additionalProperties: false,
      },
      options: {
        temperature,
        num_ctx: numCtx,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      'Ollama respondió HTTP ' + response.status + ': ' + (await response.text()).slice(0, 500),
    );
  }

  const body = await response.json() as {
    message?: { content?: string };
  };

  return body.message?.content?.trim() || '';
}

function buildSystemPrompt(
  textsLength: number,
  sourceLanguage: string,
  targetLanguage: string,
): string {
  return [
    'Eres un traductor técnico local para Foundry VTT y D&D 2024.',
    'Traduce de ' + sourceLanguage + ' a ' + targetLanguage + '.',
    'Conserva exactamente, sin modificar, eliminar, duplicar ni reordenar, todos los placeholders [[PROTECTED_###]].',
    'Algunos placeholders representan etiquetas HTML, entidades HTML y referencias de Foundry.',
    'Nunca intentes reconstruir, corregir ni estilizar esas etiquetas.',
    'Traduce únicamente el texto humano que queda fuera de los placeholders.',
    'La terminología proporcionada es obligatoria cuando aplica.',
    'La salida DEBE ser un único objeto JSON con exactamente esta forma: {"translations":["..."]}.',
    'El arreglo translations debe contener exactamente ' + textsLength + ' strings y mantener el mismo orden que los textos de entrada.',
    'No uses las frases de entrada como claves.',
    'No añadas ningún otro campo.',
    'No expliques nada.',
  ].join(' ');
}

async function translateTexts(
  texts: string[],
  terminology: Array<{ source?: string; target?: string }>,
  context: { docType?: string; notes?: string },
  sourceLanguage: string,
  targetLanguage: string,
) {
  const explicitTerms = terminology.map((term) => ({
    source: term.source || '',
    target: term.target || '',
  }));

  const memoryTerms = findRelevantMemoryTerms(
    texts,
    translationMemoryTerms,
    48,
  );

  const mergedTerminology = mergeTerminology(
    explicitTerms,
    memoryTerms,
  );

  const terms = mergedTerminology
    .map((term) => '- ' + term.source + ' => ' + term.target)
    .join('\n');

  const system = buildSystemPrompt(
    texts.length,
    sourceLanguage,
    targetLanguage,
  );

  const user = [
    'Contexto: ' + (context.docType || 'Foundry VTT') + '; ' + (context.notes || ''),
    'Terminología:\n' + (terms || '(ninguna)'),
    'Textos:\n' + JSON.stringify(texts),
  ].join('\n\n');

  const messages: { role: 'system' | 'user'; content: string }[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  try {
    const raw = await ollamaChat(messages, texts.length);
    return parseTranslationResponse(raw, texts.length);
  } catch (firstError) {
    const retryMessages = [
      ...messages,
      {
        role: 'user' as const,
        content: [
          'REINTENTO OBLIGATORIO.',
          'Devuelve exactamente ' + texts.length + ' traducciones.',
          'Usa exclusivamente el esquema JSON indicado:',
          '{"translations":["..."]}',
          'No escribas markdown, explicaciones, claves ni texto adicional.',
        ].join(' '),
      },
    ];

    try {
      const retryRaw = await ollamaChat(
        retryMessages,
        texts.length,
      );

      return parseTranslationResponse(
        retryRaw,
        texts.length,
      );
    } catch {
      throw firstError;
    }
  }
}

app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const response = await fetch(ollamaBaseUrl + '/api/tags');
    const body = response.ok
      ? await response.json() as { models?: { name: string }[] }
      : { models: [] };

    const installed = Boolean(
      body.models?.some(
        (entry) =>
          entry.name === ollamaModel ||
          entry.name.startsWith(ollamaModel + ':'),
      ),
    );

    res.json({
      status:
        response.ok && installed
          ? 'ok'
          : 'unavailable',
      provider: 'ollama',
      configured: true,
      connected: response.ok,
      model: ollamaModel,
      modelInstalled: installed,
      translationMemoryTerms:
        translationMemoryTerms.size,
    });
  } catch {
    res.json({
      status: 'unavailable',
      provider: 'ollama',
      configured: true,
      connected: false,
      model: ollamaModel,
      modelInstalled: false,
      translationMemoryTerms:
        translationMemoryTerms.size,
    });
  }
});

app.post('/api/translate', async (req: Request, res: Response) => {
  try {
    const {
      texts,
      terminology = [],
      context = {},
      sourceLanguage = 'English',
      targetLanguage = 'Spanish',
    } = req.body as {
      texts?: unknown;
      terminology?: unknown[];
      context?: {
        docType?: string;
        notes?: string;
      };
      sourceLanguage?: string;
      targetLanguage?: string;
    };

    if (
      !Array.isArray(texts) ||
      texts.length === 0 ||
      !texts.every(
        (text) => typeof text === 'string',
      )
    ) {
      return res.status(400).json({
        error:
          'texts debe ser un arreglo no vacío de strings.',
      });
    }

    const safeTerminology = Array.isArray(terminology)
      ? terminology as Array<{
          source?: string;
          target?: string;
        }>
      : [];

    const translations = await translateTexts(
      texts as string[],
      safeTerminology,
      context,
      sourceLanguage,
      targetLanguage,
    );

    res.json({
      success: true,
      translations,
    });
  } catch (error) {
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : 'Error desconocido de Ollama.',
    });
  }
});

async function startServer() {
  translationMemoryTerms =
    await loadTranslationMemoryTerms();

  console.log(
    'Translation Memory: ' + translationMemoryTerms.size + ' términos activos.',
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(
        path.resolve(__dirname, 'dist'),
      ),
    );

    app.get('*', (_req, res) =>
      res.sendFile(
        path.resolve(
          __dirname,
          'dist',
          'index.html',
        ),
      ),
    );
  }

  app.listen(
    port,
    '0.0.0.0',
    () =>
      console.log(
        'D&D Translator local listening on http://0.0.0.0:' + port,
      ),
  );
}

void startServer();