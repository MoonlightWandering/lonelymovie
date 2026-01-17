import requests
from bs4 import BeautifulSoup
from urllib.parse import quote
import json

query = "Inception"
search_url = f"https://www.imdb.com/find/?q={quote(query)}&s=tt&ttype=ft&ref_=fn_ft"

headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

response = requests.get(search_url, headers=headers, timeout=10)
soup = BeautifulSoup(response.text, 'lxml')

next_data_script = soup.find('script', id='__NEXT_DATA__', type='application/json')

if next_data_script:
    data = json.loads(next_data_script.string)
    
    # Save the full JSON for inspection
    with open('/tmp/imdb_json.json', 'w') as f:
        json.dump(data, f, indent=2)
    print("Full JSON saved to /tmp/imdb_json.json")
    
    # Print the structure
    print("\n===Page Props Structure===")
    page_props = data.get('props', {}).get('pageProps', {})
    print(f"Available keys in pageProps: {list(page_props.keys())}")
    
    # Check each key
    for key in page_props.keys():
        value = page_props[key]
        print(f"\n{key}: {type(value)}")
        if isinstance(value, dict):
            print(f"  Dict keys: {list(value.keys())[:10]} ...")
        elif isinstance(value, list):
            print(f"  List length: {len(value)}")
            if len(value) > 0:
                print(f"  First item type: {type(value[0])}")
                if isinstance(value[0], dict):
                    print(f"  First item keys: {list(value[0].keys())}")
else:
    print("No __NEXT_DATA__ found!")
