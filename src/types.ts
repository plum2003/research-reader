export type KnowledgeType =
  | 'Vocabulary'
  | 'Writing'
  | 'Knowledge'
  | 'Method'
  | 'Data'
  | 'Figure'
  | 'Idea'

export type ViewMode = 'reader' | 'knowledge' | 'timeline'

export interface Paper {
  id: string
  title: string
  authors: string[]
  journal: string
  year: number
  doi: string
  url: string
  fileName: string
  fileKey?: string
  pageCount: number
  pdfUrl?: string
  importedAt: string
}

export interface SelectionContext {
  paperId: string
  pageNumber: number
  text: string
  context: string
  rect: { left: number; top: number; width: number; height: number }
}

export interface FigureCapture {
  dataUrl: string
  width: number
  height: number
  pageNumber: number
  bbox: { x: number; y: number; width: number; height: number }
  context: string
  caption?: string
}

export interface AssetRecord {
  id: string
  relativePath: string
  mimeType: string
  dataUrl: string
  sha256: string
  paperId: string
  pageNumber: number
  figureLabel: string
  width: number
  height: number
  createdAt: string
}

export interface KnowledgeItem {
  id: string
  paperId: string
  type: KnowledgeType
  title: string
  sourceText: string
  translatedText: string
  userNote: string
  pageNumber: number
  pageLabel: string
  tags: string[]
  metadata: Record<string, string | boolean | number>
  assetId?: string
  createdAt: string
  updatedAt: string
  favorite: boolean
}

export interface TranslationResult {
  text: string
  provider: string
  detectedLang?: string
  latencyMs: number
  charCount: number
}

export interface AppSettings {
  preferredProvider: 'local-demo' | 'mymemory' | 'baidu'
  targetLanguage: 'zh-CN' | 'en'
  includeContext: boolean
  maxTranslationChars: number
  autoBackup: boolean
  backupRetention: number
}

export interface PersistedState {
  papers: Paper[]
  knowledgeItems: KnowledgeItem[]
  assets: AssetRecord[]
  notes: Record<string, string>
  settings: AppSettings
  collections?: string[]
  tags?: string[]
}
