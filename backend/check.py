import requests
import json

headers = {
    'x-tenant-id': 'rishabhkushwaha2001-hue/whataspp'
}
try:
    res = requests.get('http://localhost:8000/api/v1/seats/debug_s11_s12', headers=headers)
    print(json.dumps(res.json(), indent=2))
except Exception as e:
    print('Exception:', e)
