import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { Novel } from '../types/novelTypes'

// ── Constants ──────────────────────────────────────────────────────────────────

const KEY_INDEX         = 'novel:index'
const metaKey   = (id: string) => `novel:meta:${id}`
const blobMetaKey = (id: string) => `novel:blob-meta:${id}`
const chunkKey  = (id: string, i: number) => `novel:blob:${id}:chunk:${i}`

const CHUNK_SIZE = 500_000 // ~500 KB of base64 chars per chunk

// ── Bridge singleton ───────────────────────────────────────────────────────────

let _bridge: EvenAppBridge | null = null

async function getBridge(): Promise<EvenAppBridge> {
  if (!_bridge) _bridge = await waitForEvenAppBridge()
  return _bridge
}

// ── Storage helpers ────────────────────────────────────────────────────────────

async function storageGet(key: string): Promise<string | null> {
  const bridge = await getBridge()
  return bridge.getLocalStorage(key)
}

async function storageSet(key: string, value: string): Promise<void> {
  const bridge = await getBridge()
  await bridge.setLocalStorage(key, value)
}

async function storageDelete(key: string): Promise<void> {
  const bridge = await getBridge()
  // The SDK has no removeLocalStorage — overwrite with empty sentinel
  await bridge.setLocalStorage(key, '')
}

// ── Base64 encode / decode ─────────────────────────────────────────────────────

async function blobToBase64Chunks(blob: Blob): Promise<string[]> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // Build base64 in one pass (avoids stack overflow on large Uint8Arrays)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)

  // Split into chunks
  const chunks: string[] = []
  for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
    chunks.push(base64.slice(i, i + CHUNK_SIZE))
  }
  return chunks
}

function base64ChunksToBlob(chunks: string[], mimeType = 'application/epub+zip'): Blob {
  const base64 = chunks.join('')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

// ── Index helpers ──────────────────────────────────────────────────────────────

async function readIndex(): Promise<string[]> {
  const raw = await storageGet(KEY_INDEX)
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

async function writeIndex(ids: string[]): Promise<void> {
  await storageSet(KEY_INDEX, JSON.stringify(ids))
}

async function addToIndex(id: string): Promise<void> {
  const ids = await readIndex()
  if (!ids.includes(id)) await writeIndex([...ids, id])
}

async function removeFromIndex(id: string): Promise<void> {
  const ids = await readIndex()
  await writeIndex(ids.filter(i => i !== id))
}

// ── Public API — mirrors the original IndexedDB module ─────────────────────────

export async function saveNovel(novel: Novel): Promise<void> {
  const { epubBlob, ...meta } = novel as any

  // Save metadata
  await storageSet(metaKey(novel.id), JSON.stringify(meta))

  // Save blob in chunks if present
  if (epubBlob instanceof Blob) {
    const chunks = await blobToBase64Chunks(epubBlob)
    await storageSet(blobMetaKey(novel.id), JSON.stringify({ chunks: chunks.length }))
    await Promise.all(
      chunks.map((chunk, i) => storageSet(chunkKey(novel.id, i), chunk))
    )
  }

  await addToIndex(novel.id)
}

export async function getAllNovels(): Promise<Novel[]> {
  const ids = await readIndex()

  const novels = await Promise.all(
    ids.map(async (id) => {
      const raw = await storageGet(metaKey(id))
      if (!raw) return null
      try { return JSON.parse(raw) as Novel } catch { return null }
    })
  )

  return novels.filter((n): n is Novel => n !== null)
}

export async function getNovelBlob(id: string): Promise<Blob | null> {
  const metaRaw = await storageGet(blobMetaKey(id))
  if (!metaRaw) return null

  let chunkCount: number
  try {
    chunkCount = JSON.parse(metaRaw).chunks
  } catch {
    return null
  }

  const chunks = await Promise.all(
    Array.from({ length: chunkCount }, (_, i) => storageGet(chunkKey(id, i)))
  )

  // Bail out if any chunk is missing
  if (chunks.some(c => !c)) return null

  return base64ChunksToBlob(chunks as string[])
}

export async function deleteNovel(id: string): Promise<void> {
  // Delete metadata
  await storageDelete(metaKey(id))

  // Delete blob chunks
  const metaRaw = await storageGet(blobMetaKey(id))
  if (metaRaw) {
    try {
      const { chunks } = JSON.parse(metaRaw)
      await Promise.all(
        Array.from({ length: chunks }, (_, i) => storageDelete(chunkKey(id, i)))
      )
    } catch { /* ignore */ }
  }
  await storageDelete(blobMetaKey(id))

  await removeFromIndex(id)
}