import express, { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '50mb' }));

// Server-side Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'ok',
    geminiConfigured: hasKey,
    model: 'gemini-3.8-flash',
  });
});

// Translation Endpoint
app.post('/api/translate', async (req: Request, res: Response) => {
  try {
    const { texts, terminology, context, sourceLanguage = 'English', targetLanguage = 'Spanish' } = req.body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: 'texts must be a non-empty array of strings' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY no configurada en el servidor. Configure la clave en el panel de secretos.',
      });
    }

    // Format terminology constraints
    let terminologyInstructions = 'No hay términos específicos provistos para este bloque.';
    if (Array.isArray(terminology) && terminology.length > 0) {
      terminologyInstructions = terminology
        .map(
          (t: { source: string; target: string; category?: string; context?: string; confidence?: string }) =>
            `- "${t.source}" => "${t.target}"${t.category ? ` [Categoría: ${t.category}]` : ''}${t.context ? ` [Contexto: ${t.context}]` : ''}`
        )
        .join('\n');
    }

    const systemInstruction = `Eres un traductor técnico especializado y de alta precisión para Dungeons & Dragons 2024, SRD 5.2.1 y Foundry VTT / Babele.
Traduce del ${sourceLanguage} al ${targetLanguage}.

REGLAS ESTRICTAS DE TRADUCCIÓN TÉCNICA:
1. AUTORIDAD TERMINOLÓGICA: La terminología provista en la lista de términos tiene prioridad ABSOLUTA sobre cualquier traducción general de diccionario. Si un término está en la lista, úsalo exactamente como se indica.
2. PRESERVACIÓN DE PLACEHOLDERS: Los placeholders con formato [[PROTECTED_000]] (por ejemplo: [[PROTECTED_001]], [[PROTECTED_002]], etc.) representan macros de Foundry VTT, UUIDs (@UUID[...]), tiradas (@Roll[...]), fórmulas de dados o variables técnicas. NUNCA los alteres, elimines, traduzcas, dupliques ni reordenes. Deben permanecer idénticos en la salida.
3. ETIQUETAS HTML: Mantén todas las etiquetas HTML (<p>, <strong>, <em>, <ul>, <li>, <table>, <tr>, <td>, <br>, <a>, etc.) y atributos exactamente con la misma estructura y balance. No traduzcas nombres de clases ni identificadores.
4. ESTILO Y NATURALIDAD: Utiliza español de España neutro estándar oficial de D&D (por ejemplo: "ventaja" para "advantage", "tirada de salvación" para "saving throw", "prueba de característica" para "ability check", "tirada de ataque" para "attack roll", "característica" para "feature" de clase, "dote" para "feat", "habilidad" para "skill", "competencia" para "proficiency", "rasgo" para "trait" de especie).
5. EXACTITUD: No resumas, no expliques, no añadas notas personales ni comentarios, no embellezcas ni omitas contenido.
6. FORMATO DE SALIDA: Debes responder EXCLUSIVAMENTE con un arreglo JSON de strings con la misma cantidad de elementos y en el mismo orden que la entrada.
Ejemplo de salida:
["Texto 1 traducido", "Texto 2 traducido"]`;

    const userPrompt = `Contexto del documento: ${context?.docType || 'D&D 5e / Foundry VTT'}
Contexto adicional: ${context?.notes || 'Contenido oficial D&D 2024'}

TERMINOLOGÍA OFICIAL APLICABLE OBLIGATORIA:
${terminologyInstructions}

TEXTOS A TRADUCIR (arreglo JSON de strings):
${JSON.stringify(texts)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.1, // Low temperature for maximum determinism and terminology fidelity
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text?.trim() || '[]';
    let translatedTexts: string[] = [];

    try {
      const parsed = JSON.parse(responseText);
      if (Array.isArray(parsed)) {
        translatedTexts = parsed.map(String);
      } else if (parsed && Array.isArray(parsed.translations)) {
        translatedTexts = parsed.translations.map(String);
      } else {
        throw new Error('Formato de respuesta no es un arreglo');
      }
    } catch (parseErr) {
      // Fallback if model wrapped in something unexpected
      console.warn('JSON parse error from model response, trying regex extraction', parseErr);
      const matches = responseText.match(/\[[\s\S]*\]/);
      if (matches) {
        translatedTexts = JSON.parse(matches[0]);
      } else {
        throw new Error('No se pudo interpretar la respuesta del modelo como lista de strings.');
      }
    }

    // Ensure array length matches
    if (translatedTexts.length !== texts.length) {
      console.warn(`Mismatch in translations count: expected ${texts.length}, got ${translatedTexts.length}`);
      // Fill or truncate safely
      while (translatedTexts.length < texts.length) {
        translatedTexts.push(texts[translatedTexts.length]);
      }
      translatedTexts = translatedTexts.slice(0, texts.length);
    }

    res.json({
      success: true,
      translations: translatedTexts,
    });
  } catch (error: any) {
    console.error('Error during translation:', error);
    res.status(500).json({
      error: error.message || 'Error desconocido al procesar la traducción con Gemini.',
    });
  }
});

// Endpoint for extracting terminology pairs from text/PDF excerpts
app.post('/api/extract-terminology', async (req: Request, res: Response) => {
  try {
    const { text, sampleSize = 20 } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY no configurada en el servidor.',
      });
    }

    const systemInstruction = `Eres un experto lexicógrafo de Dungeons & Dragons 2024 y SRD 5.2.1.
Analiza el texto provisto (que puede ser un extracto de PDF de reglas, glosario o tablas bilingües en inglés y español) y extrae pares terminológicos precisos de D&D.

Para cada término detectado proporciona:
- source: término en inglés (ej: "advantage", "attack roll", "saving throw", "warding bond")
- target: término en español (ej: "ventaja", "tirada de ataque", "tirada de salvación", "vínculo protector")
- category: categoría técnica (ej: "mechanical_term", "spell", "condition", "ability", "action", "item", "class_feature", "creature", "rule")
- confidence: "high" | "medium" | "low"
- context: breve contexto o regla asociada

Responde ÚNICAMENTE en JSON con el formato:
[
  {
    "source": "string",
    "target": "string",
    "category": "string",
    "confidence": "high" | "medium" | "low",
    "context": "string"
  }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Texto extraído:\n\n${text.slice(0, 15000)}`,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '[]');
    res.json({
      success: true,
      terms: Array.isArray(parsed) ? parsed : [],
    });
  } catch (error: any) {
    console.error('Error extracting terminology:', error);
    res.status(500).json({
      error: error.message || 'Error al extraer terminología con Gemini.',
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`D&D Translator Server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
