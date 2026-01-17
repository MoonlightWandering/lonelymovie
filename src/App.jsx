import { useState, useEffect, useRef } from 'react'
import './App.css'
import VideoPlayer from './VideoPlayer'

const API_URL = 'http://127.0.0.1:8000'

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [error, setError] = useState(null)

  // Autocomplete state
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const debounceTimer = useRef(null)

  // Active streaming source (replaces both streamingSource and activePlayer)
  const [activeSource, setActiveSource] = useState('vidsrc.me')

  // Source availability tracking
  const [sourceStatus, setSourceStatus] = useState({})
  const [isPlayerLoading, setIsPlayerLoading] = useState(false)
  const loadingTimeoutRef = useRef(null)

  // Player mode: 'iframe' or 'direct'
  const [playerMode, setPlayerMode] = useState('iframe')
  const [streamData, setStreamData] = useState(null)
  const [isExtractingStream, setIsExtractingStream] = useState(false)

  // Custom player controls
  const [isTheatreMode, setIsTheatreMode] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const playerRef = useRef(null)

  // Available streaming sources
  const streamingSources = [
    { id: 'vidsrc.me', name: 'VidSrc.me', icon: '⚡', speed: 'Fastest' },
    { id: 'vidsrc.to', name: 'VidSrc.to', icon: '🚀', speed: 'Very Fast' },
    { id: 'embed.su', name: 'Embed.su', icon: '💨', speed: 'Fast' },
    { id: '2embed.cc', name: '2Embed', icon: '🎬', speed: 'Good' },
    { id: 'smashystream', name: 'Smashystream', icon: '🔥', speed: 'Fast' },
  ]

  // Load movie from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const movieId = params.get('movie')
    const source = params.get('source')

    if (movieId) {
      // Fetch movie details from IMDB ID
      fetchMovieById(movieId)
    }

    if (source && streamingSources.find(s => s.id === source)) {
      setActiveSource(source)
    }
  }, [])

  // Update URL when movie or source changes
  useEffect(() => {
    if (selectedMovie) {
      const params = new URLSearchParams()
      params.set('movie', selectedMovie.imdb_id)
      params.set('source', activeSource)

      // Update URL without page reload
      const newUrl = `${window.location.pathname}?${params.toString()}`
      window.history.pushState({}, '', newUrl)
    }
  }, [selectedMovie, activeSource])

  // Fetch movie details by IMDB ID (for direct URL access)
  const fetchMovieById = async (imdbId) => {
    try {
      // Create a movie object from IMDB ID
      // Since we don't have full details, we'll use the ID and let user see it
      const movieFromUrl = {
        title: `Movie ${imdbId}`,
        imdb_id: imdbId,
        year: null,
        url: `https://www.imdb.com/title/${imdbId}/`,
        type: 'movie'
      }
      setSelectedMovie(movieFromUrl)
    } catch (err) {
      console.error('Error loading movie from URL:', err)
    }
  }

  // Fetch autocomplete suggestions
  const fetchSuggestions = async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([])
      return
    }

    setIsLoadingSuggestions(true)

    try {
      const response = await fetch(`${API_URL}/api/autocomplete/${encodeURIComponent(query)}`)

      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
      } else {
        setSuggestions([])
      }
    } catch (err) {
      console.error('Autocomplete error:', err)
      setSuggestions([])
    } finally {
      setIsLoadingSuggestions(false)
    }
  }

  // Handle search input change with debouncing
  const handleSearchInputChange = (e) => {
    const value = e.target.value
    setSearchQuery(value)
    setShowSuggestions(true)

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    // Set new timer for autocomplete
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(value)
    }, 300) // 300ms delay
  }

  // Select a suggestion
  const selectSuggestion = (suggestion) => {
    setSearchQuery(suggestion.title)
    setShowSuggestions(false)
    setSuggestions([])
  }

  // Search for movie using FastAPI backend
  const handleSearch = async (e) => {
    e.preventDefault()

    if (!searchQuery.trim()) {
      setError('Please enter a movie name')
      return
    }

    setIsSearching(true)
    setError(null)
    setSearchResults([])

    try {
      const response = await fetch(`${API_URL}/api/search/${encodeURIComponent(searchQuery)}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Search failed')
      }

      const data = await response.json()
      setSearchResults(data.results)

      if (data.results.length === 0) {
        setError('No results found. Try a different search term.')
      }
    } catch (err) {
      setError(err.message || 'Failed to search. Make sure the backend server is running.')
      console.error('Search error:', err)
    } finally {
      setIsSearching(false)
    }
  }

  // Load selected movie
  const loadMovie = (movie) => {
    setSelectedMovie(movie)
    setShowSuggestions(false) // Hide autocomplete
    // Don't reset source - keep current selection or URL param

    // Scroll to player after a short delay to ensure it's rendered
    setTimeout(() => {
      playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  // Generate embed URL based on active streaming source
  const getEmbedUrl = (sourceId = activeSource) => {
    if (!selectedMovie || !selectedMovie.imdb_id) {
      return ''
    }

    const imdbId = selectedMovie.imdb_id
    const movieType = selectedMovie.type // 'movie' or 'tv'

    switch (sourceId) {
      case 'vidsrc.to':
        return movieType === 'tv'
          ? `https://vidsrc.to/embed/tv/${imdbId}/1/1`
          : `https://vidsrc.to/embed/movie/${imdbId}`

      case 'vidsrc.me':
        return movieType === 'tv'
          ? `https://vidsrc.me/embed/tv?imdb=${imdbId}&season=1&episode=1`
          : `https://vidsrc.me/embed/movie?imdb=${imdbId}`

      case 'embed.su':
        return movieType === 'tv'
          ? `https://embed.su/embed/tv/${imdbId}/1/1`
          : `https://embed.su/embed/movie/${imdbId}`

      case '2embed.cc':
        return `https://www.2embed.cc/embed/${imdbId}`

      case 'smashystream':
        return movieType === 'tv'
          ? `https://player.smashy.stream/tv/${imdbId}?s=1&e=1`
          : `https://player.smashy.stream/movie/${imdbId}`

      default:
        return `https://vidsrc.to/embed/movie/${imdbId}`
    }
  }

  // Handle player load start
  const handlePlayerLoadStart = (sourceId) => {
    setIsPlayerLoading(true)

    // Clear any existing timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }

    // Set timeout - if player doesn't load in 10 seconds, mark as potentially unavailable
    loadingTimeoutRef.current = setTimeout(() => {
      setSourceStatus(prev => ({
        ...prev,
        [sourceId]: 'timeout'
      }))
      setIsPlayerLoading(false)
    }, 10000) // 10 second timeout
  }

  // Handle player load success
  const handlePlayerLoad = (sourceId) => {
    setIsPlayerLoading(false)

    // Clear timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }

    // Mark source as working
    setSourceStatus(prev => ({
      ...prev,
      [sourceId]: 'loaded'
    }))
  }

  // Handle source change
  const handleSourceChange = (sourceId) => {
    setActiveSource(sourceId)
    handlePlayerLoadStart(sourceId)
  }

  // Mark source as not working (user reports)
  const markSourceAsNotWorking = (sourceId) => {
    setSourceStatus(prev => ({
      ...prev,
      [sourceId]: 'not-working'
    }))
  }
  // Get status indicator for a source
  const getSourceStatusIndicator = (sourceId) => {
    const status = sourceStatus[sourceId]
    if (!status) return null

    switch (status) {
      case 'loaded':
        return '✓'
      case 'timeout':
        return '⚠'
      case 'not-working':
        return '✗'
      default:
        return null
    }
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!playerRef.current) return

    if (!document.fullscreenElement) {
      playerRef.current.requestFullscreen().catch(err => {
        console.error('Fullscreen error:', err)
      })
    } else {
      document.exitFullscreen()
    }
  }

  // Toggle theatre mode
  const toggleTheatreMode = () => {
    setIsTheatreMode(!isTheatreMode)
    if (!isTheatreMode) {
      // Scroll to player
      playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // Copy current stream URL
  const copyStreamURL = () => {
    const url = getEmbedUrl(activeSource)
    navigator.clipboard.writeText(url)
    alert('Stream URL copied! 🎬')
  }

  // Extract M3U8 stream from source
  const extractStream = async () => {
    if (!selectedMovie?.imdb_id) return

    setIsExtractingStream(true)

    try {
      const response = await fetch(
        `${API_URL}/api/extract-stream/${selectedMovie.imdb_id}?source=${activeSource}`
      )

      if (response.ok) {
        const data = await response.json()

        if (data.stream_url && data.type !== 'iframe') {
          // Successfully extracted stream
          setStreamData(data)
          setPlayerMode('direct')
          alert(`✅ Direct stream found (${data.type.toUpperCase()})! Switching to native player...`)
        } else {
          // Extraction failed, stick with iframe
          alert('⚠️ Could not extract direct stream. Using iframe mode instead.')
        }
      } else {
        throw new Error('Extraction failed')
      }
    } catch (err) {
      console.error('Stream extraction error:', err)
      alert('❌ Failed to extract stream. Keeping iframe mode.')
    } finally {
      setIsExtractingStream(false)
    }
  }

  // Switch back to iframe mode
  const switchToIframeMode = () => {
    setPlayerMode('iframe')
    setStreamData(null)
  }

  // Get the source name for a player
  const getPlayerSourceName = (playerNumber) => {
    if (playerNumber === 1) {
      return streamingSources.find(s => s.id === activeSource)?.name || 'VidSrc.to'
    } else {
      const currentIndex = streamingSources.findIndex(s => s.id === activeSource)
      const nextIndex = (currentIndex + 1) % streamingSources.length
      return streamingSources[nextIndex]?.name || 'VidSrc.me'
    }
  }


  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="logo">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="8" fill="url(#gradient)" />
                <path d="M12 15L20 23L28 15" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <defs>
                  <linearGradient id="gradient" x1="0" y1="0" x2="40" y2="40">
                    <stop offset="0%" stopColor="#e50914" />
                    <stop offset="100%" stopColor="#b20710" />
                  </linearGradient>
                </defs>
              </svg>
              <h1 className="logo-text">LonelyMovie</h1>
            </div>
            <div className="header-actions">
              <span className="header-subtitle">AI-Powered Movie Search</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main">
        <div className="container">
          {/* Search Panel */}
          <section className="search-panel glass">
            <h2 className="section-title">Search Movies</h2>

            <form onSubmit={handleSearch} className="search-form">
              <div className="search-input-wrapper">
                <div className="search-input-container">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Enter movie name (e.g., Inception, The Matrix)..."
                    className="search-input"
                    disabled={isSearching}
                  />

                  {/* Autocomplete Dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="autocomplete-dropdown">
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={`${suggestion.tmdb_id}-${index}`}
                          type="button"
                          className="autocomplete-item"
                          onClick={() => selectSuggestion(suggestion)}
                        >
                          <span className="autocomplete-icon">
                            {suggestion.type === 'movie' ? '🎬' : '📺'}
                          </span>
                          <div className="autocomplete-info">
                            <span className="autocomplete-title">{suggestion.title}</span>
                            {suggestion.year && (
                              <span className="autocomplete-year">({suggestion.year})</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {isLoadingSuggestions && (
                    <div className="autocomplete-loading">
                      <span className="loading"></span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="search-button button-primary"
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <>
                      <span className="loading"></span>
                      Searching...
                    </>
                  ) : (
                    <>
                      🔍 Search
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Error Message */}
            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="search-results">
                <h3 className="results-title">Search Results for "{searchQuery}"</h3>
                <div className="results-grid">
                  {searchResults.map((movie, index) => (
                    <button
                      key={`${movie.imdb_id}-${index}`}
                      className={`result-item ${selectedMovie?.imdb_id === movie.imdb_id ? 'active' : ''}`}
                      onClick={() => loadMovie(movie)}
                    >
                      <div className="result-icon">🎬</div>
                      <div className="result-info">
                        <h4 className="result-title">{movie.title}</h4>
                        <div className="result-meta">
                          <span className="result-imdb">IMDB: {movie.imdb_id}</span>
                          {movie.year && <span className="result-year">{movie.year}</span>}
                        </div>
                      </div>
                      <div className="result-action">
                        {selectedMovie?.imdb_id === movie.imdb_id ? '✓ Playing' : 'Play'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Video Players Section */}
          {selectedMovie && (
            <section className="players-section">
              <div className="players-header">
                <h2 className="section-title">
                  Now Watching: {selectedMovie.title}
                  {selectedMovie.year && <span className="year-badge">({selectedMovie.year})</span>}
                </h2>
              </div>

              {/* 5 Streaming Source Tabs */}
              <div className="source-tabs">
                {streamingSources.map((source) => (
                  <button
                    key={source.id}
                    className={`source-tab ${activeSource === source.id ? 'active' : ''} ${sourceStatus[source.id] === 'not-working' ? 'unavailable' : ''}`}
                    onClick={() => handleSourceChange(source.id)}
                  >
                    <span className="source-tab-icon">{source.icon}</span>
                    <div className="source-tab-info">
                      <span className="source-tab-name">
                        {source.name}
                        {getSourceStatusIndicator(source.id) && (
                          <span className="status-indicator">{getSourceStatusIndicator(source.id)}</span>
                        )}
                      </span>
                      <span className="source-tab-speed">{source.speed}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Single Player with Custom Controls */}
              <div
                ref={playerRef}
                className={`custom-player-container ${isTheatreMode ? 'theatre-mode' : ''}`}
                onMouseEnter={() => setShowControls(true)}
                onMouseLeave={() => setShowControls(false)}
              >
                <div className="player-wrapper glass">
                  {isPlayerLoading && (
                    <div className="player-loading-overlay">
                      <div className="loading-spinner"></div>
                      <p>Loading {streamingSources.find(s => s.id === activeSource)?.name}...</p>
                    </div>
                  )}

                  {isExtractingStream && (
                    <div className="player-loading-overlay">
                      <div className="loading-spinner"></div>
                      <p>Extracting direct stream...</p>
                    </div>
                  )}

                  {/* Show Video.js player if direct mode and stream available */}
                  {playerMode === 'direct' && streamData?.stream_url ? (
                    <div className="direct-player">
                      <VideoPlayer
                        src={streamData.stream_url}
                        type={streamData.type === 'm3u8' ? 'application/x-mpegURL' : 'video/mp4'}
                        onError={() => {
                          alert('❌ Direct stream failed to load. Switching back to iframe...')
                          switchToIframeMode()
                        }}
                      />
                    </div>
                  ) : (
                    /* Show iframe player by default */
                    <iframe
                      key={`player-${selectedMovie.imdb_id}-${activeSource}`}
                      src={getEmbedUrl(activeSource)}
                      className="video-player"
                      frameBorder="0"
                      allowFullScreen
                      title={`Video Player - ${streamingSources.find(s => s.id === activeSource)?.name}`}
                      onLoad={() => handlePlayerLoad(activeSource)}
                    />
                  )}

                  {sourceStatus[activeSource] === 'timeout' && (
                    <div className="player-error-message">
                      ⚠️ This source is taking longer than usual to load. Try another source.
                    </div>
                  )}

                  {sourceStatus[activeSource] === 'not-working' && (
                    <div className="player-error-message error">
                      ✗ This source was reported as not working. Try another source.
                    </div>
                  )}

                  {/* Custom Player Controls Overlay */}
                  <div className={`custom-controls-overlay ${showControls ? 'visible' : ''}`}>
                    {/* Top Bar - Stream Info */}
                    <div className="controls-top-bar">
                      <div className="stream-info">
                        <span className="stream-badge">
                          {streamingSources.find(s => s.id === activeSource)?.icon}
                          {streamingSources.find(s => s.id === activeSource)?.name}
                          {playerMode === 'direct' && <span className="direct-badge">DIRECT</span>}
                        </span>
                        <span className="stream-quality">
                          {playerMode === 'direct' ? streamData?.type?.toUpperCase() : 'HD'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Bar - Action Buttons */}
                    <div className="controls-bottom-bar">
                      <div className="controls-left">
                        {playerMode === 'iframe' ? (
                          <button
                            className="control-btn extract-btn"
                            onClick={extractStream}
                            disabled={isExtractingStream}
                            title="Extract & Play Direct Stream"
                          >
                            📡
                          </button>
                        ) : (
                          <button
                            className="control-btn"
                            onClick={switchToIframeMode}
                            title="Back to Iframe"
                          >
                            ◀️
                          </button>
                        )}
                        <button
                          className="control-btn"
                          onClick={() => markSourceAsNotWorking(activeSource)}
                          title="Report Issue"
                        >
                          ⚠️
                        </button>
                        <button
                          className="control-btn"
                          onClick={copyStreamURL}
                          title="Copy Stream URL"
                        >
                          🔗
                        </button>
                      </div>

                      <div className="controls-right">
                        <button
                          className="control-btn"
                          onClick={toggleTheatreMode}
                          title={isTheatreMode ? 'Exit Theatre Mode' : 'Theatre Mode'}
                        >
                          {isTheatreMode ? '🖼️' : '🎭'}
                        </button>
                        <button
                          className="control-btn"
                          onClick={toggleFullscreen}
                          title="Fullscreen"
                        >
                          ⛶
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Movie Info */}
              <div className="movie-info glass">
                <div className="info-item">
                  <span className="info-label">IMDB ID:</span>
                  <a
                    href={selectedMovie.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="info-value link"
                  >
                    {selectedMovie.imdb_id}
                  </a>
                </div>
                <div className="info-item">
                  <span className="info-label">Type:</span>
                  <span className="info-value">{selectedMovie.type === 'movie' ? 'Movie' : 'TV Show'}</span>
                </div>
                <div className="info-item">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href)
                      alert('Link copied! Share with friends 🎬')
                    }}
                    className="share-button button-secondary"
                  >
                    🔗 Share Link
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Info Section */}
          <section className="info-section glass">
            <h3>How to Use</h3>
            <div className="info-grid">
              <div className="info-card">
                <div className="info-icon">🔍</div>
                <h4>Search by Name</h4>
                <p className="text-secondary">Enter any movie name and our AI will find it on IMDB automatically</p>
              </div>
              <div className="info-card">
                <div className="info-icon">🤖</div>
                <h4>Powered by AI</h4>
                <p className="text-secondary">Uses Google Search to intelligently extract IMDB information</p>
              </div>
              <div className="info-card">
                <div className="info-icon">🎬</div>
                <h4>5 Streaming Sources</h4>
                <p className="text-secondary">Switch between VidSrc.to, VidSrc.me, Embed.su, 2Embed, and Smashystream for best quality</p>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p className="text-muted">
            Powered by 5 premium streaming sources •
            Backend: FastAPI with IMDB Scraping •
            <a href="http://localhost:8000/docs" target="_blank" rel="noopener noreferrer">API Docs</a>
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
