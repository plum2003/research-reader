import type { AppSettings, Paper, PersistedState } from './types'

export const DEMO_PAPER_ID = 'paper-demo-kidney-aging'

export const demoPaper: Paper = {
  id: DEMO_PAPER_ID,
  title: 'Single-cell atlas of human kidney aging identifies cellular drivers of function decline',
  authors: ['Research Reader Demo'],
  journal: 'Nature Medicine',
  year: 2024,
  doi: '10.1038/s41591-024-00000-0',
  url: 'https://doi.org/10.1038/s41591-024-00000-0',
  fileName: 'single-cell-kidney-aging-demo.pdf',
  pageCount: 24,
  importedAt: '2026-09-05T08:00:00.000Z',
}

export const demoText = `We generated snRNA-seq profiles from kidney cortex tissues of 103 donors (0–89 years old). After quality control, we obtained 471,422 cells with a median of 2,454 genes and 6,721 UMIs per cell. Unsupervised clustering identified 34 major cell populations across all donors.

Cell type annotation was performed using canonical marker genes and reference datasets. The proportion of major cell types was broadly conserved across age groups, with minor shifts in the abundance of specific immune populations.

In proximal tubular cells, we identified multiple states associated with metabolic activity, stress response, and fibrosis programs. Pseudotime trajectory analysis revealed a continuum from a homeostatic state to a stress-responsive state enriched in injury and inflammation genes.`

export const defaultSettings: AppSettings = {
  preferredProvider: 'mymemory',
  targetLanguage: 'zh-CN',
  includeContext: true,
  maxTranslationChars: 5000,
  autoBackup: true,
  backupRetention: 14,
}

export const seedState: PersistedState = {
  // A new installation starts with the user's own library. The demo reader
  // remains available in code for development, but is not presented as data.
  papers: [],
  knowledgeItems: [],
  assets: [],
  notes: {},
  settings: defaultSettings,
  collections: [],
  tags: [],
}
