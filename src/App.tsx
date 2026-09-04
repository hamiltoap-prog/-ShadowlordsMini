import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ThemeToggle } from './components/ThemeToggle'
import { AdminPage } from './pages/AdminPage'
import { Home } from './pages/Home'
import { ScenePage } from './pages/ScenePage'
import { TableRoute } from './pages/TableRoute'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_var(--surface-page-glow)_0%,_var(--surface-page)_60%)]">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/t/:code" element={<TableRoute />} />
          <Route path="/t/:code/tela" element={<ScenePage />} />
          <Route path="*" element={<Home />} />
        </Routes>
        <ThemeToggle />
      </div>
    </BrowserRouter>
  )
}
