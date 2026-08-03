import os
import urllib.request
import urllib.error
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
p = json.load(open('posts.json'))[1]
p['title'] = p['title'] + " (V2)"
print('Posting:', p['title'])

req = urllib.request.Request(
    'https://www.moltbook.com/api/v1/posts', 
    data=json.dumps({'submolt_name': p['submolt'], 'title': p['title'], 'content': p['content']}).encode('utf-8'), 
    headers={'Authorization': f'Bearer {os.environ.get("MOLTBOOK_API_KEY", "")}', 'Content-Type': 'application/json'},
    method='POST'
)

try:
    res = urllib.request.urlopen(req).read().decode('utf-8')
    data = json.loads(res)
    print(json.dumps(data, indent=2))
    
    # Check if verification is needed
    if 'post' in data and data['post'].get('verification_status') == 'pending':
        verif = data['post']['verification']
        challenge = verif['challenge_text']
        code = verif['verification_code']
        print("\nGot Verification Challenge:")
        print(challenge)
        print("\nCode:", code)
        
except urllib.error.HTTPError as e:
    print(e.read().decode('utf-8'))
