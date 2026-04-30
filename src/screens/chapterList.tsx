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
    const { selectedNovel, selectedChapterList, selectedChapterIndex, setChapterList, setChapter} = useNovelContext()
    
    const [loadedChaptersState, setLoadedChaptersState] = useState(false)
    const [failed, setFailed] = useState(false)

    const [toastMessage, setToastMessage] = useState("")
    const [showToast, setShowToast] = useState(false)

    useEffect(() => {
        if (!selectedNovel?.epubBlob) return

        const load = async () => {
            try {
                const chapters = await getChapterList(selectedNovel.epubBlob as Blob)
                await setChapterList(chapters)
                setLoadedChaptersState(true)
            } catch (e) {
                console.error('Failed to load chapters', e)
                setFailed(true)
            }
        }

        void load()
    }, [])

    const selectChapter = (index: number) => {
        const select = async () => {
            try {
                setChapter(index)
                console.log(selectedChapterIndex)
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
                    {loadedChaptersState && selectedChapterList.map((chapterContent, index) => {
                        return (
                            <Card variant="elevated" className="flex items-center gap-x-2">
                                <button className="flex-1 min-w-0" onClick={() => {selectChapter(index)}}>
                                    <ListItem
                                        leading={<h2>{index}</h2>}
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