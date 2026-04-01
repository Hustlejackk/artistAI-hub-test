const BASE = '/api'

async function request(url, options = {}) {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`)
  return data
}

export const api = {
  health: () => request('/health'),

  // Artists
  getArtists: () => request('/artists'),
  createArtist: (data) => request('/artists', { method: 'POST', body: data }),
  getArtist: (id) => request(`/artists/${id}`),
  updateArtist: (id, data) => request(`/artists/${id}`, { method: 'PUT', body: data }),
  deleteArtist: (id) => request(`/artists/${id}`, { method: 'DELETE' }),

  // Social
  addSocial: (id, data) => request(`/artists/${id}/social`, { method: 'POST', body: data }),

  // Streaming
  addStreaming: (id, data) => request(`/artists/${id}/streaming`, { method: 'POST', body: data }),

  // Releases
  addRelease: (id, data) => request(`/artists/${id}/releases`, { method: 'POST', body: data }),
  updateRelease: (id, rid, data) => request(`/artists/${id}/releases/${rid}`, { method: 'PUT', body: data }),
  deleteRelease: (id, rid) => request(`/artists/${id}/releases/${rid}`, { method: 'DELETE' }),

  // Promotions
  addPromotion: (id, data) => request(`/artists/${id}/promotions`, { method: 'POST', body: data }),
  updatePromotion: (id, pid, data) => request(`/artists/${id}/promotions/${pid}`, { method: 'PUT', body: data }),
  deletePromotion: (id, pid) => request(`/artists/${id}/promotions/${pid}`, { method: 'DELETE' }),

  // Notes
  addNote: (id, data) => request(`/artists/${id}/notes`, { method: 'POST', body: data }),
  deleteNote: (id, nid) => request(`/artists/${id}/notes/${nid}`, { method: 'DELETE' }),

  // Analysis
  generateAnalysis: (id) => request(`/artists/${id}/analyze`, { method: 'POST' }),
  getAnalysis: (id, aid) => request(`/artists/${id}/analyses/${aid}`),
}
