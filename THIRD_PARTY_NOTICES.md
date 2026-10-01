# Third-party notices

The plugin's original code is MIT licensed. Dependency licenses remain their own. This notice is not a substitute for the upstream license files shipped in downloaded runtime packages.

## Included in the JavaScript bundles

- Schemastery 3.18.0 and Cosmokit, Copyright (c) 2021-present Shigma, MIT. [Schemastery license](https://raw.githubusercontent.com/shigma/schemastery/master/LICENSE), [Cosmokit license](https://raw.githubusercontent.com/shigma/cosmokit/master/LICENSE).
- clsx 2.1.1, Copyright (c) Luke Edwards <luke.edwards05@gmail.com> (lukeed.com), MIT. [Repository](https://github.com/lukeed/clsx).

The following MIT terms apply to those components:

```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Supplied by DSH, not privately bundled here

React/React DOM 18.3.1 (MIT), Cordis (MIT), and the declared `@deepseek-ai/dsh-*` peers are shared with the DSH installation. Retain their upstream notices when redistributing an assembled application.

## Downloaded on explicit native setup, not embedded in the plugin archive

- Xvfb / X.Org server: MIT/X11 and historical component-specific licenses; Ubuntu package copyright documents are retained in the extracted runtime.
- Openbox, libobt, libobrender: GPL-2.0-or-later; extracted Ubuntu packages retain copyright/license files. Corresponding source is available from Ubuntu's source package archive and upstream Openbox.
- python-xlib 0.33: LGPL; six 1.17.0: MIT.
- Pillow 11.3.0: HPND/PIL license with component-specific image-library terms; MSS 10.1.0: MIT.
- Existing xterm, system Python, D-Bus, fonts and host graphic libraries are used from the host and are not redistributed by this archive.

The setup script verifies versioned package/wheel hashes. It does not change their licenses. Repackaging the `.runtime` directory is a separate distribution decision and must preserve all license/source obligations; the release archive intentionally excludes it.

## Optional research-only Selkies runtime

Selkies 2.0.0 / Pixelflux 2.1.0 / PCMFlux 2.1.0 are optional, not needed by the v0.1 PNG/stdio plugin. Their core is MPL-2.0; published capture wheels may include GPL-enabled x264/x265/FFmpeg and additional LGPL/permissive libraries. See the [fixed-release upstream inventory](https://github.com/selkies-project/selkies/blob/2.0.0/docs/licensing.md). No Selkies Rust/Python implementation is copied into the plugin worker. The private-X11 input strategy uses public X11 APIs and keeps persistent private key mappings; it does not redistribute the upstream CU server.
