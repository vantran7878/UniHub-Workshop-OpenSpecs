'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { usePathname } from 'next/navigation';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const isAdmin = user?.role === 'admin';

  return (
    <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex">
            <Link href="/" className="flex flex-shrink-0 items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white shadow-sm">
                U
              </div>
              <span className="ml-3 hidden text-xl font-bold text-zinc-900 dark:text-white sm:block">
                UniHub
              </span>
            </Link>
            <div className="ml-10 hidden space-x-8 sm:flex sm:items-center">
              {/* Common link for all but admin has a different path */}
              {!isAdmin ? (
                <Link
                  href="/workshops"
                  className={`${
                    pathname === '/workshops'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                  } text-sm font-medium transition-colors`}
                >
                  Workshops
                </Link>
              ) : (
                <>
                  <Link
                    href="/admin/workshops"
                    className={`${
                      pathname.startsWith('/admin/workshops')
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                    } text-sm font-medium transition-colors`}
                  >
                    Manage Workshops
                  </Link>
                  <Link
                    href="/admin/statistics"
                    className={`${
                      pathname === '/admin/statistics'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                    } text-sm font-medium transition-colors`}
                  >
                    Statistics
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center">
            {user ? (
              <>
                <div className="mr-4 hidden flex-col items-end sm:flex">
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">
                    {user.fullName}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <Link
                  href="/login"
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/login" // Assuming same page for now
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
