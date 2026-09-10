# Beneath a Steel Sky — CD browser edition

Play the original CD edition with speech, subtitles, original artwork, music and effects. Powered by ScummVM's WebAssembly port.

## GitHub Pages

1. Open this repository's **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Open **Actions → Publish CD game to GitHub Pages → Run workflow** if the first run finished before Pages was enabled.
4. When deployment succeeds, open https://southernadd-cmyk.github.io/bass/.

The Pages workflow builds a complete static site, including the large game files. This repository keeps the editable browser source and a checksum-pinned build recipe. Runtime binaries and game data are downloaded during the build and included in the Pages artifact; the published game does not depend on external asset hosts while playing.

## Play

- Click **Play the original**, then allow the initial engine and game downloads to finish.
- Click **Enable sound** if your browser blocks audio after loading.
- Left click to walk/look; right click to interact/talk.
- Move to the top edge for inventory.
- Press **F5**, or use **Save / load**, for the game's original menu.
- Speech and subtitles are enabled by default. Sound levels can be changed in the game menu.
- Save before leaving. Saves belong to this browser and origin; clearing site data removes them. Old floppy-edition saves should not be assumed compatible with this CD edition.

A desktop browser with a mouse is recommended. First-time downloads are larger than the floppy version: sky.dsk is approximately 72 MB plus the engine and support files.

## Local build

Python 3.11+ and Node.js are used by the checks. No third-party Python packages are required.

```sh
python scripts/build.py
node scripts/check.mjs
python -m http.server 8000 --bind 127.0.0.1 --directory _site
```

Then open http://localhost:8000/. On Windows, `py` can replace `python`. Keep the server terminal open. Opening index.html directly through file:// does not work.

You can use a local copy of the supplied CD archive:

```sh
python scripts/build.py --game-zip /path/to/sky-cd.zip
```

The `site/` directory contains the editable shell; `_site/` is the complete generated output to upload to a static web host. The fetch adapter handles ScummVM's virtual `/data` paths when hosted under `/bass/` or another subdirectory.

## Assets and attribution

All downloads and extracted CD resources are checked against `assets.lock.json`. A changed upstream file stops the build rather than silently mixing incompatible engine versions. The CD archive checksum matches the supplied `sky-cd.zip`.

- Game © Revolution Software Ltd.; original distribution readme included in the built `data/games/sky-cd/readme.txt`.
- ScummVM © the ScummVM team; see `site/COPYING.txt` and `site/COPYRIGHT.txt`.
- Web port and corresponding source/build instructions: https://github.com/chkuendig/scummvm-demo and https://github.com/chkuendig/scummvm.
- Runtime distribution: https://scummvm.kuendig.io/.
- CD archive distribution: https://www.dosgamesarchive.com/file/beneath-a-steel-sky/sky-cd.

Preserve the original notices when redistributing. Do not charge for the game itself.

The automated checks validate binary integrity, resource indexes, speech configuration and subdirectory request routing. They do not constitute a full gameplay or audible-dialogue playtest.
