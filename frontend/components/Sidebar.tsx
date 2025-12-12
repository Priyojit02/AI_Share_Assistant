'use client'

import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  XMarkIcon,
  HomeIcon,
  ChatBubbleLeftRightIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Chat', href: '/dashboard/chat', icon: ChatBubbleLeftRightIcon },
]

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export default function Sidebar({ sidebarOpen, setSidebarOpen }: SidebarProps) {
  const pathname = usePathname()

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('user')
    localStorage.removeItem('loadTime')
    localStorage.removeItem('justLoggedIn')
    localStorage.removeItem('lastPageLoad')
    sessionStorage.removeItem('pageLoaded')
    window.location.href = '/login'
  }

  return (
    <>
      {/* Mobile sidebar */}
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-secondary-900/80" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                  <button
                    type="button"
                    className="-m-2.5 p-2.5"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="sr-only">Close sidebar</span>
                    <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                  </button>
                </div>
                <SidebarContent pathname={pathname} onLogout={handleLogout} />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <SidebarContent pathname={pathname} onLogout={handleLogout} />
      </div>
    </>
  )
}

interface SidebarContentProps {
  pathname: string
  onLogout: () => void
}

function SidebarContent({ pathname, onLogout }: SidebarContentProps) {
  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4 shadow-sm border-r border-secondary-200">
      <div className="flex h-16 shrink-0 items-center">
        <div className="flex items-center">
          <img
            src="/pwc-logo.jpg"
            alt="PwC Logo"
            className="h-8 w-auto"
          />
          <span className="ml-3 text-lg font-semibold text-secondary-900">AIFileAssistant </span>
        </div>
      </div>
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold ${
                      pathname === item.href
                        ? 'bg-create-500 text-white'
                        : 'text-secondary-700 hover:text-create-600 hover:bg-secondary-50'
                    }`}
                  >
                    <item.icon
                      className={`h-6 w-6 shrink-0 ${
                        pathname === item.href ? 'text-white' : 'text-secondary-400 group-hover:text-create-600'
                      }`}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
          <li className="mt-auto">
            <button
              onClick={onLogout}
              className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-secondary-700 hover:bg-secondary-50 hover:text-red-600 w-full text-left"
            >
              <ArrowRightOnRectangleIcon className="h-6 w-6 shrink-0 text-secondary-400 group-hover:text-red-600" />
              Logout
            </button>
          </li>
        </ul>
      </nav>
    </div>
  )
}