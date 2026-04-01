import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ArtistList from './pages/ArtistList'
import ArtistForm from './pages/ArtistForm'
import ArtistDashboard from './pages/ArtistDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ArtistList />} />
          <Route path="artists/new" element={<ArtistForm />} />
          <Route path="artists/:id/edit" element={<ArtistForm />} />
          <Route path="artists/:id" element={<ArtistDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
