import { useState, useEffect, useReducer, createContext, useContext, type ReactNode } from 'react'
import { getAllNovels, saveNovel, deleteNovel } from '../lib/db'
import type { ChapterContent, Novel } from '../types/novelTypes'

// --- States ---
interface NovelState {
    novels: Novel[]
    selectedNovel: Novel | null
    selectedChapterList: ChapterContent[]
    selectedChapterIndex: number
}

// --- Actions ---
type NovelAction = 
    | { type: 'INIT'; novels: Novel[]}
    | { type: 'SET_SELECTED'; selectedNovel: Novel}
    | { type: 'ADD'; novel: Novel}
    | { type: 'REMOVE'; novel: Novel}
    | { type: 'UPDATE'; novel: Novel}
    | { type: 'SET_CHAPTERS', selectedChapterList: ChapterContent[]}
    | { type: 'SET_CHAPTER_INDEX', selectedChapterIndex: number}

// --- Context Value ---
interface NovelContextValue {
    novels: Novel[]
    selectedNovel: Novel | null
    selectedChapterList: ChapterContent[]
    selectedChapterIndex: number
    loaded: boolean
    setSelectedNovel: (novel: Novel) => Promise<void>
    addNovel: (novel: Novel) => Promise<void>
    removeNovel: (novel: Novel) => Promise<void>
    updateNovel: (novel: Novel) => Promise<void>
    setChapterList: (chapters: ChapterContent[]) => Promise<void>
    setChapter: (chapterIndex: number) => Promise<void>
}
const NovelContext = createContext<NovelContextValue | null>(null) 

// --- Reducer ---
export function novelReducer(state: NovelState, action: NovelAction): NovelState {
    switch(action.type) {
        case 'INIT':
            return { ...state, novels: action.novels, selectedNovel: null}
        case 'SET_SELECTED':
            return { ...state, selectedNovel: action.selectedNovel}
        case 'ADD':
            return { ...state, novels: [...state.novels, action.novel]}
        case 'REMOVE':
            return { ...state, novels: state.novels.filter((novel) => novel.id !== action.novel.id)}
        case 'UPDATE': 
            return { ...state, novels: state.novels.map((novel) => novel.id === action.novel.id ? action.novel : novel)}
        case 'SET_CHAPTERS':
            return { ...state, selectedChapterList: action.selectedChapterList}
        case 'SET_CHAPTER_INDEX':
            return {...state, selectedChapterIndex: action.selectedChapterIndex}
        default:
            return state
    }
}

// --- Provider ---
export function NovelProvider({children}: {children: ReactNode}) {
    const [state, dispatch] = useReducer(novelReducer, {
        novels: [], 
        selectedNovel: null,
        selectedChapterList: [],
        selectedChapterIndex: -1
    })

    const [loaded, setLoaded] = useState(false)

    // Initialization of novel data from IndexedDB
    useEffect(() => {
        async function init() {
            const novels = await getAllNovels();
            dispatch({ type: 'INIT', novels })
            setLoaded(true)
        }
        void init()
    }, [])


    const value: NovelContextValue = {
        novels: state.novels,
        selectedNovel: state.selectedNovel,
        selectedChapterList: state.selectedChapterList,
        selectedChapterIndex: state.selectedChapterIndex,
        loaded: loaded,
        setSelectedNovel: async (novel) => dispatch({ type: 'SET_SELECTED', selectedNovel: novel}),
        addNovel: async (novel) => {
            dispatch({ type: 'ADD', novel })
            try {
                await saveNovel(novel)
            } catch (e) {
                console.error('saveNovel failed', e)
                throw e
            }
        },
        removeNovel: async (novel) => {
            dispatch({ type: 'REMOVE', novel })
            try {
                await deleteNovel(novel.id)
            } catch (e) {
                console.error('deleteNovel failed', e)
                throw e
            }
        },
        updateNovel: async (novel) => {
            dispatch({ type: 'UPDATE', novel })
            try {
                await saveNovel(novel)
            } catch (e) {
                console.error('saveNovel failed', e)
                throw e
            }
        },
        setChapterList: async (chapterList) => {
            dispatch({ type: 'SET_CHAPTERS', selectedChapterList: chapterList })
        },
        setChapter: async (chapterIndex) => {
            dispatch({ type: 'SET_CHAPTER_INDEX', selectedChapterIndex: chapterIndex})
        }
    }

    return <NovelContext.Provider value={value}>{children}</NovelContext.Provider>
}

export function useNovelContext() {
  const ctx = useContext(NovelContext)
  if (!ctx) throw new Error('useNovelContext must be used within NovelProvider')
  return ctx
}