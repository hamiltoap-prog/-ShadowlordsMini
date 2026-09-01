import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { TableRoute } from './pages/TableRoute'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1c1730_0%,_#0b0a10_60%)]">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/t/:code" element={<TableRoute />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
