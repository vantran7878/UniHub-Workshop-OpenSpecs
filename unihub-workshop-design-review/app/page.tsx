import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { WorkshopCard } from '@/components/workshops/workshop-card'
import { getCurrentUser } from '@/lib/actions/auth'
import { getWorkshops } from '@/lib/actions/workshops'
import { GraduationCap, Calendar, Users, Shield, ArrowRight } from 'lucide-react'

export default async function HomePage() {
  const user = await getCurrentUser()
  const { data: workshops } = await getWorkshops({ 
    published: true, 
    upcoming: true, 
    limit: 6 
  })

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
          <div className="container relative">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-balance">
                Khám phá và Đăng ký{' '}
                <span className="text-primary">Workshop</span>{' '}
                Dễ dàng
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground text-pretty max-w-2xl mx-auto">
                UniHub giúp sinh viên tìm kiếm, đăng ký và quản lý các workshop một cách thuận tiện. 
                Không còn lo lắng về việc hết chỗ hay quên lịch.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button size="lg" asChild>
                  <Link href="/workshops">
                    Xem Workshop
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                {!user && (
                  <Button size="lg" variant="outline" asChild>
                    <Link href="/auth/sign-up">Đăng ký tài khoản</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 bg-muted/50">
          <div className="container">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
              Tại sao chọn UniHub?
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Đăng ký nhanh chóng</h3>
                <p className="text-muted-foreground">
                  Chỉ với vài click, bạn có thể đăng ký workshop yêu thích và nhận mã QR xác nhận ngay.
                </p>
              </div>
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Quản lý dễ dàng</h3>
                <p className="text-muted-foreground">
                  Theo dõi tất cả các workshop đã đăng ký, nhận thông báo nhắc nhở trước sự kiện.
                </p>
              </div>
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Check-in tiện lợi</h3>
                <p className="text-muted-foreground">
                  Quét mã QR để check-in nhanh chóng tại sự kiện, hỗ trợ cả chế độ offline.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Upcoming Workshops Section */}
        {workshops && workshops.length > 0 && (
          <section className="py-16">
            <div className="container">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold">Workshop sắp diễn ra</h2>
                  <p className="text-muted-foreground mt-1">
                    Đừng bỏ lỡ những workshop hấp dẫn
                  </p>
                </div>
                <Button variant="outline" asChild className="hidden sm:flex">
                  <Link href="/workshops">
                    Xem tất cả
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
                {workshops.map((workshop) => (
                  <WorkshopCard key={workshop.id} workshop={workshop} />
                ))}
              </div>

              <div className="mt-8 text-center sm:hidden">
                <Button variant="outline" asChild>
                  <Link href="/workshops">
                    Xem tất cả workshop
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        {!user && (
          <section className="py-16 bg-primary text-primary-foreground">
            <div className="container text-center">
              <GraduationCap className="h-16 w-16 mx-auto mb-6 opacity-90" />
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Sẵn sàng tham gia?
              </h2>
              <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
                Tạo tài khoản ngay để bắt đầu đăng ký các workshop và không bỏ lỡ cơ hội học tập.
              </p>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/auth/sign-up">
                  Đăng ký miễn phí
                </Link>
              </Button>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  )
}
