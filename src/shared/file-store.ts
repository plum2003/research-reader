const DB_NAME = 'research-reader-local-v1'
const DB_VERSION = 1
const PDF_STORE = 'pdfs'
const BACKUP_STORE = 'backups'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(PDF_STORE)) database.createObjectStore(PDF_STORE)
      if (!database.objectStoreNames.contains(BACKUP_STORE)) database.createObjectStore(BACKUP_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB unavailable'))
  })
}

export async function savePdfFile(fileKey: string, file: Blob) {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(PDF_STORE, 'readwrite')
    transaction.objectStore(PDF_STORE).put(file, fileKey)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('PDF save failed'))
  })
  database.close()
}

export async function loadPdfUrl(fileKey: string): Promise<string | undefined> {
  const blob = await loadPdfFile(fileKey)
  return blob ? URL.createObjectURL(blob) : undefined
}

export async function loadPdfFile(fileKey: string): Promise<Blob | undefined> {
  try {
    const database = await openDatabase()
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const request = database.transaction(PDF_STORE, 'readonly').objectStore(PDF_STORE).get(fileKey)
      request.onsuccess = () => resolve(request.result as Blob | undefined)
      request.onerror = () => reject(request.error)
    })
    database.close()
    return blob
  } catch {
    return undefined
  }
}

export async function deletePdfFile(fileKey: string) {
  try {
    const database = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PDF_STORE, 'readwrite')
      transaction.objectStore(PDF_STORE).delete(fileKey)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  } catch {
    // A missing local blob should never block deleting its metadata.
  }
}

export async function saveBackupSnapshot(key: string, payload: unknown) {
  try {
    const database = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(BACKUP_STORE, 'readwrite')
      transaction.objectStore(BACKUP_STORE).put({ createdAt: new Date().toISOString(), payload }, key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  } catch {
    // Automatic backup is best-effort in browser mode.
  }
}

export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
