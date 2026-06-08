/**
 * components/ui/CodePanelFP.jsx — ai-chatbot-fullpage
 * Split panel for code display + live preview.
 * Shows on the right side of the chat when code is detected.
 * Supports: syntax highlighting, FreeMarker/HTML preview simulation, close/reopen.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getDictionary } from '../../lib/i18n.js';

// ── Token-based syntax highlighting (no external deps) ────────────────────
// Uses a single-pass tokenizer to avoid regex overlap bugs.
// The code is first escaped for HTML, then tokenized left-to-right.

const TOKEN_STYLES = {
    tag:      'color:#0369a1',
    attr:     'color:#7c3aed',
    string:   'color:#b45309',
    comment:  'color:#6b7280;font-style:italic',
    keyword:  'color:#9333ea',
    variable: 'color:#0d9488',
    text:     'color:#1e293b',
    number:   'color:#059669',
};

function span(text, cls) {
    const style = TOKEN_STYLES[cls] || TOKEN_STYLES.text;
    return `<span style="${style}">${text}</span>`;
}

function highlightCode(code, language) {
    if (!code) return '';
    // Escape HTML first
    const escaped = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    if (language === 'freemarker' || language === 'ftl') {
        return tokenizeFreeMarker(escaped);
    }
    if (language === 'html' || language === 'xml') {
        return tokenizeHTML(escaped);
    }
    if (language === 'css') {
        return tokenizeCSS(escaped);
    }
    if (language === 'javascript' || language === 'js') {
        return tokenizeJS(escaped);
    }
    return escaped;
}

// ── FreeMarker tokenizer ──────────────────────────────────────────────────
function tokenizeFreeMarker(src) {
    let out = '';
    let i = 0;
    const len = src.length;

    while (i < len) {
        // FTL comment: &lt;#-- ... --&gt;
        if (src.startsWith('&lt;#--', i)) {
            const end = src.indexOf('--&gt;', i + 6);
            if (end !== -1) {
                out += span(src.substring(i, end + 5), 'comment');
                i = end + 5;
                continue;
            }
        }

        // FTL directive open: &lt;#if, &lt;#list, &lt;#assign, etc.
        if (src.startsWith('&lt;#', i) || src.startsWith('&lt;/#', i)) {
            const closeIdx = src.indexOf('&gt;', i);
            if (closeIdx !== -1) {
                const tagContent = src.substring(i, closeIdx + 4);
                out += highlightFTLTag(tagContent);
                i = closeIdx + 4;
                continue;
            }
        }

        // FTL interpolation ${...}
        if (src[i] === '$' && src[i + 1] === '{') {
            const end = src.indexOf('}', i + 2);
            if (end !== -1) {
                out += span('${', 'variable') + span(src.substring(i + 2, end), 'variable') + span('}', 'variable');
                i = end + 1;
                continue;
            }
        }

        // HTML tag: &lt;tagname ... &gt; or &lt;/tagname&gt;
        if (src.startsWith('&lt;', i) && !src.startsWith('&lt;#', i) && !src.startsWith('&lt;/', i + 4) ? true : src.startsWith('&lt;', i) && (src[i + 4] !== '#' && src[i + 4] !== '/')) {
            // More precise: match &lt; followed by a letter (HTML tag)
            if (src.startsWith('&lt;', i)) {
                const afterLt = i + 4;
                // Check if it's an HTML tag (starts with letter, not #)
                const nextChar = src[afterLt];
                if (nextChar && (nextChar === '/' || (nextChar >= 'a' && nextChar <= 'z') || (nextChar >= 'A' && nextChar <= 'Z'))) {
                    if (nextChar !== '#') {
                        const closeIdx = src.indexOf('&gt;', afterLt);
                        if (closeIdx !== -1) {
                            const tagContent = src.substring(i, closeIdx + 4);
                            out += highlightHTMLTag(tagContent);
                            i = closeIdx + 4;
                            continue;
                        }
                    }
                }
            }
        }

        // Default: single character
        out += src[i];
        i++;
    }

    return out;
}

function highlightFTLTag(tag) {
    // tag is like: &lt;#if ...&gt; or &lt;/#if&gt; or &lt;#assign x=...&gt;
    // Extract the directive keyword
    const match = tag.match(/^(&lt;\/?#)(\w+)/);
    if (!match) return span(tag, 'keyword');

    const open = match[1]; // &lt;# or &lt;/#
    const kw = match[2];   // if, list, assign, etc.
    const rest = tag.substring(match[0].length);
    const closeTag = rest.endsWith('&gt;') ? '&gt;' : '';
    const attrs = closeTag ? rest.substring(0, rest.length - 4) : rest;

    return span(open, 'tag') + span(kw, 'keyword') + (attrs ? highlightAttrs(attrs) : '') + (closeTag ? span(closeTag, 'tag') : '');
}

function highlightHTMLTag(tag) {
    // tag is like: &lt;div class="..."&gt; or &lt;/div&gt;
    const match = tag.match(/^(&lt;\/?)([\w-]+)/);
    if (!match) return span(tag, 'tag');

    const open = match[1]; // &lt; or &lt;/
    const tagName = match[2];
    const rest = tag.substring(match[0].length);
    const closeTag = rest.endsWith('&gt;') ? '&gt;' : '';
    const attrs = closeTag ? rest.substring(0, rest.length - 4) : rest;

    return span(open, 'tag') + span(tagName, 'tag') + (attrs ? highlightAttrs(attrs) : '') + (closeTag ? span(closeTag, 'tag') : '');
}

function highlightAttrs(attrs) {
    // Highlight attribute names and string values
    let out = '';
    let i = 0;
    while (i < attrs.length) {
        // Attribute name
        const nameMatch = attrs.substring(i).match(/^([\w-]+)\s*=/);
        if (nameMatch) {
            out += span(nameMatch[1], 'attr') + '=';
            i += nameMatch[0].length;
            // String value
            if (attrs[i] === '"' || attrs[i] === '&') {
                // Could be "value" or &quot;value&quot;
                if (attrs[i] === '"') {
                    const end = attrs.indexOf('"', i + 1);
                    if (end !== -1) {
                        out += span(attrs.substring(i, end + 1), 'string');
                        i = end + 1;
                        continue;
                    }
                }
                // &quot;...&quot;
                if (attrs.startsWith('&quot;', i)) {
                    const end = attrs.indexOf('&quot;', i + 7);
                    if (end !== -1) {
                        out += span(attrs.substring(i, end + 7), 'string');
                        i = end + 7;
                        continue;
                    }
                }
            }
            continue;
        }
        // Quoted string not preceded by =
        if (attrs[i] === '"') {
            const end = attrs.indexOf('"', i + 1);
            if (end !== -1) {
                out += span(attrs.substring(i, end + 1), 'string');
                i = end + 1;
                continue;
            }
        }
        if (attrs.startsWith('&quot;', i)) {
            const end = attrs.indexOf('&quot;', i + 7);
            if (end !== -1) {
                out += span(attrs.substring(i, end + 7), 'string');
                i = end + 7;
                continue;
            }
        }
        out += attrs[i];
        i++;
    }
    return out;
}

// ── HTML tokenizer ─────────────────────────────────────────────────────────
function tokenizeHTML(src) {
    let out = '';
    let i = 0;
    const len = src.length;

    while (i < len) {
        // HTML comment
        if (src.startsWith('&lt;!--', i)) {
            const end = src.indexOf('--&gt;', i + 6);
            if (end !== -1) {
                out += span(src.substring(i, end + 5), 'comment');
                i = end + 5;
                continue;
            }
        }

        // HTML tag
        if (src.startsWith('&lt;', i)) {
            const afterLt = i + 4;
            const nextChar = src[afterLt];
            if (nextChar && (nextChar === '/' || (nextChar >= 'a' && nextChar <= 'z') || (nextChar >= 'A' && nextChar <= 'Z'))) {
                const closeIdx = src.indexOf('&gt;', afterLt);
                if (closeIdx !== -1) {
                    out += highlightHTMLTag(src.substring(i, closeIdx + 4));
                    i = closeIdx + 4;
                    continue;
                }
            }
        }

        out += src[i];
        i++;
    }

    return out;
}

// ── CSS tokenizer ──────────────────────────────────────────────────────────
function tokenizeCSS(src) {
    let out = '';
    let i = 0;
    const len = src.length;

    while (i < len) {
        // CSS comment
        if (src[i] === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2);
            if (end !== -1) {
                out += span(src.substring(i, end + 2), 'comment');
                i = end + 2;
                continue;
            }
        }
        // String
        if (src[i] === '"' || src[i] === "'") {
            const quote = src[i];
            let j = i + 1;
            while (j < len && src[j] !== quote) j++;
            out += span(src.substring(i, j + 1), 'string');
            i = j + 1;
            continue;
        }
        // Property name before :
        const propMatch = src.substring(i).match(/^([\w-]+)\s*:/);
        if (propMatch) {
            out += span(propMatch[1], 'attr') + ':';
            i += propMatch[0].length;
            continue;
        }
        out += src[i];
        i++;
    }

    return out;
}

// ── JS tokenizer ───────────────────────────────────────────────────────────
const JS_KEYWORDS = new Set(['const','let','var','function','return','if','else','for','while','do','switch','case','break','continue','new','this','class','extends','import','export','from','default','try','catch','finally','throw','async','await','yield','typeof','instanceof','in','of','true','false','null','undefined']);

function tokenizeJS(src) {
    let out = '';
    let i = 0;
    const len = src.length;

    while (i < len) {
        // Single-line comment
        if (src[i] === '/' && src[i + 1] === '/') {
            const end = src.indexOf('\n', i);
            const commentEnd = end === -1 ? len : end;
            out += span(src.substring(i, commentEnd), 'comment');
            i = commentEnd;
            continue;
        }
        // Multi-line comment
        if (src[i] === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2);
            if (end !== -1) {
                out += span(src.substring(i, end + 2), 'comment');
                i = end + 2;
                continue;
            }
        }
        // String
        if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
            const quote = src[i];
            let j = i + 1;
            while (j < len && src[j] !== quote) { if (src[j] === '\\') j++; j++; }
            out += span(src.substring(i, j + 1), 'string');
            i = j + 1;
            continue;
        }
        // Number
        if (/\d/.test(src[i]) && (i === 0 || !/\w/.test(src[i - 1]))) {
            let j = i;
            while (j < len && /[\d.]/.test(src[j])) j++;
            out += span(src.substring(i, j), 'number');
            i = j;
            continue;
        }
        // Keyword
        const wordMatch = src.substring(i).match(/^(\w+)/);
        if (wordMatch && JS_KEYWORDS.has(wordMatch[1])) {
            // Check word boundary
            const afterWord = i + wordMatch[1].length;
            if (afterWord >= len || !/\w/.test(src[afterWord])) {
                out += span(wordMatch[1], 'keyword');
                i = afterWord;
                continue;
            }
        }

        out += src[i];
        i++;
    }

    return out;
}

// ── FreeMarker → HTML preview simulator ──────────────────────────────────
// Uses a Tokenizer + AST + Evaluator approach (not regex) to correctly handle:
//   • Nested <#if>/<#elseif>/<#else> blocks
//   • > inside conditions (e.g. >= 3)
//   • <#function>/<#macro>/<#return> definitions (removed from output)
//   • <#list> loops, <#assign>, <#attempt>/<#recover>
//   • All FTL variable interpolations replaced with sample data
// Every FTL variable is ALWAYS shown as a value — never blank or removed.

const SAMPLE_DATA = {
    title:          'Innovazione Digitale nel Settore Pubblico',
    content:        '<p>Il progetto di trasformazione digitale sta rivoluzionando i servizi al cittadino.</p>',
    summary:        'Un breve riassunto dell\'articolo sulla digitalizzazione dei servizi pubblici.',
    publishDate:    '2026-06-05',
    author:         'Mario Rossi',
    featuredImage:  'https://placehold.co/540x250/e2e8f0/64748b?text=Featured+Image',
    category:       'Tecnologia',
    description:    'Descrizione di esempio per questo contenuto.',
    name:           'Nome Esempio',
    label:          'Label Esempio',
    url:            '#',
    image:          'https://placehold.co/200x200/e2e8f0/64748b?text=Image',
    price:          '€ 99,00',
    date:           '05 Giugno 2026',
    email:          'mario.rossi@esempio.it',
    phone:          '+39 02 1234567',
    text:           'Testo di esempio per l\'anteprima.',
    value:          'Valore Esempio',
    body:           '<p>Contenuto del body con <strong>testo in grassetto</strong> e <a href="#">link</a>.</p>',
    subtitle:       'Sottotitolo Esempio',
    icon:           '⭐',
    count:          '42',
    items:          ['Elemento 1', 'Elemento 2', 'Elemento 3'],
    friendlyURL:    '#',
    viewURL:        '#',
    curEntry:       'Voce',
    entries:        ['Voce 1', 'Voce 2', 'Voce 3'],
    locale:         'it_IT',
    rootElement:    'rootElement',
    dynamicElement: 'dynamicElement',
    fieldValue:     'Valore Campo',
    fieldName:      'Nome Campo',
    titleValue:     'Innovazione Digitale nel Settore Pubblico',
    summaryValue:   'Un breve riassunto dell\'articolo.',
    authorValue:    'Mario Rossi',
    publishDateValue:'05 Giugno 2026',
    categoryValue:  'Tecnologia',
    imageAlt:       'Immagine di esempio',
    imageUrl:       'https://placehold.co/540x250/e2e8f0/64748b?text=Featured+Image',
};

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: TOKENIZER — Scans FTL source character-by-character
// ═══════════════════════════════════════════════════════════════════════════
// Token types: TEXT, FTL_TAG, FTL_CLOSE_TAG, INTERPOLATION, HTML_TAG, COMMENT

function tokenizeFTL(src) {
    const tokens = [];
    let i = 0;
    const len = src.length;

    while (i < len) {
        // ── FTL comment: <#-- ... --> ──
        if (src.startsWith('<#--', i)) {
            const end = src.indexOf('-->', i + 4);
            if (end !== -1) { i = end + 3; continue; }
        }

        // ── FTL close tag: </#if>, </#list>, </#macro>, etc. ──
        if (src.startsWith('</#', i)) {
            const gt = src.indexOf('>', i + 3);
            if (gt !== -1) {
                const tagName = src.substring(i + 3, gt).trim();
                tokens.push({ type: 'FTL_CLOSE_TAG', name: tagName, raw: src.substring(i, gt + 1) });
                i = gt + 1;
                continue;
            }
        }

        // ── FTL open tag: <#if ...>, <#list ...>, <#assign ...>, <#function ...>, etc. ──
        if (src.startsWith('<#', i) && i + 2 < len && /[a-zA-Z]/.test(src[i + 2])) {
            const tagEnd = findFTLTagEndChar(src, i);
            if (tagEnd !== -1) {
                const raw = src.substring(i, tagEnd + 1);
                const inner = src.substring(i + 2, tagEnd).trim(); // e.g. "if titleValue?has_content"
                const spaceIdx = inner.indexOf(' ');
                const name = spaceIdx === -1 ? inner : inner.substring(0, spaceIdx);
                const attrs = spaceIdx === -1 ? '' : inner.substring(spaceIdx + 1).trim();
                const selfClose = raw.endsWith('/>');
                tokens.push({ type: 'FTL_TAG', name, attrs, raw, selfClose });
                i = tagEnd + 1;
                continue;
            }
        }

        // ── FTL interpolation: ${...} ──
        if (src[i] === '$' && src[i + 1] === '{') {
            const end = findInterpolationEnd(src, i + 2);
            if (end !== -1) {
                tokens.push({ type: 'INTERPOLATION', expr: src.substring(i + 2, end), raw: src.substring(i, end + 1) });
                i = end + 1;
                continue;
            }
        }

        // ── Plain text (accumulate until next special construct) ──
        let textStart = i;
        while (i < len) {
            if (src.startsWith('<#--', i) || src.startsWith('</#', i) || src.startsWith('<#', i) || (src[i] === '$' && src[i + 1] === '{')) break;
            i++;
        }
        if (i > textStart) {
            tokens.push({ type: 'TEXT', value: src.substring(textStart, i) });
        }
    }

    return tokens;
}

// Find the > that closes an FTL tag, handling > inside quotes and parens
function findFTLTagEndChar(src, start) {
    let pos = start + 1; // skip <
    let inSQ = false, inDQ = false, parenD = 0;
    while (pos < src.length) {
        const ch = src[pos];
        if (inSQ) { if (ch === "'") inSQ = false; }
        else if (inDQ) { if (ch === '"') inDQ = false; }
        else {
            if (ch === "'") inSQ = true;
            else if (ch === '"') inDQ = true;
            else if (ch === '(') parenD++;
            else if (ch === ')') parenD--;
            else if (ch === '>' && parenD <= 0) return pos;
        }
        pos++;
    }
    return -1;
}

// Find the } that closes a ${...} interpolation, handling nested { }
function findInterpolationEnd(src, start) {
    let depth = 1;
    let pos = start;
    while (pos < src.length && depth > 0) {
        if (src[pos] === '{') depth++;
        else if (src[pos] === '}') depth--;
        if (depth === 0) return pos;
        pos++;
    }
    return -1;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: AST BUILDER — Converts token list into a tree of nodes
// ═══════════════════════════════════════════════════════════════════════════

function buildAST(tokens) {
    const root = { type: 'ROOT', children: [] };
    const stack = [root];
    let pos = 0;

    // Block tags that have closing tags
    const BLOCK_TAGS = {
        'if': 'if', 'list': 'list', 'attempt': 'attempt',
        'macro': 'macro', 'function': 'function',
        'switch': 'switch', 'autoesc': 'autoesc',
        'outputformat': 'outputformat', 'noautoesc': 'noautoesc',
    };

    while (pos < tokens.length) {
        const tok = tokens[pos];
        const parent = stack[stack.length - 1];

        if (tok.type === 'TEXT') {
            parent.children.push({ type: 'TEXT', value: tok.value });
            pos++;
        }
        else if (tok.type === 'INTERPOLATION') {
            parent.children.push({ type: 'INTERPOLATION', expr: tok.expr });
            pos++;
        }
        else if (tok.type === 'FTL_TAG') {
            // Self-closing tags or void tags
            if (tok.selfClose || ['assign', 'include', 'import', 'setting', 'local', 'global', 'return', 'break', 'stop', 'flush', 'nested'].includes(tok.name)) {
                parent.children.push({ type: 'FTL_VOID', name: tok.name, attrs: tok.attrs, raw: tok.raw });
                pos++;
            }
            // <#else> — convert to special node inside parent <#if>
            else if (tok.name === 'else') {
                // Mark the parent if-node that we're now in the else branch
                if (parent.type === 'IF') {
                    parent._inElse = true;
                }
                pos++;
            }
            // <#elseif ...> — mark that we're in an elseif branch
            else if (tok.name === 'elseif') {
                if (parent.type === 'IF') {
                    parent._inElse = true;
                }
                pos++;
            }
            // Block-opening tags
            else if (BLOCK_TAGS[tok.name]) {
                const node = { type: tok.name.toUpperCase(), attrs: tok.attrs, children: [], _inElse: false };
                parent.children.push(node);
                stack.push(node);
                pos++;
            }
            else {
                // Unknown FTL tag — treat as void
                parent.children.push({ type: 'FTL_VOID', name: tok.name, attrs: tok.attrs, raw: tok.raw });
                pos++;
            }
        }
        else if (tok.type === 'FTL_CLOSE_TAG') {
            // Pop the stack until we find the matching open tag
            const closeName = tok.name;
            let found = false;
            for (let s = stack.length - 1; s > 0; s--) {
                if (stack[s].type === closeName.toUpperCase()) {
                    stack.length = s; // pop back to this level
                    found = true;
                    break;
                }
            }
            if (!found) {
                // Unmatched close tag — add as text
                parent.children.push({ type: 'TEXT', value: tok.raw });
            }
            pos++;
        }
        else {
            pos++;
        }
    }

    return root;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: EVALUATOR — Walks the AST and produces HTML output
// ═══════════════════════════════════════════════════════════════════════════

function evaluateAST(node, assignMap) {
    switch (node.type) {
        case 'ROOT':
            return node.children.map(c => evaluateAST(c, assignMap)).join('');

        case 'TEXT':
            return node.value;

        case 'INTERPOLATION':
            return resolveFTLVar(node.expr, assignMap);

        case 'FTL_VOID':
            return evaluateVoidTag(node, assignMap);

        case 'IF':
            return evaluateIfNode(node, assignMap);

        case 'LIST':
            return evaluateListNode(node, assignMap);

        case 'ATTEMPT':
            return evaluateAttemptNode(node, assignMap);

        case 'MACRO':
        case 'FUNCTION':
            // Remove function/macro definitions entirely
            return '';

        default:
            // Unknown block — evaluate children
            return node.children ? node.children.map(c => evaluateAST(c, assignMap)).join('') : '';
    }
}

function evaluateVoidTag(node, assignMap) {
    const name = node.name;
    const attrs = node.attrs;

    if (name === 'assign') {
        // Parse <#assign varName = "value">
        const m = attrs.match(/(\w+)\s*=\s*"([^"]*)"/);
        if (m) assignMap[m[1]] = m[2];
        const m2 = attrs.match(/(\w+)\s*=\s*'([^']*)'/);
        if (m2 && !m) assignMap[m2[1]] = m2[2];
        return '';
    }
    if (['return', 'break', 'stop', 'flush', 'include', 'import', 'setting', 'local', 'global', 'nested'].includes(name)) {
        return '';
    }
    return '';
}

function evaluateIfNode(node, assignMap) {
    // Always take the first (then) branch for preview
    // Children before _inElse are the "then" branch
    const thenChildren = [];
    for (const child of node.children) {
        if (child._inElse === true) break;
        // Stop at elseif/else markers (they're not real children, but we handle them)
        thenChildren.push(child);
    }
    return thenChildren.map(c => evaluateAST(c, assignMap)).join('');
}

function evaluateListNode(node, assignMap) {
    // Parse <#list collection as item>
    const m = node.attrs.match(/(\w+)\s+as\s+(\w+)/);
    if (!m) return '';
    const collection = m[1];
    const item = m[2];
    const items = SAMPLE_DATA[collection] || ['Elemento 1', 'Elemento 2', 'Elemento 3'];

    return items.map(val => {
        const localAssign = { ...assignMap, [item]: val };
        return node.children.map(c => {
            // Replace ${item.getData()} and ${item.xxx} in text/interpolation nodes
            const result = evaluateAST(c, localAssign);
            return result;
        }).join('');
    }).join('\n');
}

function evaluateAttemptNode(node, assignMap) {
    // <#attempt>...<#recover>... — just show the attempt body
    // The AST builder puts all children in one list; the first part is the attempt body
    return node.children.map(c => evaluateAST(c, assignMap)).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// VARIABLE RESOLUTION — Replace ${...} expressions with sample data
// ═══════════════════════════════════════════════════════════════════════════

function resolveFTLVar(expr, assignMap) {
    // Clean up default value syntax: !"" or !"default"
    let clean = expr.replace(/!["'][^"']*["']/g, '').trim();

    // ${htmlUtil.escapeAttribute(...)} — unwrap inner
    let m = clean.match(/^htmlUtil\.escapeAttribute\((.+)\)$/);
    if (m) return resolveFTLVar(m[1], assignMap);

    // ${htmlUtil.escape(...)} — unwrap inner
    m = clean.match(/^htmlUtil\.escape\((.+)\)$/);
    if (m) return resolveFTLVar(m[1], assignMap);

    // ${dateUtil.getDate(...)} — formatted date
    if (clean.startsWith('dateUtil.getDate')) return '05 Giugno 2026';

    // ${getterUtil.getString(...)} — unwrap inner
    m = clean.match(/^getterUtil\.getString\((.+)\)$/);
    if (m) return resolveFTLVar(m[1], assignMap);

    // ${validator.isNotNull(...)} — resolve inner
    m = clean.match(/^validator\.isNotNull\((.+)\)$/);
    if (m) return resolveFTLVar(m[1], assignMap);

    // ${variable.getAttribute("...")}
    m = clean.match(/^(\w+)\.getAttribute\(["'](\w+)["']\)$/);
    if (m) {
        const [, varName, attrName] = m;
        if (attrName === 'alt') return `Alt: ${resolveFTLVar(varName, assignMap)}`;
        if (attrName === 'fileEntryId') return '12345';
        return `${varName}.${attrName}`;
    }

    // ${variable.getData()}
    m = clean.match(/^(\w+)\.getData\(\)$/);
    if (m) {
        const varName = m[1];
        if (assignMap[varName] !== undefined) return assignMap[varName];
        if (varName === 'categoryLabel' || varName === 'categoryValue') return SAMPLE_DATA.category || 'Tecnologia';
        if (SAMPLE_DATA[varName] !== undefined) return SAMPLE_DATA[varName];
        return varName;
    }

    // ${variable?string(...)}
    m = clean.match(/^(\w+)\?string\(/);
    if (m) {
        const varName = m[1];
        if (SAMPLE_DATA[varName] !== undefined) return SAMPLE_DATA[varName];
        return varName;
    }

    // ${variable?has_content}
    m = clean.match(/^(\w+)\?has_content$/);
    if (m) return 'true';

    // ${variable.something.something} — nested property
    m = clean.match(/^(\w+)(\.\w+)+$/);
    if (m) {
        const varName = m[1];
        if (SAMPLE_DATA[varName] !== undefined) return SAMPLE_DATA[varName];
        return varName;
    }

    // ${variable} — simple
    m = clean.match(/^(\w+)$/);
    if (m) {
        const varName = m[1];
        if (assignMap[varName] !== undefined) return assignMap[varName];
        if (SAMPLE_DATA[varName] !== undefined) return SAMPLE_DATA[varName];
        return varName;
    }

    // Fallback: extract root variable name
    const rootVar = clean.split('.')[0].split('(')[0].split('?')[0].trim();
    if (SAMPLE_DATA[rootVar] !== undefined) return SAMPLE_DATA[rootVar];
    if (assignMap[rootVar] !== undefined) return assignMap[rootVar];
    return rootVar || clean;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

function simulateFreeMarker(ftlCode) {
    const tokens = tokenizeFTL(ftlCode);
    const ast = buildAST(tokens);
    const assignMap = {};
    let result = evaluateAST(ast, assignMap);

    // Clean up excessive blank lines
    result = result.replace(/\n\s*\n\s*\n/g, '\n\n');

    return result;
}

// ── Language detection from code fence ────────────────────────────────────
const LANG_MAP = {
    freemarker: 'freemarker', ftl: 'freemarker',
    html: 'html', htm: 'html',
    xml: 'xml', svg: 'xml',
    css: 'css', scss: 'css',
    js: 'javascript', javascript: 'javascript', jsx: 'javascript',
    ts: 'javascript', typescript: 'javascript', tsx: 'javascript',
    json: 'json',
    java: 'java', python: 'python', py: 'python',
    sql: 'sql',
    bash: 'bash', sh: 'bash', shell: 'bash',
    yaml: 'yaml', yml: 'yaml',
    markdown: 'markdown', md: 'markdown',
};

function detectLanguage(lang) {
    if (!lang) return 'text';
    return LANG_MAP[lang.toLowerCase()] || lang.toLowerCase();
}

function isPreviewable(language) {
    return ['freemarker', 'ftl', 'html', 'htm', 'xml', 'svg'].includes(language);
}

// ── CodePanelFP Component ─────────────────────────────────────────────────

function CodePanelFP({ code, language, onClose }) {
    const t = getDictionary();
    const [activeTab, setActiveTab] = useState('code'); // 'code' | 'preview'
    const [copied, setCopied] = useState(false);
    const previewRef = useRef(null);
    const codeScrollRef = useRef(null);
    const lineNumbersRef = useRef(null);
    const lang = detectLanguage(language);
    const displayCode = code || '';

    // Update preview iframe when tab switches to preview
    useEffect(() => {
        if (!previewRef.current) return;

        let htmlContent = displayCode;
        if (lang === 'freemarker') {
            htmlContent = simulateFreeMarker(displayCode);
        }

        const fullHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <style>
        html, body { margin: 0; padding: 0; height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff; color: #1e293b; overflow: auto; }
        body { padding: 16px; box-sizing: border-box; }
        img { max-width: 100%; height: auto; }
        .badge { font-size: 0.75em; }
        .container, .container-fluid { max-width: 100%; }
        /* Preserve inline styles from the template */
        [style] { /* keep them */ }
    </style>
</head>
<body>${htmlContent}</body>
</html>`;

        const iframe = previewRef.current;
        iframe.srcdoc = fullHtml;
    }, [displayCode, activeTab, lang]);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(displayCode).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [displayCode]);

    const highlightedHtml = useMemo(() => {
        return highlightCode(displayCode, lang);
    }, [displayCode, lang]);

    // Sync scroll between code view and line numbers
    const handleCodeScroll = useCallback(() => {
        if (codeScrollRef.current && lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = codeScrollRef.current.scrollTop;
        }
    }, []);

    const langLabel = language || 'code';

    return (
        <div className="afp-code-panel">
            {/* Header */}
            <div className="afp-code-panel-header">
                <div className="afp-code-panel-title">
                    <span className="afp-code-panel-lang-badge">{langLabel}</span>
                    <span>{t.codePanelTitle || 'Code Editor'}</span>
                </div>
                <div className="afp-code-panel-actions">
                    <button className="afp-code-panel-btn" onClick={handleCopy} title={t.codePanelCopy || 'Copy'}>
                        {copied ? (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
                            </svg>
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="5" y="5" width="8" height="8" rx="1.5" />
                                <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" />
                            </svg>
                        )}
                    </button>
                    <button className="afp-code-panel-btn afp-code-panel-close" onClick={onClose} title={t.codePanelClose || 'Close'}>
                        ✕
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="afp-code-panel-tabs">
                <button className={`afp-code-panel-tab${activeTab === 'code' ? ' afp-code-panel-tab-active' : ''}`}
                    onClick={() => setActiveTab('code')}>
                    {t.codePanelTabCode || 'Code'}
                </button>
                {isPreviewable(lang) && (
                    <button className={`afp-code-panel-tab${activeTab === 'preview' ? ' afp-code-panel-tab-active' : ''}`}
                        onClick={() => setActiveTab('preview')}>
                        {t.codePanelTabPreview || 'Preview'}
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="afp-code-panel-content">
                {activeTab === 'code' && (
                    <div className="afp-code-editor-wrap">
                        <div className="afp-code-line-numbers" ref={lineNumbersRef} aria-hidden="true">
                            {displayCode.split('\n').map((_, i) => (
                                <div key={i} className="afp-code-line-num">{i + 1}</div>
                            ))}
                        </div>
                        <div className="afp-code-editor-inner">
                            <pre ref={codeScrollRef} className="afp-code-highlighted" onScroll={handleCodeScroll}>
                                <code dangerouslySetInnerHTML={{ __html: highlightedHtml + '\n' }} />
                            </pre>
                        </div>
                    </div>
                )}
                {activeTab === 'preview' && (
                    <div className="afp-preview-wrap">
                        <div className="afp-preview-label">
                            <span>{t.codePanelPreviewLabel || 'Live Preview'}</span>
                        </div>
                        <div className="afp-preview-viewport">
                            <iframe
                                ref={previewRef}
                                className="afp-preview-frame"
                                sandbox="allow-same-origin"
                                title="Code Preview"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CodePanelFP;
export { detectLanguage, isPreviewable, simulateFreeMarker, LANG_MAP };