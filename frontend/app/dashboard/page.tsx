'use client'

import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, DocumentIcon, CloudIcon, ChatBubbleLeftRightIcon, ArrowPathIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import HubCard from '@/components/HubCard'
import CreateHubModal from '@/components/CreateHubModal'
import toast from 'react-hot-toast'
import { apiClient } from '@/lib/api'

interface Hub {
  hub_name: string
  status: string
  file_count: number
  created_at: string
  last_synced: string
  sharepoint_linked: boolean
  auto_sync_enabled: boolean
}

interface DashboardStats {
  totalHubs: number
  totalFiles: number
  loadedHubs: number
  sharepointHubs: number
}

export default function DashboardPage() {
  const [hubs, setHubs] = useState<Hub[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [stats, setStats] = useState<DashboardStats>({
    totalHubs: 0,
    totalFiles: 0,
    loadedHubs: 0,
    sharepointHubs: 0
  })

  // Check authentication on page load - logout ONLY on actual refresh
  useEffect(() => {
    const now = Date.now()
    const lastLoad = localStorage.getItem('lastPageLoad')
    const justLoggedIn = localStorage.getItem('justLoggedIn')

    // If just logged in, clear the flag and don't check for refresh
    if (justLoggedIn) {
      localStorage.removeItem('justLoggedIn')
      localStorage.setItem('lastPageLoad', now.toString())
      return
    }

    // Check if this is an actual page refresh vs navigation
    const navigationType = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const isActualRefresh = navigationType && navigationType.type === 'reload'

    if (lastLoad && isActualRefresh) {
      const timeDiff = now - parseInt(lastLoad)
      // Only logout on actual refresh, not navigation
      if (timeDiff > 3000) {
        localStorage.removeItem('isAuthenticated')
        localStorage.removeItem('user')
        localStorage.removeItem('loadTime')
        localStorage.removeItem('justLoggedIn')
        window.location.href = '/login'
        return
      }
    }

    // Update last load time for navigation tracking
    localStorage.setItem('lastPageLoad', now.toString())
  }, [])

  useEffect(() => {
    fetchHubs()
    fetchStats()
  }, [])

  const fetchHubs = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const response = await apiClient.get('/hubs')
      if (response.ok) {
        const data = await response.json()
        setHubs(data.hubs)
        calculateStats(data.hubs)
      } else {
        throw new Error('Failed to fetch hubs')
      }
    } catch (error) {
      console.error('Failed to fetch hubs:', error)
      toast.error('Failed to load hubs')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const response = await apiClient.get('/hubs/loaded/list')
      if (response.ok) {
        const data = await response.json()
        setStats(prev => ({ ...prev, loadedHubs: data.count }))
      }
    } catch (error) {
      console.error('Failed to fetch loaded hubs:', error)
    }
  }, [])

  const calculateStats = (hubsData: Hub[]) => {
    const totalFiles = hubsData.reduce((sum, hub) => sum + hub.file_count, 0)
    const sharepointHubs = hubsData.filter(hub => hub.sharepoint_linked).length

    setStats({
      totalHubs: hubsData.length,
      totalFiles,
      loadedHubs: stats.loadedHubs, // Keep existing loaded count
      sharepointHubs
    })
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchHubs(false), fetchStats()])
    setRefreshing(false)
    toast.success('Dashboard refreshed')
  }

  const handleCreateHub = async (hubData: any) => {
    try {
      let response;
      if (hubData instanceof FormData) {
        // Upload files
        response = await apiClient.upload('/hubs/from-upload', hubData)
      } else {
        // SharePoint
        response = await apiClient.post('/hubs/from-sharepoint', hubData)
      }

      if (response.ok) {
        const result = await response.json()
        toast.success('Hub created successfully!')
        setShowCreateModal(false)
        fetchHubs()
      } else {
        let errorMessage = 'Failed to create hub'
        try {
          const error = await response.json()
          if (error.detail) {
            if (Array.isArray(error.detail)) {
              errorMessage = error.detail.map((err: any) => err.msg || err.message || JSON.stringify(err)).join(', ')
            } else if (typeof error.detail === 'string') {
              errorMessage = error.detail
            } else if (error.detail.msg) {
              errorMessage = error.detail.msg
            } else {
              errorMessage = JSON.stringify(error.detail)
            }
          } else if (error.message && typeof error.message === 'string') {
            errorMessage = error.message
          } else {
            errorMessage = JSON.stringify(error)
          }
        } catch (parseError) {
          errorMessage = `Server error (${response.status}): ${response.statusText}`
        }
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('Failed to create hub:', error)
      toast.error('Failed to create hub')
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Dashboard</h1>
          <p className="mt-1 text-sm text-secondary-600">
            Manage your document hubs and start chatting with your AI assistant
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary flex items-center"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Create Hub
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-create-500 rounded-lg">
              <DocumentIcon className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-secondary-600">Total Hubs</p>
              <p className="text-2xl font-bold text-secondary-900">{stats.totalHubs}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-green-200 rounded-lg">
              <CloudIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-secondary-600">SharePoint Linked</p>
              <p className="text-2xl font-bold text-secondary-900">{stats.sharepointHubs}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-blue-200 rounded-lg">
              <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-secondary-600">Total Files</p>
              <p className="text-2xl font-bold text-secondary-900">{stats.totalFiles}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-purple-200 rounded-lg">
              <ChartBarIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-secondary-600">Loaded Hubs</p>
              <p className="text-2xl font-bold text-secondary-900">{stats.loadedHubs}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Hubs Grid */}
      <div>
        <h2 className="text-lg font-semibold text-secondary-900 mb-4">Your Hubs</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-secondary-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-secondary-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : hubs.length === 0 ? (
          <div className="text-center py-12">
            <DocumentIcon className="mx-auto h-12 w-12 text-secondary-400" />
            <h3 className="mt-2 text-sm font-medium text-secondary-900">No hubs</h3>
            <p className="mt-1 text-sm text-secondary-500">
              Get started by creating your first document hub.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary"
              >
                Create your first hub
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hubs.map((hub) => (
              <HubCard key={hub.hub_name} hub={hub} onUpdate={fetchHubs} />
            ))}
          </div>
        )}
      </div>

      {/* Create Hub Modal */}
      {showCreateModal && (
        <CreateHubModal
          show={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateHub}
        />
      )}
    </div>
  )
}