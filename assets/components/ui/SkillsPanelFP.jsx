/**
 * components/ui/SkillsPanelFP.jsx
 * Pannello Skills — overlay per gestire le skill dell'utente.
 * Permette di creare, importare (drag & drop .md), attivare/disattivare ed eliminare skill.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { loadSkills, saveSkills, deleteOneSkill } from '../../lib/skillsManager.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
    return 'skill_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ── Skill Card ───────────────────────────────────────────────────────────────

function SkillCard({ skill, onToggle, onDelete, onEdit, t }) {
    return (
        <div className={`afp-skill-card${skill.active ? ' afp-skill-card-active' : ''}`}>
            <div className="afp-skill-card-header">
                <div className="afp-skill-card-info">
                    <span className="afp-skill-card-icon">{skill.icon || '🧠'}</span>
                    <div className="afp-skill-card-text">
                        <h4 className="afp-skill-card-name">{skill.name}</h4>
                        {skill.description && (
                            <p className="afp-skill-card-desc">{skill.description}</p>
                        )}
                    </div>
                </div>
                <label className="afp-skill-toggle" title={skill.active ? t.skillDeactivate : t.skillActivate}>
                    <input
                        type="checkbox"
                        checked={skill.active}
                        onChange={() => onToggle(skill.id)}
                    />
                    <span className="afp-skill-toggle-slider" />
                </label>
            </div>
            <div className="afp-skill-card-meta">
                <span className="afp-skill-card-date">
                    {new Date(skill.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <div className="afp-skill-card-actions">
                    <button className="afp-skill-card-btn" onClick={() => onEdit(skill)} title={t.skillEdit}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button className="afp-skill-card-btn afp-skill-card-btn-danger" onClick={() => onDelete(skill.id)} title={t.skillDelete}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Template helpers ──────────────────────────────────────────────────────────

const PARAM_TYPES = ['text', 'number', 'boolean', 'select', 'date', 'object'];
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const ICON_CATEGORIES = [
    { label: '🧠 General', icons: ['🧠', '⚡', '🎯', '💡', '🔧', '🛠️', '📋', '📊', '🔍', '⚙️', '🚀', '✨'] },
    { label: '📝 Content', icons: ['📝', '📄', '📰', '📖', '✍️', '🖋️', '📑', '📃', '📜', '📎'] },
    { label: '💬 Communication', icons: ['💬', '🗣️', '📢', '📨', '✉️', '📧', '🔔', '🤝', '👋', '🙋'] },
    { label: '💻 Technology', icons: ['💻', '🖥️', '⌨️', '📱', '🌐', '🔗', '📡', '🔒', '🔑', '💾'] },
    { label: '🎨 Creative', icons: ['🎨', '🖌️', '🎭', '🎬', '📸', '🎵', '🎸', '✏️', '📐', '🖼️'] },
    { label: '📊 Data', icons: ['📊', '📈', '📉', '🗂️', '🗃️', '📋', '📌', '🏷️', '🔢', '💲'] },
    { label: '👥 People', icons: ['👥', '🧑', '👨‍💼', '👩‍💼', '🧑‍💻', '🎓', '🛡️', '👑', '🤖', '🦾'] },
    { label: '🌍 Context', icons: ['🌍', '🗺️', '🏢', '🏛️', '🏗️', '🏠', '🚢', '✈️', '🚗', '⏰'] },
];

const SKILL_TEMPLATE = {
    icon: '🧠',
    name: '',
    description: '',
    trigger: '',
    steps: [''],
    rules: [{ key: '', value: '' }],
    tools: [],  // { id, url, method, params: [{ id, name, type, required, description }] }
};

/**
 * Parse markdown content into template fields.
 * Supports the standard skill format:
 *   # 🧠 Name
 *   > Description
 *   ## Quando attivare / When to activate
 *   trigger text...
 *   ## Istruzioni / Instructions
 *   1. step one
 *   2. step two
 *   ## Regole / Rules
 *   - **key**: value
 */
function parseTemplateFromContent(content) {
    const tpl = { ...SKILL_TEMPLATE, steps: [''], rules: [{ key: '', value: '' }], tools: [] };

    if (!content) return tpl;

    // Extract emoji icon from heading
    const headingMatch = content.match(/^#\s+(\S+)/m);
    if (headingMatch) {
        const emojiMatch = headingMatch[1].match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
        if (emojiMatch) {
            tpl.icon = emojiMatch[1];
            tpl.name = headingMatch[1].slice(emojiMatch[1].length).trim();
        } else {
            tpl.name = headingMatch[1].trim();
        }
    }

    // Extract blockquote description
    const descMatch = content.match(/^>\s*(.+)$/m);
    if (descMatch) tpl.description = descMatch[1].trim();

    // Extract trigger section
    const triggerMatch = content.match(/##\s+(?:Quando attivare|When to activate|Trigger)\s*\n([\s\S]*?)(?=\n##|\n$|$)/i);
    if (triggerMatch) tpl.trigger = triggerMatch[1].trim();

    // Extract steps (numbered list)
    const stepsMatch = content.match(/##\s+(?:Istruzioni|Instructions|Steps?)\s*\n([\s\S]*?)(?=\n##|\n$|$)/i);
    if (stepsMatch) {
        const steps = stepsMatch[1]
            .split('\n')
            .map(l => l.replace(/^\s*\d+\.\s*/, '').trim())
            .filter(Boolean);
        if (steps.length) tpl.steps = steps;
    }

    // Extract rules (key-value pairs)
    const rulesMatch = content.match(/##\s+(?:Regole|Rules)\s*\n([\s\S]*?)(?=\n##|\n$|$)/i);
    if (rulesMatch) {
        const rules = rulesMatch[1]
            .split('\n')
            .map(l => {
                const m = l.match(/^-\s+\*\*(.+?)\*\*:\s*(.+)$/);
                return m ? { key: m[1].trim(), value: m[2].trim() } : null;
            })
            .filter(Boolean);
        if (rules.length) tpl.rules = rules;
    }

    // Extract tools section
    // Format: ### METHOD /path/to/api
    //         | Param | Type | Required | Description |
    const toolsRegex = /###\s+(GET|POST|PUT|DELETE|PATCH)\s+(\S+)\n([\s\S]*?)(?=\n###|\n##[^#]|\n$|$)/gi;
    let toolMatch;
    while ((toolMatch = toolsRegex.exec(content)) !== null) {
        const method = toolMatch[1];
        const url = toolMatch[2];
        const body = toolMatch[3] || '';
        const params = [];
        // Parse table rows: | name | type | ✓ | description |
        const paramRegex = /\|\s*`?(\w+)`?\s*\|\s*(\w+)\s*\|\s*(✓|yes|true|✔)?\s*\|\s*(.+?)\s*\|/gi;
        let paramMatch;
        while ((paramMatch = paramRegex.exec(body)) !== null) {
            params.push({
                id: generateId(),
                name: paramMatch[1],
                type: PARAM_TYPES.includes(paramMatch[2].toLowerCase()) ? paramMatch[2].toLowerCase() : 'text',
                required: !!(paramMatch[3] && paramMatch[3].trim()),
                description: paramMatch[4].trim(),
            });
        }
        tpl.tools.push({
            id: generateId(),
            url,
            method,
            params,
        });
    }

    return tpl;
}

/**
 * Generate markdown content from template fields.
 */
function generateContentFromTemplate(tpl) {
    const lines = [];

    // Heading with icon + name
    lines.push(`# ${tpl.icon || '🧠'} ${tpl.name || 'Skill'}`);
    lines.push('');

    // Description as blockquote
    if (tpl.description) {
        lines.push(`> ${tpl.description}`);
        lines.push('');
    }

    // Trigger section
    if (tpl.trigger) {
        lines.push('## Quando attivare');
        lines.push(tpl.trigger);
        lines.push('');
    }

    // Steps section
    const validSteps = tpl.steps.filter(s => s.trim());
    if (validSteps.length) {
        lines.push('## Istruzioni');
        validSteps.forEach((step, i) => {
            lines.push(`${i + 1}. ${step}`);
        });
        lines.push('');
    }

    // Rules section
    const validRules = tpl.rules.filter(r => r.key.trim() || r.value.trim());
    if (validRules.length) {
        lines.push('## Regole');
        validRules.forEach(r => {
            if (r.key.trim() && r.value.trim()) {
                lines.push(`- **${r.key.trim()}**: ${r.value.trim()}`);
            }
        });
        lines.push('');
    }

    // Tools section
    const validTools = (tpl.tools || []).filter(t => t.url && t.url.trim());
    if (validTools.length) {
        lines.push('## Tools');
        validTools.forEach(tool => {
            lines.push(`### ${tool.method || 'GET'} ${tool.url.trim()}`);
            const validParams = (tool.params || []).filter(p => p.name && p.name.trim());
            if (validParams.length) {
                lines.push('| Param | Type | Required | Description |');
                lines.push('|-------|------|----------|-------------|');
                validParams.forEach(p => {
                    const req = p.required ? '✓' : '';
                    lines.push(`| \`${p.name.trim()}\` | ${p.type || 'text'} | ${req} | ${p.description || ''} |`);
                });
            }
            lines.push('');
        });
    }

    return lines.join('\n').trim();
}

// ── Skill Editor ──────────────────────────────────────────────────────────────

function SkillEditor({ skill, onSave, onCancel, t }) {
    // Determine initial mode: if editing existing skill with content that doesn't match template, start in raw mode
    const existingContent = skill?.content || '';
    const isRawDefault = existingContent && !existingContent.match(/^#\s+\S/m);

    const [mode, setMode] = useState(isRawDefault ? 'raw' : 'template');  // 'template' | 'raw'
    const [icon, setIcon] = useState(skill?.icon || '🧠');
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [name, setName] = useState(skill?.name || '');
    const [description, setDescription] = useState(skill?.description || '');
    const [content, setContent] = useState(existingContent);

    // Template fields
    const [trigger, setTrigger] = useState('');
    const [steps, setSteps] = useState(['']);
    const [rules, setRules] = useState([{ key: '', value: '' }]);
    const [tools, setTools] = useState([]);  // { id, url, method, params: [{ id, name, type, required, description }] }

    // Initialize template fields from existing content
    React.useEffect(() => {
        if (existingContent && mode === 'template') {
            const parsed = parseTemplateFromContent(existingContent);
            setIcon(parsed.icon);
            setName(parsed.name || skill?.name || '');
            setDescription(parsed.description || skill?.description || '');
            setTrigger(parsed.trigger);
            setSteps(parsed.steps);
            setRules(parsed.rules);
            setTools(parsed.tools || []);
        } else if (!existingContent) {
            setIcon('🧠');
            setName(skill?.name || '');
            setDescription(skill?.description || '');
            setTrigger('');
            setSteps(['']);
            setRules([{ key: '', value: '' }]);
            setTools([]);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const addStep = () => setSteps([...steps, '']);
    const removeStep = (i) => setSteps(steps.filter((_, idx) => idx !== i));
    const updateStep = (i, val) => setSteps(steps.map((s, idx) => idx === i ? val : s));

    const addRule = () => setRules([...rules, { key: '', value: '' }]);
    const removeRule = (i) => setRules(rules.filter((_, idx) => idx !== i));
    const updateRule = (i, field, val) => setRules(rules.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

    // Tools helpers
    const addTool = () => setTools([...tools, { id: generateId(), url: '', method: 'GET', params: [] }]);
    const removeTool = (ti) => setTools(tools.filter((_, idx) => idx !== ti));
    const updateTool = (ti, field, val) => setTools(tools.map((t, idx) => idx === ti ? { ...t, [field]: val } : t));
    const addParam = (ti) => setTools(tools.map((t, idx) => idx === ti ? { ...t, params: [...t.params, { id: generateId(), name: '', type: 'text', required: false, description: '' }] } : t));
    const removeParam = (ti, pi) => setTools(tools.map((t, idx) => idx === ti ? { ...t, params: t.params.filter((_, pidx) => pidx !== pi) } : t));
    const updateParam = (ti, pi, field, val) => setTools(tools.map((t, idx) => idx === ti ? { ...t, params: t.params.map((p, pidx) => pidx === pi ? { ...p, [field]: val } : p) } : t));

    const switchToTemplate = () => {
        if (content) {
            const parsed = parseTemplateFromContent(content);
            setIcon(parsed.icon);
            setName(parsed.name || name);
            setDescription(parsed.description || description);
            setTrigger(parsed.trigger);
            setSteps(parsed.steps);
            setRules(parsed.rules);
            setTools(parsed.tools || []);
        }
        setMode('template');
    };

    const switchToRaw = () => {
        if (mode === 'template') {
            // Generate content from current template fields
            const generated = generateContentFromTemplate({ icon, name, description, trigger, steps, rules, tools });
            setContent(generated);
        }
        setMode('raw');
    };

    const handleSave = () => {
        const finalContent = mode === 'template'
            ? generateContentFromTemplate({ icon, name, description, trigger, steps, rules, tools })
            : content.trim();

        if (!name.trim() || !finalContent.trim()) return;

        // Re-parse icon from content if in raw mode
        const finalIcon = mode === 'raw'
            ? (() => {
                const m = finalContent.match(/^#\s+(\S+)/m);
                if (m) {
                    const e = m[1].match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
                    return e ? e[1] : '🧠';
                }
                return icon;
            })()
            : icon;

        const finalName = mode === 'raw'
            ? (() => {
                const m = finalContent.match(/^#\s+(\S+)/m);
                if (m) {
                    const e = m[1].match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
                    return e ? m[1].slice(e[1].length).trim() : m[1].trim();
                }
                return name;
            })()
            : name;

        const finalDescription = mode === 'raw'
            ? (() => {
                const m = finalContent.match(/^>\s*(.+)$/m);
                return m ? m[1].trim() : description;
            })()
            : description;

        onSave({
            ...skill,
            id: skill?.id || generateId(),
            name: finalName.trim(),
            description: finalDescription.trim(),
            icon: finalIcon || '🧠',
            content: finalContent,
            active: skill?.active !== undefined ? skill.active : true,
            createdAt: skill?.createdAt || new Date().toISOString(),
        });
    };

    const canSave = mode === 'template'
        ? name.trim() && (trigger.trim() || steps.some(s => s.trim()) || rules.some(r => r.key.trim() || r.value.trim()) || tools.some(t => t.url.trim()))
        : name.trim() && content.trim();

    return (
        <div className="afp-skill-editor">
            {/* Mode toggle */}
            <div className="afp-skill-editor-mode">
                <button
                    className={`afp-skill-editor-mode-btn${mode === 'template' ? ' afp-skill-editor-mode-active' : ''}`}
                    onClick={() => { if (mode !== 'template') switchToTemplate(); }}
                >
                    📋 {t.skillModeTemplate}
                </button>
                <button
                    className={`afp-skill-editor-mode-btn${mode === 'raw' ? ' afp-skill-editor-mode-active' : ''}`}
                    onClick={() => { if (mode !== 'raw') switchToRaw(); }}
                >
                    ✏️ {t.skillModeRaw}
                </button>
            </div>

            {/* Common fields: icon + name */}
            <div className="afp-skill-editor-row">
                <div className="afp-skill-editor-field">
                    <label>{t.skillIcon}</label>
                    <div className="afp-skill-icon-picker-wrapper">
                        <button
                            type="button"
                            className="afp-skill-icon-picker-trigger"
                            onClick={() => setShowIconPicker(!showIconPicker)}
                            title={t.skillIconSelect}
                        >
                            <span className="afp-skill-icon-picker-emoji">{icon}</span>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </button>
                        {showIconPicker && (
                            <div className="afp-skill-icon-picker-dropdown">
                                {ICON_CATEGORIES.map(cat => (
                                    <div key={cat.label} className="afp-skill-icon-picker-category">
                                        <div className="afp-skill-icon-picker-cat-label">{cat.label}</div>
                                        <div className="afp-skill-icon-picker-grid">
                                            {cat.icons.map(emoji => (
                                                <button
                                                    key={emoji}
                                                    type="button"
                                                    className={`afp-skill-icon-picker-item${icon === emoji ? ' afp-skill-icon-picker-item-active' : ''}`}
                                                    onClick={() => { setIcon(emoji); setShowIconPicker(false); }}
                                                    title={emoji}
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="afp-skill-editor-field afp-skill-editor-field-grow">
                    <label>{t.skillName}</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t.skillNamePlaceholder}
                        className="afp-skill-editor-input"
                    />
                </div>
            </div>

            {/* Description */}
            <div className="afp-skill-editor-field">
                <label>{t.skillDescription}</label>
                <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t.skillDescriptionPlaceholder}
                    className="afp-skill-editor-input"
                />
            </div>

            {mode === 'template' ? (
                <>
                    {/* Trigger */}
                    <div className="afp-skill-editor-field">
                        <label>{t.skillTrigger}</label>
                        <textarea
                            value={trigger}
                            onChange={(e) => setTrigger(e.target.value)}
                            placeholder={t.skillTriggerPlaceholder}
                            className="afp-skill-editor-textarea afp-skill-editor-textarea-sm"
                            rows={3}
                        />
                    </div>

                    {/* Steps */}
                    <div className="afp-skill-editor-field">
                        <label>{t.skillSteps}</label>
                        <div className="afp-skill-editor-list">
                            {steps.map((step, i) => (
                                <div key={i} className="afp-skill-editor-list-item">
                                    <span className="afp-skill-editor-list-num">{i + 1}.</span>
                                    <input
                                        type="text"
                                        value={step}
                                        onChange={(e) => updateStep(i, e.target.value)}
                                        placeholder={t.skillStepPlaceholder}
                                        className="afp-skill-editor-input afp-skill-editor-input-grow"
                                    />
                                    {steps.length > 1 && (
                                        <button className="afp-skill-editor-list-remove" onClick={() => removeStep(i)} title={t.skillRemoveStep}>×</button>
                                    )}
                                </div>
                            ))}
                            <button className="afp-skill-editor-list-add" onClick={addStep}>
                                + {t.skillAddStep}
                            </button>
                        </div>
                    </div>

                    {/* Rules */}
                    <div className="afp-skill-editor-field">
                        <label>{t.skillRules}</label>
                        <div className="afp-skill-editor-list">
                            {rules.map((rule, i) => (
                                <div key={i} className="afp-skill-editor-list-item afp-skill-editor-list-item-rule">
                                    <input
                                        type="text"
                                        value={rule.key}
                                        onChange={(e) => updateRule(i, 'key', e.target.value)}
                                        placeholder={t.skillRuleKeyPlaceholder}
                                        className="afp-skill-editor-input afp-skill-editor-input-key"
                                    />
                                    <input
                                        type="text"
                                        value={rule.value}
                                        onChange={(e) => updateRule(i, 'value', e.target.value)}
                                        placeholder={t.skillRuleValuePlaceholder}
                                        className="afp-skill-editor-input afp-skill-editor-input-grow"
                                    />
                                    {rules.length > 1 && (
                                        <button className="afp-skill-editor-list-remove" onClick={() => removeRule(i)} title={t.skillRemoveRule}>×</button>
                                    )}
                                </div>
                            ))}
                            <button className="afp-skill-editor-list-add" onClick={addRule}>
                                + {t.skillAddRule}
                            </button>
                        </div>
                    </div>

                    {/* Tools */}
                    <div className="afp-skill-editor-field">
                        <label>{t.skillTools}</label>
                        <p className="afp-skill-editor-hint">{t.skillToolsHint}</p>
                        <div className="afp-skill-editor-tools">
                            {tools.map((tool, ti) => (
                                <div key={tool.id || ti} className="afp-skill-tool-card">
                                    <div className="afp-skill-tool-card-header">
                                        <div className="afp-skill-tool-method-row">
                                            <select
                                                value={tool.method}
                                                onChange={(e) => updateTool(ti, 'method', e.target.value)}
                                                className="afp-skill-tool-method"
                                            >
                                                {HTTP_METHODS.map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="text"
                                                value={tool.url}
                                                onChange={(e) => updateTool(ti, 'url', e.target.value)}
                                                placeholder={t.skillToolUrlPlaceholder}
                                                className="afp-skill-editor-input afp-skill-editor-input-grow"
                                            />
                                            <button className="afp-skill-editor-list-remove" onClick={() => removeTool(ti)} title={t.skillRemoveTool}>×</button>
                                        </div>
                                    </div>
                                    {/* Parameters */}
                                    <div className="afp-skill-tool-params">
                                        <div className="afp-skill-tool-params-header">
                                            <span>{t.skillToolParams}</span>
                                            <button className="afp-skill-editor-list-add afp-skill-editor-list-add-sm" onClick={() => addParam(ti)}>
                                                + {t.skillAddParam}
                                            </button>
                                        </div>
                                        {(tool.params || []).length > 0 && (
                                            <div className="afp-skill-tool-params-table">
                                                <div className="afp-skill-tool-params-row afp-skill-tool-params-row-head">
                                                    <span className="afp-skill-tool-param-name-col">{t.skillParamName}</span>
                                                    <span className="afp-skill-tool-param-type-col">{t.skillParamType}</span>
                                                    <span className="afp-skill-tool-param-req-col">{t.skillParamRequired}</span>
                                                    <span className="afp-skill-tool-param-desc-col">{t.skillParamDescription}</span>
                                                    <span className="afp-skill-tool-param-del-col"></span>
                                                </div>
                                                {tool.params.map((param, pi) => (
                                                    <div key={param.id || pi} className="afp-skill-tool-params-row">
                                                        <input
                                                            type="text"
                                                            value={param.name}
                                                            onChange={(e) => updateParam(ti, pi, 'name', e.target.value)}
                                                            placeholder={t.skillParamNamePlaceholder}
                                                            className="afp-skill-editor-input afp-skill-tool-param-input"
                                                        />
                                                        <select
                                                            value={param.type}
                                                            onChange={(e) => updateParam(ti, pi, 'type', e.target.value)}
                                                            className="afp-skill-tool-param-select"
                                                        >
                                                            {PARAM_TYPES.map(pt => (
                                                                <option key={pt} value={pt}>{pt}</option>
                                                            ))}
                                                        </select>
                                                        <label className="afp-skill-tool-param-checkbox">
                                                            <input
                                                                type="checkbox"
                                                                checked={param.required}
                                                                onChange={(e) => updateParam(ti, pi, 'required', e.target.checked)}
                                                            />
                                                            <span className="afp-skill-tool-param-checkmark" />
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={param.description}
                                                            onChange={(e) => updateParam(ti, pi, 'description', e.target.value)}
                                                            placeholder={t.skillParamDescPlaceholder}
                                                            className="afp-skill-editor-input afp-skill-tool-param-input"
                                                        />
                                                        <button className="afp-skill-editor-list-remove afp-skill-editor-list-remove-sm" onClick={() => removeParam(ti, pi)} title={t.skillRemoveParam}>×</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <button className="afp-skill-editor-list-add afp-skill-editor-list-add-tool" onClick={addTool}>
                                + {t.skillAddTool}
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                /* Raw markdown editor */
                <div className="afp-skill-editor-field afp-skill-editor-field-content">
                    <label>{t.skillContent}</label>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={t.skillContentPlaceholder}
                        className="afp-skill-editor-textarea"
                        rows={12}
                    />
                </div>
            )}

            <div className="afp-skill-editor-actions">
                <button className="afp-skill-editor-cancel" onClick={onCancel}>{t.skillCancel}</button>
                <button className="afp-skill-editor-save" onClick={handleSave} disabled={!canSave}>
                    {skill?.id ? t.skillSave : t.skillCreate}
                </button>
            </div>
        </div>
    );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

function SkillsPanelFP({ t, onClose }) {
    const [skills, setSkills] = useState(() => {
        // Synchronous initial load from localStorage for instant UI
        try { return JSON.parse(localStorage.getItem('acfp_skills_v1') || '[]'); } catch { return []; }
    });
    const [editing, setEditing] = useState(null);   // null | skill object | {} (new)
    const [dragOver, setDragOver] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const fileInputRef = useRef(null);

    // Load skills from Liferay on mount (async, merges with localStorage)
    useEffect(() => {
        loadSkills().then(loaded => {
            setSkills(loaded);
        }).catch(() => {
            // Keep localStorage data as fallback
        });
    }, []);

    const updateSkills = useCallback(async (newSkills) => {
        setSkills(newSkills);
        // Save to localStorage immediately, sync to Liferay in background
        try { await saveSkills(newSkills); } catch (_) { /* localStorage already saved */ }
    }, []);

    const handleToggle = useCallback((id) => {
        setSkills(prev => {
            const updated = prev.map(s => s.id === id ? { ...s, active: !s.active } : s);
            saveSkills(updated).catch(() => {});
            return updated;
        });
    }, []);

    const handleDelete = useCallback((id) => {
        if (confirmDelete === id) {
            setSkills(prev => {
                const updated = prev.filter(s => s.id !== id);
                saveSkills(updated).catch(() => {});
                deleteOneSkill(id).catch(() => {});
                return updated;
            });
            setConfirmDelete(null);
        } else {
            setConfirmDelete(id);
            setTimeout(() => setConfirmDelete(null), 3000);
        }
    }, [confirmDelete]);

    const handleEdit = useCallback((skill) => {
        setEditing(skill);
    }, []);

    const handleSave = useCallback((skillData) => {
        setSkills(prev => {
            const existing = prev.findIndex(s => s.id === skillData.id);
            let updated;
            if (existing >= 0) {
                updated = [...prev];
                updated[existing] = skillData;
            } else {
                updated = [...prev, skillData];
            }
            saveSkills(updated).catch(() => {});
            return updated;
        });
        setEditing(null);
    }, []);

    const handleFileDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        const files = Array.from(e.dataTransfer?.files || []);
        const mdFiles = files.filter(f => f.name.endsWith('.md') || f.type === 'text/markdown');
        mdFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const content = ev.target.result;
                const nameFromFile = file.name.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
                // Extract first heading as name if present
                const headingMatch = content.match(/^#\s+(.+)$/m);
                const skillName = headingMatch ? headingMatch[1].trim() : nameFromFile;
                // Extract first paragraph after heading as description
                const descMatch = content.match(/^#\s+.+\n+\s*(.+)$/m);
                const description = descMatch ? descMatch[1].slice(0, 120) : '';
                // Extract emoji from heading if present
                const emojiMatch = skillName.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u);
                const icon = emojiMatch ? emojiMatch[1] : '🧠';
                const cleanName = emojiMatch ? skillName.replace(emojiMatch[0], '').trim() : skillName;
                const newSkill = {
                    id: generateId(),
                    name: cleanName || nameFromFile,
                    description,
                    icon,
                    content,
                    active: true,
                    createdAt: new Date().toISOString(),
                };
                setSkills(prev => {
                    const updated = [...prev, newSkill];
                    saveSkills(updated).catch(() => {});
                    return updated;
                });
            };
            reader.readAsText(file);
        });
    }, []);

    const handleFileSelect = useCallback((e) => {
        const files = Array.from(e.target.files || []);
        // Reuse drop logic
        handleFileDrop({ preventDefault: () => {}, stopPropagation: () => {}, dataTransfer: { files: files } });
        e.target.value = '';
    }, [handleFileDrop]);

    const handleCreateNew = () => {
        setEditing({});
    };

    const handleCancelEdit = () => {
        setEditing(null);
    };

    const activeSkills = skills.filter(s => s.active).length;

    return (
        <div className="afp-skills-overlay" onClick={onClose}>
            <div className="afp-skills-card" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="afp-skills-header">
                    <div className="afp-skills-header-left">
                        <h2 className="afp-skills-title">{t.skillTitle}</h2>
                        <span className="afp-skills-badge">{activeSkills}/{skills.length}</span>
                    </div>
                    <button className="afp-skills-close" onClick={onClose} aria-label="Close">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="afp-skills-body">
                    {editing !== null ? (
                        <SkillEditor
                            skill={editing}
                            onSave={handleSave}
                            onCancel={handleCancelEdit}
                            t={t}
                        />
                    ) : (
                        <>
                            {/* Drop zone */}
                            <div
                                className={`afp-skills-dropzone${dragOver ? ' afp-skills-dropzone-active' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleFileDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="afp-skills-dropzone-icon">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                                    </svg>
                                </div>
                                <p className="afp-skills-dropzone-text">{t.skillDropText}</p>
                                <p className="afp-skills-dropzone-sub">{t.skillDropSub}</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".md,text/markdown"
                                    multiple
                                    onChange={handleFileSelect}
                                    style={{ display: 'none' }}
                                />
                            </div>

                            {/* Create new button */}
                            <button className="afp-skills-create-btn" onClick={handleCreateNew}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                                {t.skillCreateNew}
                            </button>

                            {/* Skills list */}
                            {skills.length === 0 ? (
                                <div className="afp-skills-empty">
                                    <div className="afp-skills-empty-icon">📂</div>
                                    <p className="afp-skills-empty-text">{t.skillEmpty}</p>
                                    <p className="afp-skills-empty-sub">{t.skillEmptySub}</p>
                                </div>
                            ) : (
                                <div className="afp-skills-list">
                                    {skills.map(skill => (
                                        <SkillCard
                                            key={skill.id}
                                            skill={skill}
                                            onToggle={handleToggle}
                                            onDelete={handleDelete}
                                            onEdit={handleEdit}
                                            t={t}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SkillsPanelFP;