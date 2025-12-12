'use client'

import { useState } from 'react'
import { Bars3Icon, UserCircleIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void
}

export default function Header({ setSidebarOpen }: HeaderProps) {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const handleLogout = () => {
    localStorage.removeItem('user')
    window.location.href = '/login'
  }

  return (
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-secondary-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <button
        type="button"
        className="-m-2.5 p-2.5 text-secondary-700 lg:hidden hover:bg-secondary-50 rounded-md"
        onClick={() => setSidebarOpen(true)}
      >
        <span className="sr-only">Open sidebar</span>
        <Bars3Icon className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Separator */}
      <div className="h-6 w-px bg-secondary-200 lg:hidden" aria-hidden="true" />

      {/* App Title/Branding */}
      <div className="flex items-center">
        <h1 className="text-xl font-bold text-primary-600">
          PwC AI Assistant
        </h1>
      </div>

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1"></div>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* Profile dropdown */}
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-x-2 rounded-md p-2 text-sm font-semibold text-secondary-900 hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            >
              <UserCircleIcon className="h-8 w-8 text-secondary-400" />
              <span className="hidden sm:block">{user.username || 'User'}</span>
              <ChevronDownIcon className="h-4 w-4 text-secondary-400" />
            </button>

            {/* Profile Dropdown Menu */}
            {profileDropdownOpen && (
              <div className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="px-4 py-2 text-sm text-secondary-700 border-b border-secondary-200">
                  <div className="font-medium">{user.username || 'User'}</div>
                  <div className="text-xs text-secondary-500">{user.email || ''}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="block w-full px-4 py-2 text-left text-sm text-secondary-700 hover:bg-secondary-50"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
