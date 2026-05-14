'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  GraduationCap, 
  LayoutDashboard, 
  Calendar, 
  Users, 
  ClipboardList,
  QrCode,
  Settings,
  LogOut,
  ChevronDown,
  FileSpreadsheet,
  Sparkles
} from 'lucide-react'
import type { User } from '@/lib/types/database'

interface AdminSidebarProps {
  user: User
}

const navItems = [
  {
    title: 'Tổng quan',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    title: 'Workshop',
    href: '/admin/workshops',
    icon: Calendar,
  },
  {
    title: 'Đăng ký',
    href: '/admin/workshops',
    icon: ClipboardList,
  },
  {
    title: 'Check-in',
    href: '/admin/checkin',
    icon: QrCode,
  },
  {
    title: 'Người dùng',
    href: '/admin/users',
    icon: Users,
  },
  {
    title: 'Import sinh viên',
    href: '/admin/import-students',
    icon: FileSpreadsheet,
  },
  {
    title: 'AI Summary',
    href: '/admin/ai-summary',
    icon: Sparkles,
  },
]

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname()

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <GraduationCap className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold">UniHub Admin</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/admin' && pathname.startsWith(item.href))
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.title}
              </Link>
            )
          })}
        </nav>

        {/* User Menu */}
        <div className="border-t p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3 px-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {getInitials(user.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium truncate">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile">Hồ sơ cá nhân</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <form action="/auth/signout" method="post">
                  <button type="submit" className="flex w-full items-center">
                    <LogOut className="mr-2 h-4 w-4" />
                    Đăng xuất
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </aside>
  )
}
