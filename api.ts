// lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

export const apiClient = {
  async get(endpoint: string) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`)
    return response
  },

  async post(endpoint: string, data?: any) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    })
    return response
  },

  async delete(endpoint: string) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
    })
    return response
  },

  async upload(endpoint: string, formData: FormData) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      body: formData,
    })
    return response
  },
}
