import { useEffect, useRef } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'

function VideoPlayer({ src, type = 'application/x-mpegURL', onError }) {
    const videoRef = useRef(null)
    const playerRef = useRef(null)

    useEffect(() => {
        if (!videoRef.current) return

        // Initialize Video.js player
        const player = videojs(videoRef.current, {
            controls: true,
            autoplay: false,
            preload: 'auto',
            fluid: true,
            responsive: true,
            html5: {
                vhs: {
                    overrideNative: true
                },
                nativeVideoTracks: false,
                nativeAudioTracks: false,
                nativeTextTracks: false
            }
        })

        playerRef.current = player

        // Set source
        player.src({
            src: src,
            type: type
        })

        // Handle errors
        player.on('error', () => {
            const error = player.error()
            console.error('Video.js error:', error)
            if (onError) {
                onError(error)
            }
        })

        // Cleanup
        return () => {
            if (playerRef.current) {
                playerRef.current.dispose()
                playerRef.current = null
            }
        }
    }, [src, type, onError])

    return (
        <div data-vjs-player>
            <video
                ref={videoRef}
                className="video-js vjs-big-play-centered vjs-theme-city"
            />
        </div>
    )
}

export default VideoPlayer
