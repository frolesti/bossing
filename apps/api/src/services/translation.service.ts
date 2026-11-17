/**
 * Servei de traducció intel·ligent amb Google Gemini.
 *
 * Tradueix termes de cerca de productes alimentaris entre Català i Castellà.
 * Usa l'API nativa de Google Gemini (gemini-2.5-flash, gratuït amb API key).
 *
 * Amb la cache de 7 dies, el cost real és quasi nul:
 *   - Cada terme es tradueix UNA sola vegada
 *   - Crides cached: 0€, 0ms
 */

import { fileCache } from './cache.service.js';

// ============================================================
// Configuració Gemini (lazy init)
// ============================================================

let geminiApiKey: string | null = null;
let geminiModel: string = 'gemini-2.5-flash';
let geminiReady: boolean | null = null;

function getGeminiConfig(): { apiKey: string; model: string } | null {
  if (geminiApiKey) return { apiKey: geminiApiKey, model: geminiModel };
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  geminiApiKey = apiKey;
  geminiModel = process.env.AI_MODEL || 'gemini-2.5-flash';
  return { apiKey: geminiApiKey, model: geminiModel };
}

function ensureGeminiLog(): void {
  if (geminiReady !== null) return;
  const config = getGeminiConfig();
  if (config) {
    geminiReady = true;
    console.log(`[Translation] ✓ Google Gemini (${config.model}) — proveïdor actiu.`);
  } else {
    geminiReady = false;
    console.warn('[Translation] ✗ OPENAI_API_KEY no configurat — les traduccions no funcionaran.');
    console.warn('[Translation]   Genera una clau gratuïta a: https://aistudio.google.com/apikey');
  }
}

// ============================================================
// Cache
// ============================================================
const TRANSLATION_CACHE_PREFIX = 'tr:';
const TRANSLATION_CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 dies

interface TranslationResult {
  spanish: string;
  catalan: string;
  searchVariants: string[];
}

// ============================================================
// Utilitats
// ============================================================

function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// ============================================================
// Funcions públiques
// ============================================================

/**
 * Tradueix un terme de cerca al castellà.
 * Retorna la traducció o null si no es pot traduir.
 */
export async function translateToSpanish(term: string): Promise<string | null> {
  const result = await getTranslation(term);
  if (!result) return null;
  if (norm(result.spanish) === norm(term)) return null;
  return result.spanish;
}

/**
 * Obté la traducció completa (castellà + català + variants) per un terme.
 */
export async function getTranslation(term: string): Promise<TranslationResult | null> {
  const normalized = norm(term);
  if (!normalized) return null;

  // 1. Check cache
  const cacheKey = `${TRANSLATION_CACHE_PREFIX}${normalized}`;
  if (fileCache.isValid(cacheKey, TRANSLATION_CACHE_TTL)) {
    const cached = fileCache.get<TranslationResult>(cacheKey);
    if (cached) return cached.data;
  }

  // 2. Gemini
  ensureGeminiLog();
  if (!geminiReady) return null;

  try {
    const result = await translateWithGemini([normalized]);
    if (result[normalized]) {
      fileCache.set(cacheKey, result[normalized]);
      return result[normalized];
    }
  } catch (e) {
    console.warn(`[Translation] Gemini failed:`, e instanceof Error ? e.message : e);
  }

  return null;
}

/**
 * Traducció en batch — UNA SOLA crida a Gemini per tots els termes no cached.
 */
export async function batchTranslateToSpanish(terms: string[]): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  const uncachedTerms: string[] = [];

  // 1. Check cache
  for (const term of terms) {
    const normalized = norm(term);
    const cacheKey = `${TRANSLATION_CACHE_PREFIX}${normalized}`;

    if (fileCache.isValid(cacheKey, TRANSLATION_CACHE_TTL)) {
      const cached = fileCache.get<TranslationResult>(cacheKey);
      if (cached) {
        const spanish = norm(cached.data.spanish) !== normalized ? cached.data.spanish : null;
        results.set(term, spanish);
        continue;
      }
    }
    uncachedTerms.push(term);
  }

  if (uncachedTerms.length === 0) return results;

  // 2. Gemini batch
  ensureGeminiLog();
  if (geminiReady && uncachedTerms.length > 0) {
    try {
      const normalizedTerms = uncachedTerms.map(t => norm(t));
      const translations = await translateWithGemini(normalizedTerms);

      for (const term of uncachedTerms) {
        const normalized = norm(term);
        const result = translations[normalized];
        if (result) {
          const cacheKey = `${TRANSLATION_CACHE_PREFIX}${normalized}`;
          fileCache.set(cacheKey, result);
          const spanish = norm(result.spanish) !== normalized ? result.spanish : null;
          results.set(term, spanish);
        } else {
          results.set(term, null);
        }
      }
      return results;
    } catch (e) {
      console.warn(`[Translation] Batch Gemini failed:`, e instanceof Error ? e.message : e);
    }
  }

  // 3. No Gemini — no translation
  for (const term of uncachedTerms) {
    results.set(term, null);
  }

  return results;
}

/**
 * Obté les variants de cerca per un terme (incloent traducció).
 */
export async function getSearchVariants(term: string): Promise<string[]> {
  const result = await getTranslation(term);
  if (!result) return [term];

  const variants = new Set<string>();
  variants.add(term);
  if (norm(result.spanish) !== norm(term)) variants.add(result.spanish);
  if (norm(result.catalan) !== norm(term)) variants.add(result.catalan);
  for (const v of result.searchVariants) {
    if (norm(v) !== norm(term)) variants.add(v);
  }

  return [...variants];
}

/**
 * Variant castellana des de cache (síncron, per matchScore).
 */
export function getSpanishVariantSync(term: string): string | null {
  const normalized = norm(term);
  const cacheKey = `${TRANSLATION_CACHE_PREFIX}${normalized}`;

  if (fileCache.isValid(cacheKey, TRANSLATION_CACHE_TTL)) {
    const cached = fileCache.get<TranslationResult>(cacheKey);
    if (cached && norm(cached.data.spanish) !== normalized) {
      return cached.data.spanish;
    }
  }
  return null;
}

/**
 * Variant catalana des de cache (síncron, per matchScore).
 */
export function getCatalanVariantSync(term: string): string | null {
  const normalized = norm(term);
  const cacheKey = `${TRANSLATION_CACHE_PREFIX}${normalized}`;

  if (fileCache.isValid(cacheKey, TRANSLATION_CACHE_TTL)) {
    const cached = fileCache.get<TranslationResult>(cacheKey);
    if (cached && norm(cached.data.catalan) !== normalized) {
      return cached.data.catalan;
    }
  }
  return null;
}

// ============================================================
// System prompt per Gemini
// ============================================================

const TRANSLATION_SYSTEM_PROMPT = `Ets un traductor expert de noms de productes alimentaris entre Català i Castellà. La teva tasca és traduir termes de cerca de supermercats.

INSTRUCCIONS:
- Per a cada terme, retorna la traducció castellana, la catalana, i 0-2 variants de cerca addicionals.
- Les variants de cerca són formes alternatives que un supermercat podria usar (sinònims, abreviatures, noms col·loquials).
- Si el terme ja és castellà, la traducció castellana és el mateix terme i la catalana és la traducció.
- Si el terme ja és català, la traducció catalana és el mateix terme i la castellana és la traducció.
- Normalitza: treure accents innecessaris, correctors ortogràfics.
- Respon NOMÉS amb JSON vàlid, sense markdown, sense explicacions.

FORMAT DE RESPOSTA (JSON):
{
  "terme_normalitzat": {
    "spanish": "traducció castellà",
    "catalan": "traducció català",
    "searchVariants": ["variant1", "variant2"]
  }
}

EXEMPLES:
Input: "oli d'oliva verge extra"
Output: {"oli d'oliva verge extra": {"spanish": "aceite de oliva virgen extra", "catalan": "oli d'oliva verge extra", "searchVariants": ["aceite oliva", "aove"]}}

Input: "llet sencera"
Output: {"llet sencera": {"spanish": "leche entera", "catalan": "llet sencera", "searchVariants": ["leche"]}}

Input: "pollo"
Output: {"pollo": {"spanish": "pollo", "catalan": "pollastre", "searchVariants": ["pollo entero"]}}`;

// ============================================================
// Google Gemini (API nativa REST)
// ============================================================

const GEMINI_MAX_RETRIES = 5;
const GEMINI_RETRY_DELAY_MS = 4000;

async function translateWithGemini(
  terms: string[]
): Promise<Record<string, TranslationResult>> {
  const config = getGeminiConfig();
  if (!config) return {};

  const termList = terms.map((t, i) => `${i + 1}. ${t}`).join('\n');
  const userPrompt = `Tradueix aquests ${terms.length} termes de productes alimentaris:\n${termList}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

  const requestBody = JSON.stringify({
    system_instruction: {
      parts: [{ text: TRANSLATION_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      maxOutputTokens: 2000,
    },
  });

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    });

    if (response.ok) {
      const data = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        console.warn('[Translation] Gemini returned empty response.');
        return {};
      }

      return parseLLMResponse(content, terms, 'Gemini');
    }

    // Retry on 429 (rate limit) or 503 (overloaded)
    if ((response.status === 429 || response.status === 503) && attempt < GEMINI_MAX_RETRIES) {
      console.warn(`[Translation] Gemini ${response.status}, retry ${attempt}/${GEMINI_MAX_RETRIES} in ${GEMINI_RETRY_DELAY_MS}ms...`);
      await new Promise(r => setTimeout(r, GEMINI_RETRY_DELAY_MS * attempt));
      continue;
    }

    const errBody = await response.text().catch(() => 'no body');
    lastError = new Error(`Gemini ${response.status}: ${errBody.substring(0, 200)}`);
  }

  throw lastError || new Error('Gemini: all retries exhausted');
}

// ============================================================
// Parser per respostes JSON de Gemini
// ============================================================

function parseLLMResponse(
  content: string,
  terms: string[],
  providerName: string
): Record<string, TranslationResult> {
  try {
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    const results: Record<string, TranslationResult> = {};
    for (const term of terms) {
      const entry = parsed[term];
      if (entry && typeof entry.spanish === 'string' && typeof entry.catalan === 'string') {
        results[term] = {
          spanish: entry.spanish,
          catalan: entry.catalan,
          searchVariants: Array.isArray(entry.searchVariants)
            ? entry.searchVariants.filter((v: unknown) => typeof v === 'string')
            : [],
        };
      }
    }

    console.log(`[Translation] ${providerName} translated ${Object.keys(results).length}/${terms.length} terms.`);
    return results;
  } catch (e) {
    console.warn(`[Translation] Failed to parse ${providerName} response:`, content.substring(0, 200));
    return {};
  }
}
