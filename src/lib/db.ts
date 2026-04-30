import type { Novel } from '../types/novelTypes'

const DB_NAME = 'novel-reader-db'
const STORE_META = 'novels'
const STORE_BLOBS = 'novelBlobs'
const DB_VERSION = 2

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      const tx = req.transaction

      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'id' })
      }

      // v1 -> v2 migration: move epubBlob out of the meta store into STORE_BLOBS.
      // (Reading large blobs at boot can crash low-memory hardware.)
      if (tx && tx.objectStoreNames.contains(STORE_META) && tx.objectStoreNames.contains(STORE_BLOBS)) {
        try {
          const metaStore = tx.objectStore(STORE_META)
          const blobStore = tx.objectStore(STORE_BLOBS)

          metaStore.openCursor().onsuccess = (ev) => {
            const cursor = (ev.target as IDBRequest<IDBCursorWithValue | null>).result
            if (!cursor) return

            const value: any = cursor.value
            if (value && value.id && value.epubBlob) {
              blobStore.put({ id: value.id, epubBlob: value.epubBlob })
              delete value.epubBlob
              cursor.update(value)
            }

            cursor.continue()
          }
        } catch {
          // Ignore migration failures; app can still run, and blob will be re-saved on next update.
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveNovel(novel: Novel): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite')
    const metaStore = tx.objectStore(STORE_META)
    const blobStore = tx.objectStore(STORE_BLOBS)

    const { epubBlob, ...meta } = novel as any
    metaStore.put(meta)

    if (epubBlob) {
      blobStore.put({ id: novel.id, epubBlob })
    }

    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function getAllNovels(): Promise<Novel[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly')
    const store = tx.objectStore(STORE_META)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result as Novel[])
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}

export async function getNovelBlob(id: string): Promise<Blob | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readonly')
    const store = tx.objectStore(STORE_BLOBS)
    const req = store.get(id)
    req.onsuccess = () => {
      const result: any = req.result
      resolve((result?.epubBlob as Blob | undefined) ?? null)
    }
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}

export async function deleteNovel(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite')
    const metaStore = tx.objectStore(STORE_META)
    const blobStore = tx.objectStore(STORE_BLOBS)

    metaStore.delete(id)
    blobStore.delete(id)

    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error)
    }
  })
}
