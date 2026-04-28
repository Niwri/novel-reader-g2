import { useNavigate } from 'react-router'
import { AppShell, Card, Button, SectionHeader, ListItem, Page } from 'even-toolkit/web'
import { useState } from 'react'
import { IcEditAdd, IcGuideGo } from 'even-toolkit/web/icons/svg-icons'
import { useNovelContext } from '../contexts/novelContext'
import { Popup } from '@/components/popup'
import type { Novel } from '../types/novelTypes'

export function Home() {
  const navigate = useNavigate()
  const { novels, removeNovel, setSelectedNovel } = useNovelContext()
  const [toastMessage, setToastMessage] = useState("")
  const [showToast, setShowToast] = useState(false)

  const handleNovelSelect = async (novel: Novel) => {
    try {
      await setSelectedNovel(novel)
      navigate("/chapter-list")
    } catch (e) {
      setToastMessage("Failed to load!")
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2000)
    }
  }

  return (
    <AppShell header={<></>}>
      <div className="px-3 pt-4 pb-8 space-y-3">

        <div className="font-normal flex flex-row justify-between items-center">
          <SectionHeader title="List of Novels"/>
          <Button variant="highlight" size="sm" onClick={() => navigate('/add-novel')}>
                Add Novel <IcEditAdd width={20} height={20}/>
          </Button>
        </div>
        <Page className="flex flex-col gap-y-4 mt-4">
          {
            novels.map((novel) => {
              return (
                <Card variant="elevated" className="flex items-center gap-x-2">
                  <div className="flex-1 min-w-0">
                    <ListItem 
                      leading={
                        <img src={novel.coverImage ?? undefined} alt="" width={40} height={40} className="rounded-xl flex-shrink-0"/>
                      }
                      title={novel.title}
                      subtitle={novel.lastReadAt?.toDateString() ?? "Not Yet Read"}
                      trailing={
                        <Button variant="highlight" size="sm" onClick={() => handleNovelSelect(novel)}>
                          Read <IcGuideGo width={15} height={15}/>
                        </Button>
                        }
                      className="p-0 pr-2"
                      onDelete={()=>{removeNovel(novel)}}
                    />
                  </div>
                  
                </Card>
              )
            })
          }
          {
            novels.length == 0 &&
            <h3 className="text-gray-400">Add a novel first!</h3>
          }
          
        </Page>
      </div>
      <Popup toastMessage={toastMessage} showToast={showToast}/>
    </AppShell>
  )
}
