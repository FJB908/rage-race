#!/usr/bin/env python3
"""Cache-bust: puts ?v=<time> on every local script/stylesheet in index.html so phones always fetch the newest files. Run before committing."""
import re, time, pathlib
p = pathlib.Path(__file__).resolve().parent.parent / 'index.html'
s = p.read_text()
v = time.strftime('%m%d%H%M')
s = re.sub(r'((?:src|href)="(?:src/[^"?]+|game)\.(?:js|css))(?:\?v=\w+)?"', lambda m: m.group(1) + '?v=' + v + '"', s)
s = re.sub(r'((?:src|href)="(?:src/[^"?]+|game)\.(?:js|css))(?:\?v=\w+)?"', lambda m: m.group(1) + '?v=' + v + '"', s)
p.write_text(s)
print('index.html version', v)
