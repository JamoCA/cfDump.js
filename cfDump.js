/*!
 * cfDump.js v1.0.0 — https://github.com/JamoCA/cfDump.js
 * Dependency-free JS value dumper with CFML <cfdump>-style output.
 *
 * Visual design derived from an unattributed jQuery plugin (jquery.dump.js,
 * earliest known source: Net Grow Web Design, Sydney, circa 2011-2012, no
 * license declared). Rewritten in vanilla JS, with HTML-escaping and
 * CSP-safer event handling.
 *
 * Released under the MIT License.
 * Copyright (c) 2026 James Moberg
 */
(function (global) {
	'use strict';

	var HTML_ESCAPES = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	};

	function escapeHTML(value) {
		if (value === null || value === undefined) return String(value);
		return String(value).replace(/[&<>"']/g, function (ch) { return HTML_ESCAPES[ch]; });
	}

	function detectType(obj) {
		var t = typeof obj;

		if (t === 'function') {
			var f = obj.toString();
			if (/^\/.*\/[gi]??[gi]??$/.test(f)) return 'regexp';
			if (/^\[object.*\]$/i.test(f)) t = 'object';
		}
		if (t !== 'object') return t;

		if (obj === null) return 'null';
		if (obj === global) return 'window';
		if (obj === global.document) return 'document';
		if (global.event && obj === global.event) return 'event';
		if (global.event && obj && obj.type !== undefined && global.event.type === obj.type) return 'event';

		var c = obj.constructor;
		if (c != null) {
			if (c === Array) { t = 'array'; }
			else if (c === Date) return 'date';
			else if (c === RegExp) return 'regexp';
			else if (c === Object) { t = 'object'; }
			else if (c === ReferenceError) return 'error';
			else if (typeof c === 'function' && /\s*function (.*)\(/.test(c.toString())) return 'object';
		}

		var nt = obj.nodeType;
		if (nt != null) {
			if (nt === 1) return 'domelement';
			if (nt === 3) return 'string';
		}

		if (obj.toString) {
			var am = obj.toString().match(/^\[object (.*)\]$/i);
			if (am) {
				switch (am[1].toLowerCase()) {
					case 'event':          return 'event';
					case 'nodelist':
					case 'htmlcollection':
					case 'elementarray':   return 'array';
					case 'htmldocument':   return 'htmldocument';
				}
			}
		}

		return t;
	}

	var BASE_FONT    = 'font-size:xx-small;font-family:verdana,arial,helvetica,sans-serif;';
	var TH_STYLE     = BASE_FONT + 'text-align:left;color:white;padding:5px;vertical-align:top;cursor:pointer;';
	var TD_STYLE     = BASE_FONT + 'vertical-align:top;padding:3px;';
	var TABLE_STYLE  = BASE_FONT;

	var CLICK_TABLE_ATTR = ' class="tdumpTable" title="click to collapse"';
	var CLICK_ROW_ATTR   = ' class="tdumpRow" title="click to collapse"';

	function styleFor(type, use) {
		var bg = { table: '', th: '', keyBg: '', valueBg: '#fff' };
		var keyOnTh = false;    // `arguments`/`regexp`/`date`/`domelement` sub-table keys use TH-weighted style
		var hasTh   = true;
		var hasValue = true;

		switch (type) {
			case 'string': case 'number': case 'boolean': case 'undefined': case 'object':
				bg.table = '#0000cc'; bg.th = '#4444cc'; bg.keyBg = '#ccddff'; break;
			case 'array':
				bg.table = '#006600'; bg.th = '#009900'; bg.keyBg = '#ccffcc'; break;
			case 'function':
				bg.table = '#aa4400'; bg.th = '#cc6600'; bg.keyBg = '#fff';    break;
			case 'arguments':
				bg.table = '#dddddd'; bg.keyBg = '#eeeeee'; hasTh = false; hasValue = false; keyOnTh = true; break;
			case 'regexp':
				bg.table = '#CC0000'; bg.th = '#FF0000'; bg.keyBg = '#FF5757'; keyOnTh = true; break;
			case 'date':
				bg.table = '#663399'; bg.th = '#9966CC'; bg.keyBg = '#B266FF'; keyOnTh = true; break;
			case 'domelement': case 'document': case 'window':
				bg.table = '#FFCC33'; bg.th = '#FFD966'; bg.keyBg = '#FFF2CC'; keyOnTh = true; break;
			default:
				// Unknown type: empty string for all uses. Callers get "" back.
				return '';
		}

		switch (use) {
			case 'table':
				return ' style="' + TABLE_STYLE + 'background-color:' + bg.table + ';"';
			case 'th':
				if (!hasTh) return '';
				return ' style="' + TH_STYLE + 'background-color:' + bg.th + ';"' + CLICK_TABLE_ATTR;
			case 'td-key': {
				var base = keyOnTh
				? TH_STYLE + 'background-color:' + bg.keyBg + ';color:#000000;'
				: TD_STYLE + 'background-color:' + bg.keyBg + ';cursor:pointer;';
				return ' style="' + base + '"' + CLICK_ROW_ATTR;
			}
			case 'td-value':
				if (!hasValue) return '';
				return ' style="' + TD_STYLE + 'background-color:' + bg.valueBg + ';"';
			default:
				return '';
		}
	}

	function renderValue(value, showTypes, showAttributes) {
		var type = detectType(value);
		var html = '';
		var hasBody = false;

		switch (type) {
			case 'regexp':     html = renderRegExp(value, type); hasBody = true; break;
			case 'date':       html = renderDate(value, type); hasBody = true; break;
			case 'function':   html = renderFunction(value, type); hasBody = true; break;
			case 'domelement': html = renderDomElement(value, type, showAttributes); hasBody = true; break;
		}

		if (type === 'object' || type === 'array') {
			var keys = Object.keys(value);
			for (var i = 0; i < keys.length; i++) {
				var k = keys[i];
				var childType = detectType(value[k]);
				if (!hasBody) {
					html += '<table role="presentation"' + styleFor(type, 'table') + '>'
						+  '<tr><th colspan="2"' + styleFor(type, 'th') + '>' + escapeHTML(type) + '</th></tr>';
					hasBody = true;
				}
				var keySuffix = showTypes ? ' [' + escapeHTML(childType) + ']' : '';
				var valueCell = (typeof value[k] === 'object' && value[k] !== null) || typeof value[k] === 'function'
				? renderValue(value[k], showTypes, showAttributes)
				: escapeHTML(value[k]);
				html += '<tr><td' + styleFor(type, 'td-key') + '>' + escapeHTML(k) + keySuffix + '</td>'
					+  '<td' + styleFor(type, 'td-value') + '>' + valueCell + '</td></tr>';
			}
		}

		if (!hasBody) {
			html += '<table role="presentation"' + styleFor(type, 'table') + '>'
			+  '<tr><th colspan="2"' + styleFor(type, 'th') + '>' + escapeHTML(type) + ' [empty]</th></tr>';
		}

		return html + '</table>';
	}

	// Stubs for Tasks 6-7 (function, domelement) remain below.
	function renderLabeledLeaf(value, type, label) {
		var s = '';
		s += '<table role="presentation"' + styleFor(type, 'table') + '>'
		+  '<tr><th colspan="2"' + styleFor(type, 'th') + '>' + escapeHTML(type) + '</th></tr>';
		s += '<tr><td colspan="2"' + styleFor(type, 'td-value') + '>'
		+  '<table role="presentation"' + styleFor('arguments', 'table') + '>'
		+  '<tr>'
		+  '<td' + styleFor('arguments', 'td-key') + '><i>' + label + ': </i></td>'
		+  '<td' + styleFor(type, 'td-value') + '>' + escapeHTML(value) + '</td>'
		+  '</tr></table></td></tr>';
		return s;
	}

	function renderRegExp(value, type) { return renderLabeledLeaf(value, type, 'RegExp'); }
	function renderDate(value, type)   { return renderLabeledLeaf(value, type, 'Date'); }
	function renderFunction(value, type) {
		var src  = value.toString();
		var m    = src.match(/^.*function.*?\((.*?)\)/im);
		var args = (m == null || m[1] == null || m[1] === '') ? 'none' : m[1];

		var s = '';
		s += '<table role="presentation"' + styleFor(type, 'table') + '>'
		+  '<tr><th colspan="2"' + styleFor(type, 'th') + '>' + escapeHTML(type) + '</th></tr>';
		s += '<tr><td colspan="2"' + styleFor(type, 'td-value') + '>'
		+  '<table role="presentation"' + styleFor('arguments', 'table') + '>'
		+  '<tr>'
		+  '<td' + styleFor('arguments', 'td-key') + '><i>Arguments: </i></td>'
		+  '<td' + styleFor(type, 'td-value') + '>' + escapeHTML(args) + '</td>'
		+  '</tr>'
		+  '<tr>'
		+  '<td' + styleFor('arguments', 'td-key') + '><i>Function: </i></td>'
		+  '<td' + styleFor(type, 'td-value') + '>' + escapeHTML(src) + '</td>'
		+  '</tr></table></td></tr>';
		return s;
	}
	function renderDomElement(value, type, showAttributes) {
		var attrLines = '';
		if (showAttributes) {
			for (var k in value) {
				if (!/innerHTML|outerHTML/i.test(k)) {
				attrLines += escapeHTML(k) + ': ' + escapeHTML(value[k]) + '<br />';
				}
			}
		}

		var s = '';
		s += '<table role="presentation"' + styleFor(type, 'table') + '>'
		+  '<tr><th colspan="2"' + styleFor(type, 'th') + '>' + escapeHTML(type) + '</th></tr>';
		s += '<tr><td' + styleFor(type, 'td-key') + '><i>Node Name: </i></td>'
		+  '<td' + styleFor(type, 'td-value') + '>' + escapeHTML(value.nodeName.toLowerCase()) + '</td></tr>';
		s += '<tr><td' + styleFor(type, 'td-key') + '><i>Node Type: </i></td>'
		+  '<td' + styleFor(type, 'td-value') + '>' + escapeHTML(value.nodeType) + '</td></tr>';
		s += '<tr><td' + styleFor(type, 'td-key') + '><i>Node Value: </i></td>'
		+  '<td' + styleFor(type, 'td-value') + '>' + escapeHTML(value.nodeValue) + '</td></tr>';
		if (showAttributes) {
			s += '<tr><td' + styleFor(type, 'td-key') + '><i>Attributes: </i></td>'
				+  '<td' + styleFor(type, 'td-value') + '>' + attrLines + '</td></tr>';
			s += '<tr><td' + styleFor(type, 'td-key') + '><i>innerHTML: </i></td>'
				+  '<td' + styleFor(type, 'td-value') + '>' + escapeHTML(value.innerHTML) + '</td></tr>';
			if (value.outerHTML !== undefined) {
				s += '<tr><td' + styleFor(type, 'td-key') + '><i>outerHTML: </i></td>'
				+  '<td' + styleFor(type, 'td-value') + '>' + escapeHTML(value.outerHTML) + '</td></tr>';
			}
		}
		return s;
	}

	var boundDocs = new WeakSet();

	function bindCollapseHandlers(doc) {
		if (!doc || !doc.body || boundDocs.has(doc)) return;
		boundDocs.add(doc);

		function handler(event) {
			var el = event.target && event.target.closest && event.target.closest('.tdumpTable, .tdumpRow');
			if (!el) return;

			var isItalic = (el.style.fontStyle || '').toLowerCase() === 'italic';
			if (isItalic) {
				el.style.fontStyle = 'normal';
				el.setAttribute('title', 'click to collapse');
			} else {
				el.style.fontStyle = 'italic';
				el.setAttribute('title', 'click to expand');
			}

			if (el.classList.contains('tdumpTable')) {
				// Hide/show every sibling row in the enclosing table except the header row.
				var table = el.closest('table');
				if (!table) return;
				var rows = table.querySelectorAll(':scope > tbody > tr, :scope > tr');
				for (var i = 1; i < rows.length; i++) {
				rows[i].style.display = isItalic ? '' : 'none';
				}
			} else {
				// tdumpRow: hide/show every sibling cell in the enclosing row except the key cell.
				var row = el.closest('tr');
				if (!row) return;
				var cells = row.children;
				for (var j = 1; j < cells.length; j++) {
				cells[j].style.display = isItalic ? '' : 'none';
				}
			}
		}

		doc.body.addEventListener('click', handler);
		doc.body.addEventListener('keypress', handler);
	}

	function renderPopup(html) {
		var w = 760, h = 500;
		var leftPos = global.screen && global.screen.width ? (global.screen.width - w) / 2 : 0;
		var topPos  = global.screen && global.screen.height ? (global.screen.height - h) / 2 : 0;
		var settings = 'height=' + h + ',width=' + w + ',top=' + topPos + ',left=' + leftPos
			+ ',scrollbars=yes,menubar=yes,status=yes,resizable=yes';
		var win = global.open('', 'dumpWin', settings);
		if (!win) return;  // popup blocked; caller can decide to notify
		win.document.body.innerHTML = html;
		win.document.title = 'Dump';
		bindCollapseHandlers(win.document);
		win.focus();
	}

	function renderInline(html) {
		bindCollapseHandlers(global.document);
		return html;
	}

	function cfDump(object, showTypes, showAttributes, enablePopUp) {
		var st = showTypes       === undefined ? true : showTypes;
		var sa = showAttributes  === undefined ? true : showAttributes;
		var pu = enablePopUp     === undefined ? true : enablePopUp;

		var t = typeof object;
		var payload;
		if (t === 'string' || t === 'number' || t === 'boolean' || t === 'undefined' || object === null) {
			payload = String(object);
		} else {
			payload = renderValue(object, st, sa);
		}

		if (pu) {
			renderPopup(payload);
			return undefined;
		}
		return renderInline(payload);
	}

	global.cfDump = cfDump;
	if (typeof global.dump === 'undefined') global.dump = cfDump;

	if (global.jQuery) {
			global.jQuery.dump = cfDump;
			global.jQuery.fn.dump = function (showTypes, showAttributes, enablePopUp) {
			cfDump(this[0], showTypes, showAttributes, enablePopUp);
			return this;
		};
	}
})(typeof window !== 'undefined' ? window : this);
