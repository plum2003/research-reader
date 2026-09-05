interface NativeMessageHandler {
  postMessage: (message: unknown) => void
}

interface NativeWindow extends Window {
  webkit?: {
    messageHandlers?: {
      openPDF?: NativeMessageHandler
      openExternal?: NativeMessageHandler
      copyText?: NativeMessageHandler
    }
  }
}

function nativeHandlers() {
  return (window as NativeWindow).webkit?.messageHandlers
}

export function requestOpenPdf() {
  const handler = nativeHandlers()?.openPDF
  if (!handler) return false
  handler.postMessage({ action: 'openPDF' })
  return true
}

export function openExternal(url: string) {
  const handler = nativeHandlers()?.openExternal
  if (handler) {
    handler.postMessage({ url })
    return true
  }

  const popup = window.open(url, '_blank', 'noopener,noreferrer')
  if (popup) return true

  // A browser may block a popup after an async action. Navigating a real link
  // still gives the user a deterministic result instead of a silent no-op.
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.click()
  return false
}

export async function copyText(text: string) {
  const handler = nativeHandlers()?.copyText
  if (handler) {
    handler.postMessage(text)
    return true
  }

  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    return copied
  }
}
