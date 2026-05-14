import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { QueryProvider } from '@/components/providers/query-provider'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // Only admin and staff can access
  if (user.role !== 'admin' && user.role !== 'staff') {
    redirect('/dashboard')
  }

  return (
    <QueryProvider>
      <div className="min-h-screen">
        <AdminSidebar user={user} />
        <main className="pl-64">
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </QueryProvider>
  )
}
