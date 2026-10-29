import subprocess, time, urllib.request, os, sys

base = os.path.dirname(os.path.abspath(__file__))
server = subprocess.Popen(['node', 'server.js'], cwd=base, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
time.sleep(2)
try:
    # health: GET /
    with urllib.request.urlopen('http://127.0.0.1:3000/', timeout=5) as r:
        assert r.status == 200, r.status
    # empty file -> 400
    import urllib.request as u
    boundary = '----WebKitFormBoundary'
    body = ('--' + boundary + '\r\nContent-Disposition: form-data; name="image"; filename="empty.png"\r\nContent-Type: image/png\r\n\r\n\r\n--' + boundary + '--\r\n').encode()
    req = u.Request('http://127.0.0.1:3000/api/embed', data=body)
    req.add_header('Content-Type', 'multipart/form-data; boundary=' + boundary)
    try:
        u.urlopen(req, timeout=5)
        print('FAIL: empty file did not error'); sys.exit(1)
    except u.HTTPError as e:
        assert e.code == 400, e.code
    print('VALIDATE OK')
finally:
    server.terminate()
    server.wait(timeout=5)
