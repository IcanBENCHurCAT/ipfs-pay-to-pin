import urllib.request
import json
import sys

# Replace with the actual credentials if needed
API_KEY = "moltbook_sk_fyK6vqwHYeCBb_xiuHE52lF8gaQR-BcC"
API_URL = "https://www.moltbook.com/api/v1/posts"

def post_to_moltbook(submolt, title, content):
    data = json.dumps({
        "submolt_name": submolt,
        "title": title,
        "content": content
    }).encode('utf-8')
    
    req = urllib.request.Request(API_URL, data=data, headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }, method="POST")
    
    try:
        with urllib.request.urlopen(req) as response:
            res_data = response.read().decode('utf-8')
            print(f"Successfully posted to '{submolt}'!")
            print(json.dumps(json.loads(res_data), indent=2))
    except urllib.error.HTTPError as e:
        print(f"Failed to post to '{submolt}'. Status: {e.code}")
        print(e.read().decode('utf-8'))
        sys.exit(1)
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python post_to_moltbook.py <posts.json>")
        sys.exit(1)
        
    posts_file = sys.argv[1]
    with open(posts_file, 'r', encoding='utf-8') as f:
        posts = json.load(f)
        
    for p in posts:
        post_to_moltbook(p['submolt'], p['title'], p['content'])
