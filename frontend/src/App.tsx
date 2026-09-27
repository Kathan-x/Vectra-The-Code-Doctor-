import { useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SplashScreen }          from '@/components/layout/SplashScreen'
import { ActiveProjectProvider } from '@/lib/activeProject'
import DashboardPage             from '@/pages/DashboardPage'
import IssuesPage                from '@/pages/IssuesPage'
import IssueDetailPage           from '@/pages/IssueDetailPage'
import ImpactPage                from '@/pages/ImpactPage'
import RepairPage                from '@/pages/RepairPage'
import VerifyPage                from '@/pages/VerifyPage'
import ReportPage                from '@/pages/ReportPage'

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const onSplashComplete = useCallback(() => setSplashDone(true), [])

  return (
    <ActiveProjectProvider>
      {!splashDone && <SplashScreen onComplete={onSplashComplete} />}

      <BrowserRouter>
        <Routes>
          <Route path="/"                element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"       element={<DashboardPage />} />
          <Route path="/issues"          element={<IssuesPage />} />
          <Route path="/issues/:issueId" element={<IssueDetailPage />} />
          <Route path="/impact"          element={<ImpactPage />} />
          <Route path="/repair"          element={<RepairPage />} />
          <Route path="/verify"          element={<VerifyPage />} />
          <Route path="/report"          element={<ReportPage />} />
        </Routes>
      </BrowserRouter>
    </ActiveProjectProvider>
  )
}
