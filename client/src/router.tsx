import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import ProtectedRoute from '@/components/ProtectedRoute.tsx'
import GuestRoute from '@/components/GuestRoute.tsx'
import DashboardLayout from '@/layouts/DashboardLayout.tsx'
import Profile from '@/pages/Profile.tsx'
import SearchLeads from '@/pages/SearchLeads.tsx'
import Leads from '@/pages/Leads.tsx'
import LeadLists from '@/pages/LeadLists.tsx'
import LeadListDetails from '@/pages/LeadListDetails.tsx'
import EmailTemplates from '@/pages/EmailTemplates.tsx'
import EmailTemplateForm from '@/pages/EmailTemplateForm.tsx'
import Login from '@/pages/Login.tsx'
import Signup from '@/pages/Signup.tsx'
import Categories from '@/pages/Categories.tsx'
import Settings from '@/pages/Settings.tsx'
import Inbox from '@/pages/Inbox.tsx'

export default function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<ProtectedRoute />}>
                    <Route element={<DashboardLayout />}>
                        <Route path="/" element={<Navigate to="/search-leads" replace />} />
                        <Route path="/search-leads" element={<SearchLeads />} />
                        <Route path="/leads" element={<Leads />} />
                        <Route path="/lead-lists" element={<LeadLists />} />
                        <Route path="/lead-lists/:id" element={<LeadListDetails />} />
                        <Route path="/email-templates" element={<EmailTemplates />} />
                        <Route path="/email-templates/new" element={<EmailTemplateForm />} />
                        <Route path="/email-templates/:id/edit" element={<EmailTemplateForm />} />
                        <Route path="/categories" element={<Categories />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/inbox" element={<Inbox />} />
                    </Route>
                </Route>

                <Route element={<GuestRoute />}>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}
