import { AppShell, Card, Button, SectionHeader, ListItem, Page } from 'even-toolkit/web'
import { useNovelContext } from '@/contexts/novelContext'
import { useNavigate } from 'react-router'
import { IcGuideBack, IcGuideGo } from 'even-toolkit/web/icons/svg-icons'
import JSZip from 'jszip'
import { ChapterContent } from '@/types/novelTypes'
import { useEffect, useState } from 'react'
import { Popup } from '@/components/popup'
import { getChapterList } from '@/data/novel'

export function ChapterList() {
    const navigate = useNavigate()
    const { selectedNovel, selectedChapterList, selectedChapterIndex, setChapterList, setChapter, updatePosition, setPosition} = useNovelContext()
    
    const [loadedChaptersState, setLoadedChaptersState] = useState(false)
    const [renderedChapterList, setRenderedChapterList] = useState<ChapterContent[]>([])
    const [failed, setFailed] = useState(false)

    const [toastMessage, setToastMessage] = useState("")
    const [showToast, setShowToast] = useState(false)

    useEffect(() => {
        if (!selectedNovel?.lastPosition) return
        if (!selectedChapterList.length) return

        const continueIndex = selectedNovel.lastPosition.chapterIndex
        if (continueIndex < 0 || continueIndex >= selectedChapterList.length) {
            return
        }

        const continueChapter = selectedChapterList[continueIndex]
        if (!continueChapter) return

        setRenderedChapterList([
            {
                name: "Continue at: " + continueChapter.name,
                chapterIndex: -1,
                chapterPath: ""
            },
            ...selectedChapterList,
        ])
    }, [selectedNovel?.lastPosition, selectedChapterList])

    useEffect(() => {
        if (!selectedNovel?.epubBlob) {
            
            setToastMessage("Failed to load chapters!")
            setShowToast(true)
            setTimeout(() => {setShowToast(false)}, 2000)
            return
        }

        const load = async () => {
            try {
                const chapters = await getChapterList(selectedNovel.epubBlob as Blob)
                await setChapterList(chapters)
                
                if(selectedNovel && selectedNovel.lastPosition) {
                    setRenderedChapterList([{
                        name: "Continue at: " + chapters[selectedNovel.lastPosition.chapterIndex].name,
                        chapterIndex: -1,
                        chapterPath: ""
                    }, ...chapters])
                } else {
                    setRenderedChapterList(chapters)
                }

                setLoadedChaptersState(true)
            } catch (e) {
                console.error('Failed to load chapters', e)
                setFailed(true)
            }
            setToastMessage("Sucessfully loaded chapters!")
            setShowToast(true)
            setTimeout(() => {setShowToast(false)}, 2000)
        }

        void load()
    }, [])

    const selectChapter = (index: number) => {
        const select = async () => {
            try {
                
                // Condition where "Continue" was pressed
                if(index == -1 && selectedNovel && selectedNovel.lastPosition) {
                    await setPosition(selectedNovel.lastPosition.charOffset)
                    await setChapter(selectedNovel.lastPosition.chapterIndex)
                } else {
                    await setPosition(0)
                    updatePosition({
                        chapterIndex: index,
                        charOffset: 0
                    })
                    await setChapter(index)

                }
                navigate("/chapter")
            } catch {
                setToastMessage("Failed to load chapter!")
                setShowToast(true)
                setTimeout(() => {setShowToast(false)}, 2000)
            }
        }
        void select()
    }

    return (
        <AppShell header={<></>}>
            <div className="px-3 pt-4 pb-8 space-y-3">
                <div className="flex flex-row items-center gap-x-4 mt-3">
                    <Button variant="highlight" size="sm" onClick={() => navigate('/')}>
                        <IcGuideBack width={20} height={20}/>
                        Back
                    </Button>
                    <h3>{selectedNovel?.title ?? ""}</h3>
                </div>
                <SectionHeader title="Chapter List"/>
                
                <Page className="flex flex-col gap-y-4 mt-4">
                    {!loadedChaptersState && !failed && "Loading..."}
                    {failed && "Failed to load chapters!"}
                    {loadedChaptersState && renderedChapterList.map((chapterContent, index) => {
                        return (
                            <Card variant="elevated" className="flex items-center gap-x-2">
                                <button className="flex-1 min-w-0" onClick={() => {selectChapter(chapterContent.chapterIndex)}}>
                                    <ListItem
                                        leading={chapterContent.chapterIndex != -1 ? <h2>{chapterContent.chapterIndex}</h2> : ""}
                                        title={chapterContent.name}
                                        className="p-0"
                                        trailing={<IcGuideGo width={20} height={20}/>}
                                    />
                                </button>

                            </Card>
                        )
                    })}
                </Page>
            </div>
            <Popup toastMessage={toastMessage} showToast={showToast}/>
        </AppShell>
    )
}