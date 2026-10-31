import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/layout/Layout.jsx'
import AdminPage from './pages/AdminPage.jsx'
import DepartmentChooserPage from './pages/DepartmentChooserPage.jsx'
import DepartmentPage from './pages/DepartmentPage.jsx'
import HomePage from './pages/HomePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import PrincipalPage from './pages/PrincipalPage.jsx'
import StudentProfilePage from './pages/StudentProfilePage.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route element={<Layout />}>
          <Route path="/principal" element={<PrincipalPage />} />
          <Route path="/department" element={<DepartmentChooserPage />} />
          <Route path="/department/:departmentCode" element={<DepartmentPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/students/:studentId" element={<StudentProfilePage />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  )
}
