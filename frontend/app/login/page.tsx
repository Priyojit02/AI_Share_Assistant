'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Check credentials
    if (credentials.username === 'Pwc_AI' && credentials.password === 'Pwc@ai1234') {
      // Store authentication state
      localStorage.setItem('isAuthenticated', 'true')
      localStorage.setItem('user', JSON.stringify({ username: credentials.username }))
      localStorage.setItem('justLoggedIn', 'true') // Flag to indicate legitimate login navigation

      toast.success('Login successful!')
      router.push('/dashboard')
    } else {
      toast.error('Invalid credentials. Please try again.')
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-white to-secondary-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <img
            src="/pwc-logo.jpg"
            alt="PwC Logo"
            className="mx-auto h-16 w-auto"
          />
          <h2 className="mt-6 text-3xl font-bold text-secondary-900">
            PwC AI Assistant
          </h2>
          <p className="mt-2 text-sm text-secondary-600">
            Advanced Document Q&A System
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="card">
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-secondary-700 mb-1">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="input-field"
                  placeholder="Enter your username"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-secondary-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="input-field pr-10"
                    placeholder="Enter your password"
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-secondary-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-secondary-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign in'
                )}
              </button>
            </div>
          </div>
        </form>

        <div className="text-center">
          <p className="text-xs text-secondary-500">
            Secure access to intelligent document analysis
          </p>
        </div>
      </div>
    </div>
  )
}