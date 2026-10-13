# Static page generation. --scene car avoids rewriting unrelated scene pages.
import argparse, json, pathlib, re
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES={'car':'汽车','washer':'洗衣机','elevator':'电梯','excavator':'挖掘机','jet':'飞机','dozer':'推土机','crane':'吊车','mixer':'搅拌车','roller':'压路机','loader':'装载机','dump':'自卸卡车','firetruck':'消防车','garbage':'垃圾车','towercrane':'塔吊','pumptruck':'泵车','grader':'平地机','piler':'打桩机','forklift':'叉车','sweeper':'洒水车','towtruck':'清障车'}
DEPS = json.loads((ROOT / 'tools/scene_deps.json').read_text(encoding='utf-8'))


def write_changed(file, text):
    if not file.exists() or file.read_text(encoding='utf-8') != text:
        file.write_text(text, encoding='utf-8')


def stamp(html, targets=None):
    def sub(m):
        src = m.group(1).split('?')[0]
        if targets is not None and src not in targets:
            return m.group(0)
        file = ROOT / src
        return f'src="{src}?v={int(file.stat().st_mtime)}"' if file.exists() else m.group(0)
    return re.sub(r'src="([^"]+\.js)(?:\?v=\d+)?"', sub, html)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--scene', choices=list(PAGES), action='append')
    args = parser.parse_args()
    selected = args.scene or list(PAGES)
    template = (ROOT / 'tools/page-template.html').read_text(encoding='utf-8')
    for sid in selected:
        deps = DEPS.get(sid, [])
        for src in deps:
            if not (ROOT / src).is_file():
                raise FileNotFoundError(src)
        scripts = '\n'.join(f'<script src="{src}"></script>' for src in deps)
        html = template.replace('__TITLE__', PAGES[sid]).replace('__ID__', sid).replace('__SCENE_DEPS__', scripts)
        write_changed(ROOT / 'pages' / f'{sid}.html', stamp(html))
        print('generated pages/' + sid + '.html')
    # Homepage builds the same scenes for thumbnails; use the same dependency manifest.
    idx = ROOT / 'index.html'
    html = idx.read_text(encoding='utf-8')
    for sid in selected:
        start, end = f'<!-- {sid} dependencies:start -->', f'<!-- {sid} dependencies:end -->'
        scripts = '\n'.join(f'<script src="{src}"></script>' for src in DEPS.get(sid, []))
        if not scripts:
            continue
        block = start + '\n' + scripts + '\n' + end
        if start in html:
            html = re.sub(re.escape(start) + r'.*?' + re.escape(end), lambda _: block, html, flags=re.S)
        else:
            html = re.sub(r'(<script src="scenes/' + re.escape(sid) + r'\.js[^\"]*"></script>)', lambda m: block + '\n' + m[1], html, count=1)
    targets = None if not args.scene else {'js/app.js', 'js/home.js', *(f'scenes/{sid}.js' for sid in selected), *(src for sid in selected for src in DEPS.get(sid, []))}
    write_changed(idx, stamp(html, targets))
    lines = json.loads((ROOT / 'voice/lines.json').read_text(encoding='utf-8'))
    write_changed(ROOT / 'voice/lines.js', 'window.VOICE_LINES=' + json.dumps(lines, ensure_ascii=False, separators=(',', ':')) + ';\n')


if __name__ == '__main__':
    main()
