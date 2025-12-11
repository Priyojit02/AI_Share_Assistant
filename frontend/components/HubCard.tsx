'use client'

import { useState, useEffect } from 'react'
import {
  DocumentIcon,
  CloudIcon,
  ClockIcon,
  ArrowPathIcon,
  TrashIcon,
  ChatBubbleLeftRightIcon,
  EyeIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Hub {
  hub_name: string
  status: string
  file_count: number
  created_at: string
  last_synced: string
  sharepoint_linked: boolean
  auto_sync_enabled: boolean
}

interface HubCardProps {
  hub: Hub
  onUpdate: () => void
}

interface FileInfo {
  id: string
  name: string
  etag: string
  size: number
  lastModifiedDateTime: string
}

interface HubDetailResponse {
  hub_name: string
  status: string
  files: FileInfo[]
  manifest: any
  metadata: any
}

export default function HubCard({ hub, onUpdate }: HubCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showFiles, setShowFiles] = useState(false)
  const [hubDetails, setHubDetails] = useState<HubDetailResponse | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Check if hub is loaded on mount
  useEffect(() => {
    checkLoadedStatus()
  }, [])

  const checkLoadedStatus = async () => {
    try {
      const response = await fetch('/api/hubs/loaded/list')
      if (response.ok) {
        const data = await response.json()
        setIsLoaded(data.loaded_hubs.includes(hub.hub_name))
      }
    } catch (error) {
      console.error('Failed to check loaded status:', error)
    }
  }

  const handleSync = async () => {
    if (!hub.sharepoint_linked) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/hubs/${hub.hub_name}/sync`, {
        method: 'POST',
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message)
        onUpdate()
        checkLoadedStatus() // Refresh loaded status
      } else {
        const error = await response.json()
        toast.error(error.detail || 'Sync failed')
      }
    } catch (error) {
      console.error('Sync error:', error)
      toast.error('Sync failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoadUnload = async () => {
    setIsLoading(true)
    try {
      const endpoint = isLoaded ? 'unload' : 'load'
      const response = await fetch(`/api/hubs/${hub.hub_name}/${endpoint}`, {
        method: 'POST',
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(result.message)
        setIsLoaded(!isLoaded)
        onUpdate()
      } else {
        const error = await response.json()
        toast.error(error.detail || `${endpoint} failed`)
      }
    } catch (error) {
      console.error('Load/Unload error:', error)
      toast.error('Operation failed')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchHubDetails = async () => {
    if (hubDetails) return // Already loaded

    setIsLoadingDetails(true)
    try {
      const response = await fetch(`/api/hubs/${hub.hub_name}`)
      if (response.ok) {
        const data = await response.json()
        setHubDetails(data)
      } else {
        toast.error('Failed to load hub details')
      }
    } catch (error) {
      console.error('Failed to fetch hub details:', error)
      toast.error('Failed to load hub details')
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const handleShowFiles = async () => {
    if (!showFiles && !hubDetails) {
      await fetchHubDetails()
    }
    setShowFiles(!showFiles)
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete hub "${hub.hub_name}"?`)) return

    try {
      const response = await fetch(`/api/hubs/${hub.hub_name}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Hub deleted successfully')
        onUpdate()
      } else {
        const error = await response.json()
        toast.error(error.detail || 'Delete failed')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Delete failed')
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="card hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          <div className="p-2 bg-primary-100 rounded-lg">
            <DocumentIcon className="h-6 w-6 text-primary-600" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-semibold text-secondary-900">{hub.hub_name}</h3>
            <p className="text-sm text-secondary-600">
              {hub.file_count} files • {hub.status}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isLoaded && (
            <div className="flex items-center text-green-600" title="Loaded in memory">
              <CpuChipIcon className="h-5 w-5 mr-1" />
              <span className="text-xs font-medium">Loaded</span>
            </div>
          )}
          {hub.sharepoint_linked && (
            <CloudIcon className="h-5 w-5 text-blue-500" title="SharePoint linked" />
          )}
          {hub.auto_sync_enabled && (
            <ArrowPathIcon className="h-5 w-5 text-green-500" title="Auto sync enabled" />
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center text-sm text-secondary-600">
          <ClockIcon className="h-4 w-4 mr-2" />
          Created: {formatDate(hub.created_at)}
        </div>
        {hub.last_synced && (
          <div className="flex items-center text-sm text-secondary-600">
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Synced: {formatDate(hub.last_synced)}
          </div>
        )}
      </div>

      {/* File Preview Section */}
      <div className="mt-4 p-3 bg-primary-200 rounded-lg border border-primary-300">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center text-sm font-medium text-secondary-900">
            <DocumentIcon className="h-4 w-4 mr-2 text-primary-600" />
            Files ({hub.file_count})
          </div>
          <button
            onClick={handleShowFiles}
            disabled={isLoadingDetails}
            className="text-primary-600 hover:text-primary-700 text-xs font-medium flex items-center disabled:opacity-50"
          >
            {showFiles ? (
              <>
                <EyeSlashIcon className="h-3 w-3 mr-1" />
                Hide
              </>
            ) : (
              <>
                <EyeIcon className="h-3 w-3 mr-1" />
                Show All
              </>
            )}
          </button>
        </div>
        {hub.file_count > 0 && (
          <div className="text-xs text-secondary-600">
            Click "Show All" to see detailed file list
          </div>
        )}
      </div>

      {showFiles && hubDetails && (
        <div className="mt-4 p-4 bg-white border border-secondary-200 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-secondary-900 flex items-center">
              <DocumentIcon className="h-4 w-4 mr-2 text-primary-600" />
              Files in Hub ({hubDetails.files.length})
            </h4>
            <button
              onClick={() => setShowFiles(false)}
              className="text-secondary-400 hover:text-secondary-600 p-1"
              title="Hide files"
            >
              <EyeSlashIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {hubDetails.files.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-2 bg-secondary-50 rounded-md text-xs hover:bg-secondary-100 transition-colors">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <DocumentIcon className="h-3 w-3 text-secondary-400 flex-shrink-0" />
                  <span className="truncate text-secondary-700 font-medium">{file.name}</span>
                </div>
                <span className="text-secondary-500 ml-2 flex-shrink-0 bg-white px-2 py-1 rounded">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <div className="flex space-x-2">
          <Link
            href={`/dashboard/chat?hub=${hub.hub_name}`}
            className="btn-secondary text-xs px-3 py-1"
          >
            <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1 inline" />
            Chat
          </Link>
          <button
            onClick={handleLoadUnload}
            disabled={isLoading}
            className={`text-xs px-3 py-1 rounded-md disabled:opacity-50 ${
              isLoaded
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            <CpuChipIcon className={`h-4 w-4 mr-1 inline ${isLoading ? 'animate-spin' : ''}`} />
            {isLoaded ? 'Unload' : 'Load'}
          </button>
          <button
            onClick={handleShowFiles}
            disabled={isLoadingDetails}
            className="btn-secondary text-xs px-3 py-1 disabled:opacity-50"
          >
            <EyeIcon className={`h-4 w-4 mr-1 inline ${isLoadingDetails ? 'animate-spin' : ''}`} />
            {showFiles ? 'Hide Files' : 'Show Files'}
          </button>
          {hub.sharepoint_linked && (
            <button
              onClick={handleSync}
              disabled={isLoading}
              className="btn-secondary text-xs px-3 py-1 disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-4 w-4 mr-1 inline ${isLoading ? 'animate-spin' : ''}`} />
              Sync
            </button>
          )}
        </div>
        <button
          onClick={handleDelete}
          className="text-red-600 hover:text-red-800 p-1"
          title="Delete hub"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}