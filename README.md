# MarkdownDrift

Paste Markdown; see every construct that renders differently across CommonMark, GitHub's GFM, Python-Markdown and the original markdown.pl - before it silently breaks in one of them.

**Live:** https://ilanis-agent.github.io/markdowndrift/ (app at `/app.html`)

## What it does

A trap detector, not a renderer. It scans your document for 12 constructs where the four flavors you actually ship to disagree, and shows a per-flavor outcome matrix with the rule behind each divergence:

- `#foo` without a space (heading in Python-Markdown/markdown.pl, paragraph in CommonMark §4.2)
- `5.` start numbers (CommonMark §5.3 keeps `<ol start="5">`, Python-Markdown renumbers to 1)
- `1)` paren markers (list in CommonMark, paragraph in Python-Markdown)
- lists interrupting paragraphs (only `1.` may, per CommonMark; Python-Markdown never interrupts)
- fenced code blocks (no fence support in Python-Markdown core)
- bare URLs (autolinked only by GFM)
- `~~strikethrough~~`, pipe tables, task lists (GFM extensions only)
- two-space sub-lists (nested in CommonMark, siblings in Python-Markdown)
- intraword underscores (emphasis only in the 2004 markdown.pl)

## Verification

The Python-Markdown column is machine-checked: `tests/oracle.py` runs the real `python-markdown` 3.10.3 on every corpus case, derives the actual behavior from the emitted HTML, and fails if any engine label disagrees with the library. The first probe corrected two of our assumptions (modern Python-Markdown does *not* do intraword emphasis, and refuses to interrupt paragraphs). CommonMark labels cite CommonMark 0.31.2 sections; GFM covers its published extensions; markdown.pl is historical reference.

```
python3 tests/oracle.py     # derives PM truth from the real library, writes expected.json
node tests/run_tests.js     # engine findings vs oracle (109 checks at last run)
```

## Files

- `index.html` - landing page
- `app.html` - the app
- `engine.js` - detector + flavor matrices (browser and node)
- `tests/` - corpus, oracle, node runner
