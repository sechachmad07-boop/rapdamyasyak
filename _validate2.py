import subprocess, time, os, sys, urllib.request, json

base = os.path.dirname(os.path.abspath(__file__))
node_script = "const sharp=require('sharp'); sharp({create:{width:128,height:128,channels:3,background:{r:100,g:150,b:200}}}).png().toFile('testimg_validate.png').then(()=>console.log('done'));"
subprocess.run(['node', '-e', node_script], cwd=base, check=True, capture_output=True)
with open(os.path.join(base, 'testimg_validate.png'), 'rb') as f:
    png = f.read()

def field(name, value):
    return ('--{b}\r\nContent-Disposition: form-data; name="{n}"\r\n\r\n{v}\r\n'.format(b=BOUNDARY, n=name, v=value)).encode()

BOUNDARY = '----WebKitFormBoundary2'
server = subprocess.Popen(['node', 'server.js'], cwd=base, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
time.sleep(2)
try:
    body = ('--' + BOUNDARY + '\r\n'
            'Content-Disposition: form-data; name="image"; filename="t.png"\r\n'
            'Content-Type: image/png\r\n\r\n').encode() + png + b'\r\n' + field('message', 'hi') + field('strength', '30') + ('--' + BOUNDARY + '--\r\n').encode()
    req = urllib.request.Request('http://127.0.0.1:3000/api/embed', data=body)
    req.add_header('Content-Type', 'multipart/form-data; boundary=' + BOUNDARY)
    with urllib.request.urlopen(req, timeout=10) as r:
        assert r.status == 200, r.status
        out = r.read()
        assert len(out) > 0

    body2 = ('--' + BOUNDARY + '\r\n'
             'Content-Disposition: form-data; name="image"; filename="t.png"\r\n'
             'Content-Type: image/png\r\n\r\n').encode() + png + b'\r\n' + field('message', 'hi') + field('quality', '70') + field('strength', '30') + ('--' + BOUNDARY + '--\r\n').encode()
    req2 = urllib.request.Request('http://127.0.0.1:3000/api/test-jpeg', data=body2)
    req2.add_header('Content-Type', 'multipart/form-data; boundary=' + BOUNDARY)
    with urllib.request.urlopen(req2, timeout=10) as r:
        j = json.loads(r.read())
        print('test-jpeg:', j)
        assert j['success'] is True, j
    print('VALIDATE2 OK')
finally:
    server.terminate()
    server.wait(timeout=5)
