'use client'

import { useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CloudIcon, DocumentIcon, ShieldCheckIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'

interface CreateHubModalProps {
  onClose: () => void
  onCreate: (data: any) => void
  show?: boolean
}

type Step = 'auth' | 'create'

export default function CreateHubModal({ onClose, onCreate, show = false }: CreateHubModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>('auth')
  const [adminPassword, setAdminPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [activeTab, setActiveTab] = useState<'sharepoint' | 'upload'>('sharepoint')
  const [formData, setFormData] = useState({
    hub_name: '',
    sharepoint_link: '',
    auto_sync: false,
  })
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles, rejectedFiles) => {
      try {
        // Validate file sizes (max 50MB per file)
        const maxSize = 50 * 1024 * 1024 // 50MB
        const validFiles = acceptedFiles.filter(file => file && file.size <= maxSize)
        const oversizedFiles = acceptedFiles.filter(file => file && file.size > maxSize)

        if (oversizedFiles.length > 0) {
          toast.error(`${oversizedFiles.length} file(s) too large (max 50MB each)`)
        }

        if (rejectedFiles.length > 0) {
          toast.error(`${rejectedFiles.length} file(s) rejected (unsupported format)`)
        }

        if (validFiles.length > 0) {
          setUploadedFiles(prev => {
            // Prevent duplicates based on name and size
            const existingFiles = new Set(prev.map(f => `${f.name}-${f.size}`))
            const newFiles = validFiles.filter(f => !existingFiles.has(`${f.name}-${f.size}`))
            return [...prev, ...newFiles]
          })
          toast.success(`Added ${validFiles.length} file(s)`)
        }
      } catch (error) {
        console.error('Error handling file drop:', error)
        toast.error('Error processing files')
      }
    },
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls', '.xlsx'],
      'application/zip': ['.zip'],
      'text/plain': ['.txt'],
    },
    multiple: true,
    maxSize: 50 * 1024 * 1024, // 50MB
  })

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsVerifying(true)

    // Check admin password
    if (adminPassword === 'Priyojit') {
      setCurrentStep('create')
      toast.success('Admin access granted')
    } else {
      toast.error('Invalid admin password')
    }

    setIsVerifying(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (activeTab === 'sharepoint') {
        if (!formData.hub_name || !formData.sharepoint_link) {
          toast.error('Please fill in all required fields')
          return
        }

        await onCreate({
          hub_name: formData.hub_name,
          sharepoint_link: formData.sharepoint_link,
          auto_sync: formData.auto_sync,
        })
      } else {
        if (!formData.hub_name || uploadedFiles.length === 0) {
          toast.error('Please provide a hub name and upload files')
          return
        }

        // Create FormData for file upload
        const uploadData = new FormData()
        uploadData.append('hub_name', formData.hub_name)
        
        // Validate files before adding to FormData
        uploadedFiles.forEach((file, index) => {
          if (file && file.name && file.size > 0) {
            uploadData.append('files', file)
          } else {
            console.warn(`Skipping invalid file at index ${index}:`, file)
          }
        })

        await onCreate(uploadData)
      }
    } catch (error) {
      console.error('Create hub error:', error)
      let errorMessage = 'Failed to create hub'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') {
          errorMessage = error.message
        } else {
          errorMessage = JSON.stringify(error)
        }
      }
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'pdf': return '📄'
      case 'docx': return '📝'
      case 'xls':
      case 'xlsx': return '📊'
      case 'zip': return '📦'
      case 'txt': return '📄'
      default: return '📄'
    }
  }

  return (
    <Transition.Root show={true} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-secondary-900/75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white text-secondary-400 hover:text-secondary-500"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
                    <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-secondary-900">
                      {currentStep === 'auth' ? 'Admin Authentication Required' : 'Create New Hub'}
                    </Dialog.Title>

                    {currentStep === 'auth' ? (
                      /* Admin Authentication Step */
                      <form onSubmit={handleAdminAuth} className="mt-6 space-y-4">
                        <div className="text-center">
                          <ShieldCheckIcon className="mx-auto h-12 w-12 text-primary-900" />
                          <p className="mt-2 text-sm text-secondary-600">
                            Admin privileges required to create document hubs
                          </p>
                        </div>

                        <div>
                          <label htmlFor="admin_password" className="block text-sm font-medium text-secondary-700">
                            Admin Password
                          </label>
                          <div className="mt-1 relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              id="admin_password"
                              required
                              className="input-field pr-10"
                              placeholder="Enter admin password"
                              value={adminPassword}
                              onChange={(e) => setAdminPassword(e.target.value)}
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

                        <div className="flex justify-end space-x-3 pt-4">
                          <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isVerifying}
                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isVerifying ? 'Verifying...' : 'Authenticate'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Hub Creation Step */
                      <>
                        {/* Tab Navigation */}
                        <div className="mt-4 border-b border-secondary-200">
                          <nav className="-mb-px flex space-x-8">
                            <button
                              onClick={() => setActiveTab('sharepoint')}
                              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'sharepoint'
                                  ? 'border-create-500 text-create-600'
                                  : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                              }`}
                            >
                              <CloudIcon className="h-5 w-5 mr-2 inline" />
                              SharePoint
                            </button>
                            <button
                              onClick={() => setActiveTab('upload')}
                              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'upload'
                                  ? 'border-create-500 text-create-600'
                                  : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                              }`}
                            >
                              <DocumentIcon className="h-5 w-5 mr-2 inline" />
                              Upload Files
                            </button>
                          </nav>
                        </div>

                        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                          {/* Hub Name - Common */}
                          <div>
                            <label htmlFor="hub_name" className="block text-sm font-medium text-secondary-700">
                              Hub Name *
                            </label>
                            <input
                              type="text"
                              id="hub_name"
                              required
                              className="mt-1 input-field"
                              placeholder="Enter a unique name for your hub"
                              value={formData.hub_name}
                              onChange={(e) => setFormData(prev => ({ ...prev, hub_name: e.target.value }))}
                            />
                          </div>

                      {activeTab === 'sharepoint' ? (
                        <>
                          {/* SharePoint Link */}
                          <div>
                            <label htmlFor="sharepoint_link" className="block text-sm font-medium text-secondary-700">
                              SharePoint Link *
                            </label>
                            <input
                              type="url"
                              id="sharepoint_link"
                              required
                              className="mt-1 input-field"
                              placeholder="https://yourorg.sharepoint.com/sites/.../folder"
                              value={formData.sharepoint_link}
                              onChange={(e) => setFormData(prev => ({ ...prev, sharepoint_link: e.target.value }))}
                            />
                            <p className="mt-1 text-xs text-secondary-500">
                              Paste the SharePoint folder or file link you want to index
                            </p>
                          </div>

                          {/* Auto Sync */}
                          <div className="flex items-center">
                            <input
                              id="auto_sync"
                              type="checkbox"
                              className="h-4 w-4 text-primary-900 focus:ring-primary-800 border-secondary-300 rounded"
                              checked={formData.auto_sync}
                              onChange={(e) => setFormData(prev => ({ ...prev, auto_sync: e.target.checked }))}
                            />
                            <label htmlFor="auto_sync" className="ml-2 block text-sm text-secondary-900">
                              Enable automatic sync
                            </label>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* File Upload */}
                          <div>
                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                              Upload Files *
                            </label>
                            <div
                              {...getRootProps()}
                              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                                isDragActive
                                  ? 'border-primary-700 bg-primary-800'
                                  : 'border-secondary-300 hover:border-primary-700'
                              }`}
                            >
                              <input {...getInputProps()} />
                              <DocumentIcon className="mx-auto h-12 w-12 text-secondary-400" />
                              <p className="mt-2 text-sm text-secondary-600">
                                {isDragActive
                                  ? 'Drop the files here...'
                                  : 'Drag & drop files here, or click to select files'
                                }
                              </p>
                              <p className="mt-1 text-xs text-secondary-500">
                              Supports PDF, DOCX, Excel, ZIP, and TXT files
                              </p>
                            </div>

                            {/* Uploaded Files List */}
                            {uploadedFiles.length > 0 && (
                              <div className="mt-4 space-y-2">
                                <p className="text-sm font-medium text-secondary-700">
                                  Uploaded Files ({uploadedFiles.length})
                                </p>
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                  {uploadedFiles.map((file, index) => (
                                    <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between bg-secondary-50 rounded px-3 py-2">
                                      <span className="text-sm text-secondary-700 truncate">
                                        {file?.name || `File ${index + 1}`}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => removeFile(index)}
                                        className="text-red-600 hover:text-red-800 ml-2"
                                      >
                                        <XMarkIcon className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {/* Action Buttons */}
                          <div className="mt-6 flex justify-end space-x-3">
                            <button
                              type="button"
                              onClick={() => setCurrentStep('auth')}
                              className="btn-secondary"
                            >
                              Back
                            </button>
                            <button
                              type="button"
                              onClick={onClose}
                              className="btn-secondary"
                              disabled={isSubmitting}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSubmitting ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Creating...
                                </div>
                              ) : (
                                'Create Hub'
                              )}
                            </button>
                          </div>
                        </form>
                      </>
                    )}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}