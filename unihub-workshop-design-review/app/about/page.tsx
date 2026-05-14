import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { getCurrentUser } from '@/lib/actions/auth'
import { Card, CardContent } from '@/components/ui/card'
import { GraduationCap, Target, Users, Zap, Heart, Shield } from 'lucide-react'

export const metadata = {
  title: 'Giới thiệu - UniHub',
  description: 'Tìm hiểu về UniHub - Hệ thống quản lý workshop dành cho sinh viên',
}

export default async function AboutPage() {
  const user = await getCurrentUser()

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      
      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-transparent">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <GraduationCap className="h-10 w-10 text-primary" />
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-balance">
                Về UniHub
              </h1>
              <p className="text-lg text-muted-foreground text-pretty">
                UniHub là nền tảng quản lý workshop hiện đại, giúp kết nối sinh viên với các cơ hội học tập 
                và phát triển kỹ năng một cách dễ dàng và hiệu quả.
              </p>
            </div>
          </div>
        </section>

        {/* Mission */}
        <section className="py-16">
          <div className="container">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <h2 className="text-2xl md:text-3xl font-bold">Sứ mệnh của chúng tôi</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Chúng tôi tin rằng mỗi sinh viên đều xứng đáng được tiếp cận với những cơ hội học tập 
                  chất lượng. UniHub ra đời với mục tiêu đơn giản hóa quy trình đăng ký và quản lý workshop, 
                  giúp sinh viên tập trung vào điều quan trọng nhất - học hỏi và phát triển.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Với UniHub, việc tìm kiếm, đăng ký và theo dõi các workshop trở nên dễ dàng hơn bao giờ hết. 
                  Chúng tôi cam kết mang đến trải nghiệm người dùng tốt nhất cho cả sinh viên và ban tổ chức.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-6 text-center">
                  <CardContent className="p-0 space-y-2">
                    <div className="text-4xl font-bold text-primary">12K+</div>
                    <div className="text-sm text-muted-foreground">Sinh viên</div>
                  </CardContent>
                </Card>
                <Card className="p-6 text-center">
                  <CardContent className="p-0 space-y-2">
                    <div className="text-4xl font-bold text-primary">500+</div>
                    <div className="text-sm text-muted-foreground">Workshop</div>
                  </CardContent>
                </Card>
                <Card className="p-6 text-center">
                  <CardContent className="p-0 space-y-2">
                    <div className="text-4xl font-bold text-primary">50+</div>
                    <div className="text-sm text-muted-foreground">Diễn giả</div>
                  </CardContent>
                </Card>
                <Card className="p-6 text-center">
                  <CardContent className="p-0 space-y-2">
                    <div className="text-4xl font-bold text-primary">98%</div>
                    <div className="text-sm text-muted-foreground">Hài lòng</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-16 bg-muted/50">
          <div className="container">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Giá trị cốt lõi</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Đơn giản hóa</h3>
                <p className="text-muted-foreground">
                  Mọi tính năng đều được thiết kế với mục tiêu đơn giản hóa trải nghiệm người dùng, 
                  từ việc tìm kiếm đến đăng ký và check-in.
                </p>
              </div>
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Hiệu quả</h3>
                <p className="text-muted-foreground">
                  Hệ thống được tối ưu để xử lý hàng nghìn đăng ký đồng thời, 
                  đảm bảo không có sinh viên nào bị bỏ lỡ cơ hội.
                </p>
              </div>
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Tin cậy</h3>
                <p className="text-muted-foreground">
                  Bảo mật thông tin sinh viên là ưu tiên hàng đầu. 
                  Chúng tôi áp dụng các tiêu chuẩn bảo mật cao nhất.
                </p>
              </div>
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Cộng đồng</h3>
                <p className="text-muted-foreground">
                  Xây dựng một cộng đồng học tập năng động, 
                  nơi sinh viên có thể kết nối và chia sẻ kiến thức.
                </p>
              </div>
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Heart className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Tận tâm</h3>
                <p className="text-muted-foreground">
                  Đội ngũ phát triển luôn lắng nghe phản hồi từ người dùng 
                  để không ngừng cải thiện sản phẩm.
                </p>
              </div>
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Học tập</h3>
                <p className="text-muted-foreground">
                  Khuyến khích tinh thần học hỏi suốt đời, 
                  giúp sinh viên phát triển toàn diện cả kỹ năng cứng và mềm.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="py-16">
          <div className="container">
            <div className="max-w-2xl mx-auto text-center space-y-6">
              <h2 className="text-2xl md:text-3xl font-bold">Liên hệ với chúng tôi</h2>
              <p className="text-muted-foreground">
                Có câu hỏi hoặc góp ý? Chúng tôi luôn sẵn sàng lắng nghe bạn.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center text-sm">
                <div className="px-6 py-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground">Email:</span>{' '}
                  <span className="font-medium">support@unihub.edu.vn</span>
                </div>
                <div className="px-6 py-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground">Hotline:</span>{' '}
                  <span className="font-medium">1900 xxxx</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
