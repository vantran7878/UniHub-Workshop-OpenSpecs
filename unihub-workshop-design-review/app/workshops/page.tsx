import { Suspense } from 'react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { WorkshopCard } from '@/components/workshops/workshop-card'
import { getCurrentUser } from '@/lib/actions/auth'
import { getWorkshops } from '@/lib/actions/workshops'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Search } from 'lucide-react'

export const metadata = {
  title: 'Workshop',
  description: 'Danh sách các workshop đang mở đăng ký',
}

function WorkshopSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

async function WorkshopList() {
  const { data: workshops, error } = await getWorkshops({ 
    published: true,
    upcoming: true 
  })

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Không thể tải danh sách workshop</p>
      </div>
    )
  }

  if (workshops.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Chưa có workshop nào sắp diễn ra</p>
      </div>
    )
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
      {workshops.map((workshop) => (
        <WorkshopCard key={workshop.id} workshop={workshop} />
      ))}
    </div>
  )
}

export default async function WorkshopsPage() {
  const user = await getCurrentUser()

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      
      <main className="flex-1 py-8">
        <div className="container">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Workshop</h1>
            <p className="text-muted-foreground">
              Khám phá và đăng ký các workshop hấp dẫn
            </p>
          </div>

          <div className="mb-8">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Tìm kiếm workshop..."
                className="pl-10"
              />
            </div>
          </div>

          <Suspense
            fallback={
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <WorkshopSkeleton key={i} />
                ))}
              </div>
            }
          >
            <WorkshopList />
          </Suspense>
        </div>
      </main>

      <Footer />
    </div>
  )
}
