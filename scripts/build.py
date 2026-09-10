#!/usr/bin/env python3
"""Build a self-contained static CD edition. Downloads are SHA-256 pinned."""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import shutil
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
LOCK = json.loads((ROOT / 'assets.lock.json').read_text())

def checksum(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def download(name, spec, cache):
    dest = cache / spec['sha256']
    if dest.exists() and checksum(dest) == spec['sha256']:
        return name, dest
    temp = dest.with_suffix('.tmp')
    print('Downloading', name, flush=True)
    request = urllib.request.Request(spec['url'], headers={'User-Agent': 'BASS-browser-build/1.0'})
    try:
        with urllib.request.urlopen(request, timeout=180) as response, temp.open('wb') as out:
            shutil.copyfileobj(response, out)
        if checksum(temp) != spec['sha256']:
            raise RuntimeError('Checksum mismatch for ' + name + '; upstream file changed. Review before updating assets.lock.json.')
        temp.replace(dest)
    finally:
        temp.unlink(missing_ok=True)
    return name, dest

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--game-zip', type=Path, help='Optional local copy of the original sky-cd.zip')
    parser.add_argument('--cache', type=Path, default=ROOT / '.asset-cache')
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    if args.game_zip:
        if checksum(args.game_zip) != LOCK['game']['sha256']:
            raise RuntimeError('The supplied game ZIP does not match the CD edition in assets.lock.json.')
        dest = args.cache / LOCK['game']['sha256']
        if args.game_zip.resolve() != dest.resolve():
            shutil.copyfile(args.game_zip, dest)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        assets = dict(pool.map(lambda item: download(*item, args.cache), LOCK.items()))
    out = ROOT / '_site'
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(ROOT / 'site', out)
    for name, path in assets.items():
        if name in ('game', 'scummvm.wasm'):
            continue
        target = out / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
    engine = out / 'engine'
    engine.mkdir(exist_ok=True)
    manifest = []
    with assets['scummvm.wasm'].open('rb') as wasm:
        i = 0
        while chunk := wasm.read(8 * 1024 * 1024):
            name = f'engine/runtime-{i}.bin'
            (out / name).write_bytes(chunk)
            manifest.append({'url': name, 'size': len(chunk)})
            i += 1
    (engine / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    game = out / 'data/games/sky-cd'
    game.mkdir(parents=True)
    with zipfile.ZipFile(assets['game']) as archive:
        names = {Path(name).name.lower(): name for name in archive.namelist()}
        for name, spec in LOCK['game']['files'].items():
            data = archive.read(names[name])
            if len(data) != spec['size'] or hashlib.sha256(data).hexdigest() != spec['sha256']:
                raise RuntimeError('Incorrect CD game resource: ' + name)
            (game / name).write_bytes(data)
    (out / 'data/gui-icons').mkdir(exist_ok=True)
    data = out / 'data'
    for directory in sorted([data] + [p for p in data.rglob('*') if p.is_dir()], key=lambda p: len(p.parts), reverse=True):
        index = {p.name: {} if p.is_dir() else p.stat().st_size for p in sorted(directory.iterdir()) if p.name != 'index.json'}
        (directory / 'index.json').write_text(json.dumps(index, indent=2))
    assert (game / 'sky.dsk').stat().st_size == 72429382
    print('Built _site: CD speech, subtitles, same-origin resources and Pages directory indexes.', flush=True)

if __name__ == '__main__':
    main()
