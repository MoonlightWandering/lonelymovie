---
title: LonelyMovie AI Streamer
emoji: 🎬
colorFrom: red
colorTo: gray
sdk: docker
pinned: false
app_port: 7860
---

# LonelyMovie - Full-Stack AI-Powered Video Streaming 🎬🤖

An advanced video streaming application that uses AI (Google Search) to find movies and Playwright to extract high-quality streams from multiple sources.

## Features
- **AI-Powered Search**: Finds movies without an internal database.
- **Smart Stream Extraction**: Uses Playwright & HAR recording to find hidden M3U8 streams.
- **Dual Player Mode**: Direct M3U8 playback (Video.js) or Iframe fallback.
- **Source Switching**: 5 premium sources (VidSrc.me, VidSrc.to, Embed.su, etc.).
- **Stealth Mode**: Bypasses anti-bot protections.

## Deployment (Hugging Face Spaces / Docker)
This project is configured for **DOCKER** deployment.

1. Create a new Space.
2. Select **Docker** as the SDK.
3. Push this repository.
4. The endpoint will be available at port 7860.

**Note**: Playwright requires a significant amount of RAM. If you see crashes, you may need a larger hardware tier.
