import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import type { KnowledgeItem, Paper, PersistedState } from '../../types'
import { loadPdfFile } from '../../shared/file-store'

function downloadBlob(content: BlobPart, fileName: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 500)
}

function cleanState(state: PersistedState) {
  return {
    ...state,
    papers: state.papers.map(({ pdfUrl: _pdfUrl, ...paper }) => paper),
  }
}

function assetPath(state: PersistedState, item: KnowledgeItem) {
  return item.assetId ? state.assets.find((asset) => asset.id === item.assetId)?.relativePath || '' : ''
}

export function exportJson(state: PersistedState) {
  const payload = {
    schema_version: '1.2',
    exported_at: new Date().toISOString(),
    app_version: '0.1.0',
    papers: state.papers.map(({ pdfUrl: _pdfUrl, ...paper }) => paper),
    knowledge_items: state.knowledgeItems,
    tags: Array.from(new Set(state.knowledgeItems.flatMap((item) => item.tags))),
    assets: state.assets,
    settings_subset: {
      preferredProvider: state.settings.preferredProvider,
      targetLanguage: state.settings.targetLanguage,
      includeContext: state.settings.includeContext,
    },
  }
  downloadBlob(JSON.stringify(payload, null, 2), 'research-reader-library.json', 'application/json')
}

function frontmatter(item: KnowledgeItem, paper?: Paper) {
  return `---
id: ${item.id}
type: ${item.type}
paper_id: ${item.paperId}
paper: ${paper?.title || 'Unknown paper'}
page: ${item.pageNumber}
tags: [${item.tags.join(', ')}]
asset: ${item.assetId || ''}
created_at: ${item.createdAt}
---`
}

export function exportMarkdown(state: PersistedState) {
  const body = state.knowledgeItems
    .map((item) => {
      const paper = state.papers.find((candidate) => candidate.id === item.paperId)
      const figurePath = assetPath(state, item)
      return `${frontmatter(item, paper)}

# ${item.title}

## Summary
${item.userNote || '未添加笔记'}

## Original text
${item.sourceText}

## Translation
${item.translatedText || '未翻译'}

## Source
${paper?.title || 'Unknown paper'} · ${paper?.journal || ''} · Page ${item.pageNumber}
${paper?.doi ? `DOI: ${paper.doi}` : ''}
${figurePath ? `\n## Asset\n${figurePath}` : ''}
`
    })
    .join('\n---\n\n')
  downloadBlob(body, 'research-reader-knowledge.md', 'text/markdown;charset=utf-8')
}

function csvEscape(value: unknown) {
  const text = value === undefined || value === null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function itemsCsv(state: PersistedState) {
  const header = ['type', 'title', 'source_text', 'translated_text', 'user_note', 'paper', 'page', 'tags', 'created_at', 'asset_path']
  const rows = state.knowledgeItems.map((item) => {
    const paper = state.papers.find((candidate) => candidate.id === item.paperId)
    return [item.type, item.title, item.sourceText, item.translatedText, item.userNote, paper?.title || '', item.pageNumber, item.tags.join('|'), item.createdAt, assetPath(state, item)]
  })
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')
}

export function exportCsv(state: PersistedState) {
  downloadBlob(`\ufeff${itemsCsv(state)}`, 'research-reader-items.csv', 'text/csv;charset=utf-8')
}

function citationKey(paper: Paper) {
  const author = (paper.authors[0] || 'ResearchReader').replace(/[^a-zA-Z0-9]/g, '') || 'ResearchReader'
  return `${author}${paper.year || ''}${paper.id.slice(-5)}`
}

export function exportBibtex(state: PersistedState) {
  const body = state.papers.map((paper) => {
    const authors = paper.authors.length ? paper.authors.join(' and ') : 'Research Reader'
    return `@article{${citationKey(paper)},\n  title = {${paper.title}},\n  author = {${authors}},\n  journal = {${paper.journal}},\n  year = {${paper.year}},\n  doi = {${paper.doi}},\n  url = {${paper.url}}\n}`
  }).join('\n\n')
  downloadBlob(body, 'research-reader-library.bib', 'text/plain;charset=utf-8')
}

export function exportRis(state: PersistedState) {
  const body = state.papers.map((paper) => [
    'TY  - JOUR',
    `TI  - ${paper.title}`,
    ...paper.authors.map((author) => `AU  - ${author}`),
    `JO  - ${paper.journal}`,
    `PY  - ${paper.year}`,
    paper.doi ? `DO  - ${paper.doi}` : '',
    paper.url ? `UR  - ${paper.url}` : '',
    'ER  - ',
  ].filter(Boolean).join('\n')).join('\n\n')
  downloadBlob(body, 'research-reader-library.ris', 'text/plain;charset=utf-8')
}

export function exportAnki(state: PersistedState) {
  const rows = state.knowledgeItems
    .filter((item) => item.type === 'Vocabulary' || item.type === 'Writing')
    .map((item) => [item.sourceText, item.translatedText || item.userNote || item.title, `${item.pageLabel} · ${item.paperId}`, item.tags.join(' ')].map((value) => String(value).replace(/\t/g, ' ')).join('\t'))
  downloadBlob(`\ufeff${rows.join('\n')}`, 'research-reader-vocabulary-writing.tsv', 'text/tab-separated-values;charset=utf-8')
}

function sheetRows(state: PersistedState, type?: KnowledgeItem['type']) {
  return state.knowledgeItems
    .filter((item) => !type || item.type === type)
    .map((item) => {
      const paper = state.papers.find((candidate) => candidate.id === item.paperId)
      return {
        Type: item.type,
        Title: item.title,
        Source: item.sourceText,
        Translation: item.translatedText,
        Note: item.userNote,
        Paper: paper?.title || '',
        Page: item.pageNumber,
        Tags: item.tags.join(', '),
        Asset: assetPath(state, item),
        Created: item.createdAt,
      }
    })
}

export function exportXlsx(state: PersistedState) {
  const workbook = XLSX.utils.book_new()
  const paperRows = state.papers.map(({ pdfUrl: _pdfUrl, ...paper }) => ({ ...paper, Authors: paper.authors.join('; ') }))
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(paperRows), 'Papers')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheetRows(state)), 'Knowledge')
  ;(['Vocabulary', 'Writing', 'Method', 'Data', 'Figure', 'Idea'] as const).forEach((type) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheetRows(state, type)), type))
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(Array.from(new Set(state.knowledgeItems.flatMap((item) => item.tags))).map((tag) => ({ Tag: tag }))), 'Tags')
  XLSX.writeFile(workbook, 'ResearchReader.xlsx')
}

function safeFileName(value: string) {
  return value.replace(/[^\w\-. ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 72) || 'untitled'
}

function dataUrlBytes(dataUrl: string) {
  const encoded = dataUrl.split(',')[1] || ''
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export async function exportArchive(state: PersistedState) {
  const zip = new JSZip()
  const canonical = cleanState(state)
  const files = ['canonical/library.json', 'tables/items.csv', 'bibliography/library.bib', 'bibliography/library.ris', 'anki/vocabulary-writing.tsv']
  zip.file('canonical/library.json', JSON.stringify(canonical, null, 2))
  zip.file('tables/items.csv', itemsCsv(state))
  const bibliography = state.papers.map((paper) => `@article{${citationKey(paper)}, title = {${paper.title}}, author = {${paper.authors.join(' and ')}}, journal = {${paper.journal}}, year = {${paper.year}}, doi = {${paper.doi}}}`).join('\n\n')
  zip.file('bibliography/library.bib', bibliography)
  const ris = state.papers.map((paper) => ['TY  - JOUR', `TI  - ${paper.title}`, ...paper.authors.map((author) => `AU  - ${author}`), `JO  - ${paper.journal}`, `PY  - ${paper.year}`, paper.doi ? `DO  - ${paper.doi}` : '', 'ER  - '].filter(Boolean).join('\n')).join('\n\n')
  zip.file('bibliography/library.ris', ris)
  zip.file('anki/vocabulary-writing.tsv', state.knowledgeItems.filter((item) => item.type === 'Vocabulary' || item.type === 'Writing').map((item) => `${item.sourceText}\t${item.translatedText || item.userNote || item.title}\t${item.tags.join(' ')}`).join('\n'))
  state.knowledgeItems.forEach((item) => {
    const paper = state.papers.find((candidate) => candidate.id === item.paperId)
    const path = `markdown/${item.type}/${safeFileName(item.title)}-${item.id.slice(-6)}.md`
    zip.file(path, `${frontmatter(item, paper)}\n\n# ${item.title}\n\n${item.userNote || item.sourceText}\n`)
    files.push(path)
  })
  state.assets.forEach((asset) => {
    const relative = asset.relativePath.replace(/^figures\//, '')
    const imagePath = `figures/${relative}`
    const metadataPath = `figures/${relative}.json`
    const notePath = `figures/${relative}.md`
    zip.file(imagePath, dataUrlBytes(asset.dataUrl))
    zip.file(metadataPath, JSON.stringify(asset, null, 2))
    zip.file(notePath, `# ${asset.figureLabel}\n\n- Paper: ${asset.paperId}\n- Page: ${asset.pageNumber}\n- SHA-256: ${asset.sha256}\n`)
    files.push(imagePath, metadataPath, notePath)
  })
  for (const paper of state.papers) {
    if (!paper.fileKey) continue
    const pdf = await loadPdfFile(paper.fileKey)
    if (!pdf) continue
    const path = `pdf/${safeFileName(paper.fileName || paper.id)}-${paper.id.slice(-6)}.pdf`
    zip.file(path, pdf)
    files.push(path)
  }
  zip.file('manifest.json', JSON.stringify({ schema_version: '1.2', app_version: '0.1.0', exported_at: new Date().toISOString(), includes_pdfs: files.some((file) => file.startsWith('pdf/')), counts: { papers: state.papers.length, knowledge_items: state.knowledgeItems.length, assets: state.assets.length }, files }, null, 2))
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, `ResearchReader_Archive_${new Date().toISOString().slice(0, 10)}.zip`, 'application/zip')
}

export function exportBackup(state: PersistedState) {
  downloadBlob(JSON.stringify({ ...cleanState(state), backup_created_at: new Date().toISOString() }, null, 2), 'research-reader-backup.json', 'application/json')
}
