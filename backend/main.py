from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import re
import aiohttp
import asyncio
from bs4 import BeautifulSoup
from urllib.parse import quote
import requests

app = FastAPI(title="LonelyMovie API", version="1.0.0")

# CORS middleware to allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MovieSearchResult(BaseModel):
    title: str
    imdb_id: Optional[str] = None
    year: Optional[str] = None
    url: str
    type: str = "movie"

class SearchResponse(BaseModel):
    results: List[MovieSearchResult]
    query: str

def extract_imdb_id(url: str) -> Optional[str]:
    """Extract IMDB ID from IMDB URL"""
    # IMDB URLs typically look like: https://www.imdb.com/title/tt1234567/
    match = re.search(r'/title/(tt\d+)', url)
    if match:
        return match.group(1)
    return None

def extract_title_and_year(title_text: str) -> tuple[str, Optional[str]]:
    """Extract movie title and year from text"""
    # Try to extract year in parentheses
    year_match = re.search(r'\((\d{4})\)', title_text)
    year = year_match.group(1) if year_match else None
    
    # Remove year from title
    title = re.sub(r'\s*\(\d{4}\)', '', title_text).strip()
    
    return title, year



@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

@app.get("/api/search/{query}", response_model=SearchResponse)
async def search_movie(query: str, limit: int = 10):
    """
    Search for a movie by scraping IMDB search results directly
    
    Args:
        query: Movie name to search for
        limit: Maximum number of results to return (default: 10)
    
    Returns:
        SearchResponse with list of movie results
    """
    try:
        results = []
        
        # IMDB search URL
        search_url = f"https://www.imdb.com/find/?q={quote(query)}&s=tt&ttype=ft&ref_=fn_ft"
        
        # Headers to mimic a browser request
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
        }
        
        try:
            # Make request to IMDB
            response = requests.get(search_url, headers=headers, timeout=10)
            response.raise_for_status()
            
            # IMDB uses Next.js with data in __NEXT_DATA__ script tag
            soup = BeautifulSoup(response.text, 'lxml')
            
            # Find the __NEXT_DATA__ script tag
            next_data_script = soup.find('script', id='__NEXT_DATA__', type='application/json')
            
            if next_data_script:
                import json
                data = json.loads(next_data_script.string)
                
                # Navigate to search results in the JSON structure
                try:
                    # The structure is: props.pageProps.titleResults.results 
                    page_props = data.get('props', {}).get('pageProps', {})
                    title_results = page_props.get('titleResults', {})
                    search_results = title_results.get('results', [])
                    
                    for item in search_results[:limit]:
                        try:
                            # IMDB ID is in 'index' field
                            imdb_id = item.get('index', '')
                            
                            # Title data is nested in 'listItem'
                            list_item = item.get('listItem', {})
                            title = list_item.get('titleText', list_item.get('originalTitleText', ''))
                            
                            # Year
                            year_str = str(list_item.get('releaseYear', '')) if list_item.get('releaseYear') else None
                            
                            # Media type
                            title_type = list_item.get('titleType', {})
                            type_id = title_type.get('id', 'movie')
                            media_type = "tv" if type_id in ['tvSeries', 'tvMiniSeries', 'tvSpecial'] else "movie"
                            
                            if title and imdb_id:
                                result = MovieSearchResult(
                                    title=title,
                                    imdb_id=imdb_id,
                                    year=year_str,
                                    url=f"https://www.imdb.com/title/{imdb_id }/",
                                    type=media_type
                                )
                                results.append(result)
                                
                        except Exception as parse_error:
                            print(f"Error parsing JSON result: {parse_error}")
                            continue
                    
                except Exception as json_error:
                    print(f"Error navigating JSON structure: {json_error}")
                    # Print the available keys for debugging
                    print(f"Available keys in pageProps: {page_props.keys() if page_props else 'None'}")
            
            # If no results from JSON, return empty
            if not results:
                print("No results found in JSON data")
               
        except requests.RequestException as req_error:
            print(f"Request error: {req_error}")
            return SearchResponse(results=[], query=query)
        except Exception as scrape_error:
            print(f"Scraping error: {scrape_error}")
            import traceback
            traceback.print_exc()
            return SearchResponse(results=[], query=query)
        
        return SearchResponse(results=results, query=query)
        
    except Exception as e:
        print(f"Error in search endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error searching for movie: {str(e)}"
        )



@app.get("/api/autocomplete/{query}")
async def autocomplete_movie(query: str, limit: int = 5):
    """
    Get movie suggestions for autocomplete using TMDB API
    
    Args:
        query: Partial movie name to search for
        limit: Maximum number of suggestions (default: 5)
    
    Returns:
        List of movie suggestions
    """
    try:
        if len(query) < 2:
            return {"suggestions": []}
        
        # TMDB API endpoint for search
        # Note: This is a free endpoint that doesn't require API key for basic searches
        # But for production, you should use your own API key
        tmdb_url = f"https://api.themoviedb.org/3/search/multi?query={query}&include_adult=false&language=en-US&page=1"
        
        async with aiohttp.ClientSession() as session:
            # Using TMDB without API key (limited functionality)
            # For better results, get a free API key from https://www.themoviedb.org/settings/api
            headers = {
                "accept": "application/json",
                # Add your TMDB API key here if you have one:
                # "Authorization": "Bearer YOUR_TMDB_API_KEY"
            }
            
            try:
                async with session.get(tmdb_url, headers=headers, timeout=5) as response:
                    if response.status == 200:
                        data = await response.json()
                        suggestions = []
                        
                        for item in data.get("results", [])[:limit]:
                            title = item.get("title") or item.get("name", "Unknown")
                            year = None
                            
                            release_date = item.get("release_date") or item.get("first_air_date")
                            if release_date:
                                year = release_date.split("-")[0]
                            
                            media_type = item.get("media_type", "movie")
                            
                            suggestions.append({
                                "title": title,
                                "year": year,
                                "type": media_type,
                                "tmdb_id": item.get("id")
                            })
                        
                        return {"suggestions": suggestions, "query": query}
            except Exception as tmdb_error:
                print(f"TMDB API error: {tmdb_error}")
                # Return empty suggestions if TMDB fails
                return {"suggestions": [], "query": query}
        
        return {"suggestions": [], "query": query}
        
    except Exception as e:
        print(f"Autocomplete error: {str(e)}")
        return {"suggestions": [], "query": query}


@app.get("/api/imdb/{imdb_id}")
async def get_imdb_info(imdb_id: str):
    """
    Get movie information from IMDB ID
    
    Args:
        imdb_id: IMDB ID (e.g., tt1234567)
    
    Returns:
        Movie information including embed URL
    """
    try:
        # Validate IMDB ID format
        if not re.match(r'^tt\d+$', imdb_id):
            raise HTTPException(
                status_code=400,
                detail="Invalid IMDB ID format. Should be like 'tt1234567'"
            )
        
        # Generate 2embed.cc URL using IMDB ID
        # 2embed.cc supports IMDB IDs directly
        embed_url = f"https://www.2embed.cc/embed/{imdb_id}"
        
        return {
            "imdb_id": imdb_id,
            "embed_url": embed_url,
            "imdb_url": f"https://www.imdb.com/title/{imdb_id}/"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting IMDB info: {str(e)}"
        )



@app.get("/api/extract-stream/{imdb_id}")
async def extract_stream_url(imdb_id: str, source: str = "vidsrc.me"):
    """
    Extract direct stream URL using intelligent M3U8 sniffer with Playwright
    
    Features:
    - Network request interception
    - Smart URL filtering and ranking
    - Quality-based stream selection
    - Duplicate detection
    """
    try:
        # Validate IMDB ID
        if not re.match(r'^tt\d+$', imdb_id):
            raise HTTPException(status_code=400, detail="Invalid IMDB ID format")
        
        embed_url = get_embed_url_for_source(source, imdb_id)
        
        from playwright.async_api import async_playwright
        
        # Smart M3U8 Sniffer
        captured_urls = []
        
        def is_valid_stream_url(url: str) -> bool:
            """Filter out invalid/junk URLs"""
            url_lower = url.lower()
            
            # Reject patterns
            reject_patterns = [
                'blob:', 'data:', 'chrome-extension:',
                'about:', 'javascript:',
                '.js', '.css', '.json', '.xml',
                '.woff', '.ttf', '.svg', '.ico',
                '/api/', '/track', '/log', '/analytics',
                'google', 'facebook', 'tracker'
            ]
            
            if any(pattern in url_lower for pattern in reject_patterns):
                return False
            
            # Accept patterns
            accept_patterns = ['.m3u8', '.mp4', '.mkv', '.webm', '.ts']
            
            return any(pattern in url_lower for pattern in accept_patterns)
        
        def rank_stream_url(url: str) -> int:
            """Rank stream URLs by quality indicators (higher = better)"""
            score = 0
            url_lower = url.lower()
            
            # Prefer M3U8 (adaptive streaming)
            if '.m3u8' in url_lower:
                score += 100
                
                # Quality indicators in M3U8
                if 'master' in url_lower or 'playlist' in url_lower:
                    score += 50
                if '1080' in url_lower or 'fhd' in url_lower:
                    score += 30
                elif '720' in url_lower or 'hd' in url_lower:
                    score += 20
                elif '480' in url_lower:
                    score += 10
            
            # MP4 is good but less flexible
            elif '.mp4' in url_lower:
                score += 80
                if '1080' in url_lower:
                    score += 25
                elif '720' in url_lower:
                    score += 15
            
            # Other formats
            elif '.mkv' in url_lower:
                score += 70
            elif '.webm' in url_lower:
                score += 60
            elif '.ts' in url_lower:
                score += 40  # Transport stream segments
            
            # CDN/reliable hosts (bonus points)
            reliable_hosts = ['cloudflare', 'akamai', 'fastly', 'bunny', 'cloudfront']
            if any(host in url_lower for host in reliable_hosts):
                score += 20
            
            # Long URLs often indicate proper streams
            if len(url) > 100:
                score += 10
            
            return score
        
        # Anti-detection: Randomize to avoid fingerprinting
        import random
        import os
        
        user_agents = [
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        ]
        
        # Retry logic for better reliability
        max_retries = 2
        for attempt in range(max_retries):
            print(f"🔄 Extraction attempt {attempt + 1}/{max_retries}...")
            
            captured_urls = []
            har_path = f"/tmp/lonelymovie_requests_{imdb_id}_{attempt}.har"
            
            try:
                async with async_playwright() as p:
                    browser = await p.chromium.launch(
                        headless=True,
                        args=[
                            '--no-sandbox',
                            '--disable-dev-shm-usage',
                            '--disable-blink-features=AutomationControlled',
                            '--disable-web-security',
                            '--disable-features=IsolateOrigins,site-per-process',
                        ]
                    )
                    
                    # Fresh context with HAR recording enabled
                    context = await browser.new_context(
                        viewport={'width': 1920, 'height': 1080},
                        user_agent=random.choice(user_agents),
                        locale='en-US',
                        timezone_id='America/New_York',
                        storage_state=None,
                        java_script_enabled=True,
                        record_har_path=har_path,
                        record_har_content='omit'
                    )
                    
                    # Manual stealth - hide automation
                    await context.add_init_script("""
                        Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                        Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
                        Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
                        window.chrome = {runtime: {}};
                    """)
                    
                    page = await context.new_page()
                    
                    try:
                        print(f"📡 Loading: {embed_url}")
                        await page.goto(embed_url, wait_until='domcontentloaded', timeout=20000)
                        
                        # Random delay
                        await page.wait_for_timeout(random.randint(2000, 4000))
                        
                        print("🎬 Looking for play button...")
                        play_clicked = False
                        
                        play_selectors = [
                            'button.vjs-big-play-button',
                            '.vjs-big-play-button',
                            'button[aria-label*="Play" i]',
                            'button[aria-label*="play" i]',
                            '.plyr__control--overlaid',
                            'button.play-button',
                            'button.play',
                            '.play-overlay',
                            '[class*="play"][class*="button"]',
                            'video',
                        ]
                        
                        for selector in play_selectors:
                            try:
                                element = await page.query_selector(selector)
                                if element:
                                    print(f"  ✓ Found: {selector}")
                                    await element.click(timeout=2000)
                                    play_clicked = True
                                    break
                            except:
                                continue
                        
                        if not play_clicked:
                            try:
                                print("  → Clicking center of page...")
                                await page.mouse.click(960, 540)
                                play_clicked = True
                            except:
                                pass
                        
                        if play_clicked:
                            print("✅ Play button clicked!")
                            await page.wait_for_timeout(8000)
                            print("⏳ Waiting for stream requests...")
                            await page.wait_for_timeout(5000)
                        else:
                            print("⚠️ Could not click play, waiting anyway...")
                            await page.wait_for_timeout(10000)
                            
                    except Exception as e:
                        print(f"⚠️ Page error: {e}")
                    finally:
                        await context.close()
                        await browser.close()
                
                # Parse HAR
                if os.path.exists(har_path):
                    try:
                        import json
                        with open(har_path, "r") as f:
                            har_data = json.load(f)
                        
                        for entry in har_data.get("log", {}).get("entries", []):
                            url = entry.get("request", {}).get("url", "")
                            if is_valid_stream_url(url):
                                captured_urls.append(url)
                                
                        # Cleanup HAR file
                        os.remove(har_path)
                    except Exception as e:
                        print(f"⚠️ HAR parsing error: {e}")
                
                if captured_urls:
                    print(f"✅ Successful capture on attempt {attempt + 1}!")
                    break
                else:
                    print(f"❌ Failed attempt {attempt + 1}, retrying...")
                    import asyncio
                    await asyncio.sleep(2)
                    
            except Exception as e:
                print(f"❌ Attempt {attempt + 1} failed with error: {e}")
                import asyncio
                await asyncio.sleep(2)
        
        # Process results after retries
        unique_urls = list(set(captured_urls))
        ranked_urls = sorted(unique_urls, key=rank_stream_url, reverse=True)
        
        if not ranked_urls:
            return {
                "stream_url": None,
                "type": "iframe",
                "message": "No streams detected after retries"
            }
            
        print(f"🏆 Best stream: {ranked_urls[0][:100]}...")
        best_url = ranked_urls[0]
        stream_type = 'm3u8' if '.m3u8' in best_url.lower() else 'mp4'
        
        return {
            "stream_url": best_url,
            "type": stream_type,
            "source": source,
            "alternatives": ranked_urls[1:min(3, len(ranked_urls))]
        }
    
    except Exception as e:
        print(f"❌ Extraction error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


def get_embed_url_for_source(source: str, imdb_id: str) -> str:
    """Generate embed URL for a given source"""
    urls = {
        'vidsrc.me': f'https://vidsrc.me/embed/movie?imdb={imdb_id}',
        'vidsrc.to': f'https://vidsrc.to/embed/movie/{imdb_id}',
        'embed.su': f'https://embed.su/embed/movie/{imdb_id}',
        '2embed.cc': f'https://www.2embed.cc/embed/{imdb_id}',
        'smashystream': f'https://player.smashy.stream/movie/{imdb_id}'
    }
    return urls.get(source, urls['vidsrc.me'])

# Serve React Frontend (Static Files)
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# API Health Check
@app.get("/api")
async def api_root():
    """API Root endpoint"""
    return {
        "message": "LonelyMovie API",
        "version": "1.0.0",
        "endpoints": {
            "search": "/api/search/{query}",
            "autocomplete": "/api/autocomplete/{query}",
            "health": "/api"
        }
    }

# Mount static files if directory exists (Docker/Production)
static_dir = "static"
if os.path.exists(static_dir):
    app.mount("/assets", StaticFiles(directory=f"{static_dir}/assets"), name="assets")
    
    # Explicit route for root to serve index.html
    @app.get("/")
    async def serve_root():
        return FileResponse(f"{static_dir}/index.html")

    # Catch-all route for SPA (React Router) - catch everything else
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        # Allow API calls to pass through
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
            
        # Serve index.html for all other routes
        return FileResponse(f"{static_dir}/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
