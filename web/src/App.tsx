import { BrowserRouter, Routes, Route } from 'react-router-dom'
import RootLayout from './layouts/RootLayout.tsx'
import Home from './pages/Home.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Suggestions from './pages/Suggestions.tsx'
import News from './pages/News.tsx'
import Events from './pages/Events.tsx'
import AskAI from './pages/AskAI.tsx'
import Predictions from './pages/Predictions.tsx'
import Admin from './pages/Admin.tsx'
import Settings from './pages/Settings.tsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}> 
          <Route index element={<Dashboard />} />
          <Route path="home" element={<Home />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="suggestions" element={<Suggestions />} />
          <Route path="news" element={<News />} />
          <Route path="events" element={<Events />} />
          <Route path="ask-ai" element={<AskAI />} />
          <Route path="predictions" element={<Predictions />} />
          <Route path="admin" element={<Admin />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
