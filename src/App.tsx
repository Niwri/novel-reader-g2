import { Routes, Route, useNavigate } from 'react-router'
import { AppShell, NavHeader, ScreenHeader, Card, Button, SectionHeader, ListItem, Page } from 'even-toolkit/web'
import { AppGlasses } from './glass/AppGlasses'
import { NovelProvider } from './contexts/novelContext'
import { Home, AddNovel, ChapterList } from './screens'

function TestPage() {
  const navigate = useNavigate()

  return (
    <AppShell header={<></>}>
      <div className="px-3 pt-4 pb-8 space-y-3">
        <ScreenHeader
          title="Test"
          subtitle="Route: /test"
        />

        <Card>
          <ListItem
            title="Glasses output"
            subtitle='The glasses side renders "text" on this route.'
          />
        </Card>

        <Button variant="highlight" size="sm" onClick={() => navigate('/')}>
          Back Home
        </Button>
      </div>
    </AppShell>
  )
}

export function App() {
  return (
    <NovelProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/add-novel" element={<AddNovel/>} />
        <Route path="/chapter-list" element={<ChapterList/>} />
        <Route path="/chapter" element={<ChapterList/>} />
        <Route path="*" element={<Home />} />
      </Routes>
      <AppGlasses />
    </NovelProvider>
  )
}
