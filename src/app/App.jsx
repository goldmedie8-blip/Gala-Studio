import { Route, Routes } from 'react-router-dom'
import Home from '../pages/Home.jsx'
import Library from '../pages/Library.jsx'
import NotFound from '../pages/NotFound.jsx'
import Profile from '../pages/Profile.jsx'
import ToolPage from '../pages/ToolPage.jsx'
import { getTools } from '../tools/index.js'
import { Shell } from './Shell.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="library" element={<Library />} />
        <Route path="profile" element={<Profile />} />
        {getTools().map((tool) => (
          <Route key={tool.id} path={tool.path.slice(1)} element={<ToolPage tool={tool} />} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
