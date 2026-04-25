# cfDump.js

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> Vanilla JavaScript debugging utility that renders any value as CFML-style nested, color-coded, collapsible HTML tables.

## What it is

cfDump.js is a dependency-free JavaScript debugging utility that renders any value - objects, arrays, functions, regex, dates, DOM elements - as a nested, color-coded, collapsible HTML table, inline or in a popup window. The visual output is modeled on ColdFusion / CFML's `<cfdump>` tag, giving frontend developers the same at-a-glance variable inspection experience CFML developers have server-side. A rewrite of an unattributed jQuery plugin (circa 2011) with jQuery removed, HTML-escaping added, and CSP-safer event handling; the plugin still auto-registers `jQuery.dump` and `$.fn.dump` wrappers when jQuery is present.

<!-- Screenshot placeholder: add a PNG of the "everything sample" in demo.html after the first working build. -->

## Installation

Drop `cfDump.min.js` into your project and add one `<script>` tag. No dependencies.

```html
<script src="cfDump.min.js"></script>
```

If jQuery is loaded **before** `cfDump.min.js`, the library auto-registers `jQuery.dump` and `$.fn.dump` for compatibility with existing call sites.

## Basic usage

```js
cfDump(anyValue);               // opens a popup with the dump
var html = cfDump(obj, true, true, false);
document.getElementById('debug').innerHTML = html;   // render inline
```

## API reference

Three entry points, all with the same four-argument signature.

| Call form | Signature | Available when |
|---|---|---|
| `cfDump(value, showTypes?, showAttributes?, enablePopUp?)` | primary | always |
| `jQuery.dump(value, showTypes?, showAttributes?, enablePopUp?)` | alias | jQuery loaded before cfDump.min.js |
| `$(el).dump(showTypes?, showAttributes?, enablePopUp?)` | dumps `this[0]` | jQuery loaded before cfDump.min.js |

| Argument | Default | Effect |
|---|---|---|
| `showTypes` | `true` | Suffix each key with its detected type, e.g. `"tags [array]"`. |
| `showAttributes` | `true` | For DOM element dumps, include the Attributes, innerHTML, and outerHTML rows. |
| `enablePopUp` | `true` | `true` opens a new 760x500 window and writes the dump there. `false` returns the HTML string for the caller to inject wherever it's needed. |

**Return value in popup mode:** `undefined` (the dump is written to the new window).
**Return value in inline mode:** the HTML string. The caller is responsible for injecting it into the DOM. Collapse/expand handlers are pre-bound at the document `body` level, so clicks work as soon as the HTML lands anywhere under `body`.

**Return value of `$(el).dump(...)`:** the jQuery collection (for chaining). The generated HTML is discarded. For the plugin form to produce visible output, either use popup mode or call `cfDump($(el)[0], ...)` directly to capture the string.

## jQuery integration

If `window.jQuery` exists at the time `cfDump.min.js` is parsed, the library installs `jQuery.dump` (as an alias of `cfDump`) and `jQuery.fn.dump` (as a plugin wrapper that extracts `this[0]` and calls `cfDump`).

**Load order matters:** load jQuery **before** `cfDump.min.js`. If jQuery loads afterward, the wrappers are not registered and you'll have to call `cfDump` directly.

## Popup vs inline rendering

- **Popup mode** (`enablePopUp=true`, the default) is the simplest: one call, a new window appears. Requires the browser to allow popups - browsers block unsolicited popups, but a call during a click handler is typically allowed.
- **Inline mode** (`enablePopUp=false`) returns the HTML string so you can embed it in an existing page. You handle placement. Good for debug panels or test pages.

## Content Security Policy

`cfDump.js` is written to be CSP-friendly.

- **`script-src`:** no exception needed. The library contains no inline scripts, no `eval`, and no `Function()` constructor.
- **`style-src`:** the output HTML uses inline `style=""` attributes for color coding, which strict CSPs block by default. Add one of:
  - `style-src 'unsafe-inline'` - the broad option, allows `style=""` attributes *and* inline `<style>` blocks.
  - `style-src-attr 'unsafe-inline'` - CSP level 3, allows only `style=""` attributes (the library's actual usage) and still blocks inline `<style>` blocks.

Example: if your current CSP is

```
Content-Security-Policy: default-src 'self'; style-src 'self';
```

change it to

```
Content-Security-Policy: default-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline';
```

A future release may replace inline styles with class-based CSS to remove this requirement.

## Supported types

The type detector produces one of these labels and renders a matching color:

`null`, `undefined`, `string`, `number`, `boolean`, `object`, `array`, `function`, `regexp`, `date`, `domelement`, `document`, `htmldocument`, `window`, `event`, `error`.

**Note:** plain object/array iteration uses `Object.keys`, so prototype-inherited properties are **not** dumped. DOM element attribute listings retain the original plugin's `for...in` enumeration for faithful output.

## Migration from `jquery.dump.min.js`

Calls continue to work unchanged when jQuery is loaded:

| Old call | Works under cfDump.js? |
|---|---|
| `jQuery.dump(obj)` | Yes - alias of `cfDump(obj)` |
| `$(el).dump()` | Yes - unwraps to `this[0]` and calls `cfDump` |
| `$.dump(obj)` | Yes - same as `jQuery.dump` |

**Output differences to expect:**

- String leaves nested in objects/arrays are HTML-escaped.
- Prototype-inherited properties of plain objects are skipped.
- `cursor:hand` is not emitted (only `cursor:pointer`).
- The never-valid `cell-spacing` style declaration is removed.
- Clickable cells use `class="tdumpTable"` / `class="tdumpRow"` in both popup and inline mode; no inline `onclick=` attributes anywhere.
- No `console.log("popup", ...)` debug line on every call.

## Known limitations

- **Inline styles** block strict CSP `style-src` - see above for the directive to add.
- **No circular-reference detection** beyond the `window` / `document` / `event` short-circuits. Dumping a user-created cyclic object will recurse until the stack overflows.
- **`jQuery.fn.dump` wrapper only inspects the first matched element** (`this[0]`). Call in a loop or map if you need to dump several.
- **Top-level primitive values are not HTML-escaped** (compat with the original). If you do `cfDump(untrustedString, ..., false)` and inject the returned string into the page, an attacker-controlled value like `<script>...</script>` will render as live HTML. String leaves nested inside dumped objects/arrays *are* escaped. Do not pass attacker-controlled top-level primitives directly - wrap them in an object first: `cfDump({value: untrustedString})`.

## Credits / history

The visual design and rendering model of cfDump.js are derived from an unattributed jQuery plugin that was distributed as `jquery.dump.js` circa 2011-2012. The earliest known source is [Net Grow Web Design](https://www.netgrow.com.au/), Sydney, Australia - a [Wayback Machine snapshot from 2012](https://web.archive.org/web/20120320154414/https://www.netgrow.com.au/assets/files/jquery_plugins/jquery.dump.js) preserves the original file. The original carried no author, copyright, or license declaration. This rewrite removes the jQuery dependency, adds HTML-escaping for safety, switches event handling to CSP-safer delegated listeners, and is released under the MIT License.

## License

MIT © 2026 James Moberg. See [LICENSE](./LICENSE) for the full text.
