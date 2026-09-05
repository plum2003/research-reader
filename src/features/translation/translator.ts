import type { AppSettings, TranslationResult } from '../../types'

export interface TranslationProvider {
  id: string
  name: string
  translate(input: {
    text: string
    sourceLang: string
    targetLang: string
  }): Promise<TranslationResult>
}

// MyMemory rejects a single query above 500 characters. Leave a small margin
// so that the request remains valid even when the provider counts boundaries
// differently from the browser string length.
export const MAX_PROVIDER_QUERY_CHARS = 480

function splitTextForProvider(text: string, maxChars = MAX_PROVIDER_QUERY_CHARS) {
  const chunks: string[] = []
  let remaining = text.trim()

  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars)
    const sentenceBreak = Math.max(
      window.lastIndexOf('. '),
      window.lastIndexOf('? '),
      window.lastIndexOf('! '),
      window.lastIndexOf('; '),
    )
    const wordBreak = window.lastIndexOf(' ')
    const cutAt = sentenceBreak > Math.floor(maxChars * 0.55)
      ? sentenceBreak + 1
      : wordBreak > 0
        ? wordBreak
        : maxChars

    chunks.push(remaining.slice(0, cutAt).trim())
    remaining = remaining.slice(cutAt).trim()
  }

  if (remaining) chunks.push(remaining)
  return chunks
}

const gloss = new Map([
  ['single-cell', '单细胞'],
  ['single nucleus', '单核'],
  ['transcriptomic', '转录组学的'],
  ['trajectory', '轨迹'],
  ['stress-responsive', '应激反应的'],
  ['homeostatic', '稳态的'],
  ['inflammation', '炎症'],
  ['fibrosis', '纤维化'],
  ['cellular state', '细胞状态'],
  ['quality control', '质量控制'],
])

interface MyMemoryResponse {
  responseStatus?: number
  responseDetails?: string
  responseData?: { translatedText?: string }
}

function demoTranslate(text: string) {
  let result = text
  gloss.forEach((value, key) => {
    result = result.replace(new RegExp(key, 'gi'), value)
  })
  return `本地演示译文：${result}`
}

export const localDemoProvider: TranslationProvider = {
  id: 'local-demo',
  name: 'Local glossary demo',
  async translate({ text }) {
    const started = performance.now()
    await new Promise((resolve) => window.setTimeout(resolve, 260))
    return {
      text: demoTranslate(text),
      provider: 'Local glossary demo',
      detectedLang: 'en',
      latencyMs: Math.round(performance.now() - started),
      charCount: text.length,
    }
  },
}

export const myMemoryProvider: TranslationProvider = {
  id: 'mymemory',
  name: 'MyMemory neural translation',
  async translate({ text, sourceLang, targetLang }) {
    const started = performance.now()
    const params = new URLSearchParams({
      q: text,
      langpair: `${sourceLang}|${targetLang}`,
    })
    const response = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`在线翻译服务返回 ${response.status}，请稍后重试。`)
    const payload = await response.json() as MyMemoryResponse
    const translatedText = payload.responseData?.translatedText?.trim()
    if (payload.responseStatus !== 200 || !translatedText) {
      throw new Error(payload.responseDetails || '在线翻译没有返回有效译文。')
    }
    return {
      text: translatedText,
      provider: 'MyMemory neural translation',
      detectedLang: sourceLang,
      latencyMs: Math.round(performance.now() - started),
      charCount: text.length,
    }
  },
}

export const providers: Record<AppSettings['preferredProvider'], TranslationProvider> = {
  'local-demo': localDemoProvider,
  mymemory: myMemoryProvider,
  baidu: {
    id: 'baidu',
    name: 'Baidu Translate (配置后可用)',
    async translate() {
      throw new Error('Baidu provider requires a secure Tauri keychain bridge; current browser MVP uses Local glossary demo.')
    },
  },
}

export async function translateWithChunks(
  provider: TranslationProvider,
  input: { text: string; sourceLang: string; targetLang: string },
): Promise<TranslationResult> {
  const chunks = splitTextForProvider(input.text)
  if (chunks.length <= 1) return provider.translate(input)

  const started = performance.now()
  const translatedChunks: TranslationResult[] = []
  // Keep requests sequential to avoid triggering the provider's rate limit
  // when a user selects a long paragraph.
  for (const chunk of chunks) {
    translatedChunks.push(await provider.translate({ ...input, text: chunk }))
  }

  const firstResult = translatedChunks[0]
  const separator = input.targetLang === 'zh-CN' ? '' : ' '
  return {
    text: translatedChunks.map((result) => result.text.trim()).join(separator).trim(),
    provider: firstResult?.provider || provider.name,
    detectedLang: firstResult?.detectedLang || input.sourceLang,
    latencyMs: Math.round(performance.now() - started),
    charCount: input.text.length,
  }
}

export function translationCacheKey(text: string, sourceLang: string, targetLang: string, provider: string) {
  return [provider, sourceLang, targetLang, text.trim()].join('::')
}
