#!/usr/bin/env python3
"""MarkdownDrift oracle: runs the real python-markdown 3.x on every corpus case
and derives the Python-Markdown flavor label for each construct the engine must
report. Writes expected.json. Exits non-zero if the corpus disagrees with the
engine's static PM labels (i.e. PM changed behavior or we mislabeled)."""
import json, re, sys, os
import markdown as md

BASE = os.path.dirname(__file__)
cases = json.load(open(f'{BASE}/cases.json'))

def pm_labels(html, kinds):
    out = {}
    for k in kinds:
        if k == 'intraword-underscore':
            out[k] = 'em' if '<em>' in html else 'literal'
        elif k == 'hash-no-space':
            out[k] = 'heading' if re.search(r'<h[1-6]>', html) else 'paragraph'
        elif k in ('ordered-paren','ordered-interrupt-2plus','ordered-interrupt-1'):
            out[k] = 'list' if '<ol>' in html else 'paragraph'
        elif k == 'ordered-start':
            out[k] = 'list-start-N' if re.search(r'<ol[^>]*start=', html) else ('list-no-start' if '<ol>' in html else 'paragraph')
        elif k == 'fence':
            out[k] = 'code-block' if '<pre><code' in html else ('inline-code-span' if '<code>' in html else 'literal')
        elif k == 'bare-url':
            out[k] = 'link' if '<a href="http' in html else 'literal'
        elif k == 'strikethrough':
            out[k] = 'del' if '<del>' in html else 'literal'
        elif k == 'table':
            out[k] = 'table' if '<table>' in html else 'literal'
        elif k == 'sublist-indent-2':
            nested = re.search(r'<li>[^\n]*\n?<ul>|<li>[^\n]*<ul>', html) is not None
            out[k] = 'nested' if nested else 'sibling'
        elif k == 'task-list':
            out[k] = 'checkbox' if 'checkbox' in html else 'literal-marker'
    return out

expected = []
fails = []
eng = open(f'{BASE}/../engine.js').read()
for c in cases:
    html = md.markdown(c['input'])
    got = pm_labels(html, set(c['kinds']))
    expected.append({'name': c['name'], 'kinds': got})
    # cross-check the engine's static pm labels against reality
    for k, v in c['kinds'].items():
        m = re.search(r"'"+re.escape(k)+r"': \{[^}]*outcomes:\{[^}]*pm:'([^']+)'", eng, re.S)
        if not m: fails.append(f"{k}: construct missing from engine.js"); continue
        if m.group(1) != got[k]:
            fails.append(f"{c['name']}/{k}: corpus says pm={v}, engine static says {m.group(1)}, REAL PM says {got[k]}")

json.dump(expected, open(f'{BASE}/expected.json','w'), indent=1)
print(f"{len(cases)} cases -> expected.json (python-markdown {md.__version__})")
if fails:
    print('ENGINE STATIC PM LABELS DISAGREE WITH REAL PYTHON-MARKDOWN:')
    for f in fails: print(' -', f)
    sys.exit(1)
print('oracle OK: every engine PM label matches the real python-markdown', md.__version__)
