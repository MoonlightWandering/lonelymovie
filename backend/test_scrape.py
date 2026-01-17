import requests
from bs4 import BeautifulSoup
from urllib.parse import quote

query = "Inception"
search_url = f"https://www.imdb.com/find/?q={quote(query)}&s=tt&ttype=ft&ref_=fn_ft"

headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
}

response = requests.get(search_url, headers=headers, timeout=10)
print(f"Status: {response.status_code}")
print(f"URL: {response.url}")
print("\n=== HTML Preview (first 2000 chars) ===")
print(response.text[:2000])

# Save full HTML to a file for inspection
with open('/tmp/imdb_response.html', 'w') as f:
    f.write(response.text)
print("\nFull HTML saved to /tmp/imdb_response.html")
