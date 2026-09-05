import type { Paper, SelectionContext } from '../../types'

export function buildExplainPrompt(paper: Paper, selection: SelectionContext, translatedText = '') {
  return `【论文】${paper.title}
【来源】${paper.journal} (${paper.year}) | DOI: ${paper.doi || '未提供'} | Page ${selection.pageNumber}
【原文】
${selection.text}

【附近上下文】
${selection.context || '未提供'}

【已有译文】
${translatedText || '未翻译'}

请用中文解释这段内容，保留关键英文术语；先说明作者在说什么，再解释机制/实验逻辑；如有不确定处明确指出。`
}

export function buildFigurePrompt(paper: Paper, pageNumber: number, caption: string, context: string) {
  return `请解释这张论文 Figure。
Paper: ${paper.title}
Figure: 未标注
Page: ${pageNumber}
Legend: ${caption || '请根据图片识别'}
Relevant context: ${context || '未提供'}

请回答：
1) 每个 panel、组别、坐标分别代表什么；
2) 作者用什么实验设计回答什么问题；
3) 主要结果与证据链；
4) 有哪些局限；
5) 这个实验设计对我的科研可复用之处。`
}
