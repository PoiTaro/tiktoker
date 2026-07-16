import urllib.request
import urllib.parse
import re
import ssl
import os

ssl_context = ssl._create_unverified_context()

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

queries = {
    "images/real_orbis_wash.jpg": "オルビス ミスター フォーミングウォッシュ",
    "images/real_orbis_lotion.jpg": "オルビス ミスター エッセンスローション",
    "images/real_melanocc.jpg": "メラノCC 薬用しみ 集中対策 プレミアム美容液",
    "images/real_pairacne.jpg": "ペアアクネクリームW 24g ライオン"
}

os.makedirs("images", exist_ok=True)

for filepath, query in queries.items():
    print(f"Searching Yahoo Shopping for: {query} -> {filepath}")
    encoded_q = urllib.parse.quote(query)
    search_url = f"https://shopping.yahoo.co.jp/search?p={encoded_q}"
    
    try:
        req = urllib.request.Request(search_url, headers=headers)
        with urllib.request.urlopen(req, context=ssl_context, timeout=10) as res:
            html = res.read().decode('utf-8', errors='ignore')
            # Yahoo Shopping item image links typically look like https://item-shopping.c.yimg.jp/i/l/store_itemid or similar
            # Let's find images from c.yimg.jp
            img_matches = re.findall(r'https://item-shopping\.c\.yimg\.jp/i/[a-z0-9_/-]+', html)
            if not img_matches:
                img_matches = re.findall(r'https://[a-zA-Z0-9_/-]+\.c\.yimg\.jp/[a-zA-Z0-9_/-]+\.(?:jpg|png)', html)
            
            if img_matches:
                # Pick the first good high-res match (change /g/ or /j/ or /l/ to /l/ if possible for large)
                target_img = img_matches[0]
                if '/i/' in target_img and not target_img.endswith('.jpg'):
                    target_img += '.jpg'
                
                # Replace medium/small size with large 'l' if it follows /i/m/ format
                target_img = re.sub(r'/i/[sjm]/', '/i/l/', target_img)
                
                print(f"Found image URL: {target_img}")
                img_req = urllib.request.Request(target_img, headers=headers)
                with urllib.request.urlopen(img_req, context=ssl_context, timeout=10) as img_res:
                    with open(filepath, 'wb') as out:
                        out.write(img_res.read())
                    print(f"[SUCCESS] Downloaded real product image to {filepath}")
            else:
                print(f"[FAIL] No image matches found on search page for {query}")
    except Exception as e:
        print(f"[ERROR] {filepath}: {e}")
