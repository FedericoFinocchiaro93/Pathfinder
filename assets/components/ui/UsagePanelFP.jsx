/**
 * components/ui/UsagePanelFP.jsx
 * Pannello monitoraggio utilizzo LLM — overlay sopra la chat.
 * Mostra token usage, costi, context window, grafici.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    getSessionStats,
    getAllTimeStats,
    resetAllTime,
    getBudget,
    setBudget,
    formatCost,
    formatTokens,
    getPricing,
    setGeminiContextLength,
} from '../../lib/llmUsageTracker.js';
import { fetchGeminiModelInfo } from '../../lib/llm/gemini.js';

// ── Mini SVG chart components ──────────────────────────────────────────────

/** Donut chart for context window usage */
function ContextDonut({ usedPct, size = 120 }) {
    const r = (size - 16) / 2;
    const c = 2 * Math.PI * r;
    const offset = c - (c * Math.min(usedPct, 100)) / 100;
    const color = usedPct > 80 ? '#ef4444' : usedPct > 50 ? '#f59e0b' : '#22c55e';
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--afp-border, #2a2a3a)" strokeWidth="6" />
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
                strokeDasharray={c} strokeDashoffset={offset}
                strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
                style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s' }} />
            <text x={size/2} y={size/2 - 6} textAnchor="middle" fill="currentColor" fontSize="18" fontWeight="700">
                {usedPct.toFixed(1)}%
            </text>
            <text x={size/2} y={size/2 + 12} textAnchor="middle" fill="var(--afp-muted, #888)" fontSize="10">
                context
            </text>
        </svg>
    );
}

/** Bar chart for per-call token usage */
function TokenBarChart({ calls, maxBars = 20 }) {
    if (!calls || calls.length === 0) return null;
    const visible = calls.slice(-maxBars);
    const maxTokens = Math.max(...visible.map(c => c.inputTokens + c.outputTokens), 1);
    const barW = 100 / visible.length;

    return (
        <svg width="100%" height="80" viewBox="0 0 100 80" preserveAspectRatio="none">
            {visible.map((c, i) => {
                const inH = (c.inputTokens / maxTokens) * 60;
                const outH = (c.outputTokens / maxTokens) * 60;
                const x = i * barW;
                return (
                    <g key={c.id || i}>
                        <rect x={x + barW * 0.1} y={60 - inH} width={barW * 0.35} height={inH}
                              fill="#6366f1" rx="1" opacity="0.85" />
                        <rect x={x + barW * 0.5} y={60 - outH} width={barW * 0.35} height={outH}
                              fill="#22d3ee" rx="1" opacity="0.85" />
                    </g>
                );
            })}
            <line x1="0" y1="60" x2="100" y2="60" stroke="var(--afp-border, #2a2a3a)" strokeWidth="0.5" />
        </svg>
    );
}

/** Cost timeline — cumulative cost over calls */
function CostTimeline({ calls }) {
    if (!calls || calls.length === 0) return null;
    let cumCost = 0;
    const points = calls.map(c => {
        cumCost += c.costUsd;
        return cumCost;
    });
    const maxCost = Math.max(...points, 0.001);
    const step = 100 / (points.length - 1 || 1);

    const pathD = points.map((v, i) => {
        const x = i * step;
        const y = 60 - (v / maxCost) * 55;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');

    const areaD = pathD + ` L100,60 L0,60 Z`;

    return (
        <svg width="100%" height="80" viewBox="0 0 100 80" preserveAspectRatio="none">
            <defs>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <path d={areaD} fill="url(#costGrad)" />
            <path d={pathD} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round" />
            <line x1="0" y1="60" x2="100" y2="60" stroke="var(--afp-border, #2a2a3a)" strokeWidth="0.5" />
        </svg>
    );
}

/** Horizontal bar for budget consumption */
function BudgetBar({ spent, budget }) {
    if (!budget || budget <= 0) return null;
    const pct = Math.min((spent / budget) * 100, 100);
    const color = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#22c55e';
    return (
        <div className="afp-usage-budget-bar-wrap">
            <div className="afp-usage-budget-bar">
                <div className="afp-usage-budget-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="afp-usage-budget-label">{formatCost(spent)} / {formatCost(budget)}</span>
        </div>
    );
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
    return (
        <div className="afp-usage-stat-card" style={color ? { borderColor: color } : {}}>
            <div className="afp-usage-stat-value" style={color ? { color } : {}}>{value}</div>
            <div className="afp-usage-stat-label">{label}</div>
            {sub && <div className="afp-usage-stat-sub">{sub}</div>}
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────
function UsagePanelFP({ cfg, onBack, t }) {
    const [tab, setTab] = useState('session');
    const [budgetInput, setBudgetInput] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);
    const [geminiModelInfo, setGeminiModelInfo] = useState(null);
    const intervalRef = useRef(null);

    // Auto-refresh every 3s while open
    useEffect(() => {
        intervalRef.current = setInterval(() => setRefreshKey(k => k + 1), 3000);
        return () => clearInterval(intervalRef.current);
    }, []);

    // Fetch Gemini model info (inputTokenLimit) when panel opens
    useEffect(() => {
        if (provider === 'gemini' && cfg.geminiApiKey) {
            fetchGeminiModelInfo(cfg).then(info => {
                if (info) {
                    setGeminiModelInfo(info);
                    if (info.inputTokenLimit > 0) {
                        setGeminiContextLength(model, info.inputTokenLimit);
                        setRefreshKey(k => k + 1);
                    }
                }
            });
        }
    }, [provider, model]); // eslint-disable-line react-hooks/exhaustive-deps

    const session = getSessionStats();
    const allTime  = getAllTimeStats();
    const budget  = getBudget();
    const provider = cfg.llmProvider || 'ollama';
    const model    = provider === 'anthropic' ? cfg.model : provider === 'gemini' ? cfg.geminiModel : cfg.ollamaModel;
    const pricing  = getPricing(provider, model);

    const handleSetBudget = useCallback(() => {
        const val = parseFloat(budgetInput);
        if (!isNaN(val) && val >= 0) {
            setBudget(val);
            setBudgetInput('');
            setRefreshKey(k => k + 1);
        }
    }, [budgetInput]);

    const handleResetAllTime = useCallback(() => {
        if (confirm(t.usageConfirmReset || 'Reset all-time statistics?')) {
            resetAllTime();
            setRefreshKey(k => k + 1);
        }
    }, [t]);

    const isSession = tab === 'session';

    // Determine which model's data to show
    const stats = isSession ? session : allTime;
    const calls = isSession ? session.calls : [];
    const totalInput  = isSession ? session.totalInputTokens  : allTime.totalInputTokens;
    const totalOutput = isSession ? session.totalOutputTokens : allTime.totalOutputTokens;
    const totalCost   = isSession ? session.totalCostUsd      : allTime.totalCostUsd;
    const totalCalls   = isSession ? session.totalCalls        : allTime.totalCalls;

    return (
        <div className="afp-config-overlay">
            {/* Header */}
            <div className="afp-config-header">
                <button className="afp-config-back" onClick={onBack}>←</button>
                <h2>{t.usageTitle || 'LLM Usage'}</h2>
                <span className="afp-usage-provider-badge">{provider} · {model}{session.serviceTier ? ` · ${session.serviceTier}` : ''}</span>
            </div>

            {/* Tabs */}
            <div className="afp-config-tabs">
                <button className={`afp-config-tab${isSession ? ' active' : ''}`} onClick={() => setTab('session')}>
                    {t.usageTabSession || 'Session'}
                </button>
                <button className={`afp-config-tab${!isSession ? ' active' : ''}`} onClick={() => setTab('alltime')}>
                    {t.usageTabAllTime || 'All Time'}
                </button>
            </div>

            <div className="afp-config-body afp-usage-body">
                {/* ── Stat cards row ── */}
                <div className="afp-usage-stats-row">
                    <StatCard label={t.usageTotalCalls || 'Calls'} value={totalCalls} />
                    <StatCard label={t.usageInputTokens || 'Input'} value={formatTokens(totalInput)} color="#6366f1" />
                    <StatCard label={t.usageOutputTokens || 'Output'} value={formatTokens(totalOutput)} color="#22d3ee" />
                    <StatCard label={t.usageCost || 'Cost'} value={formatCost(totalCost)} color="#f59e0b" />
                </div>

                {/* ── Context window donut (session only) ── */}
                {isSession && session.contextLength > 0 && (
                    <div className="afp-usage-section">
                        <h3>{t.usageContextWindow || 'Context Window'}</h3>
                        <div className="afp-usage-context-row">
                            <ContextDonut usedPct={session.currentContextUsedPct} />
                            <div className="afp-usage-context-info">
                                <div>{t.usageUsed || 'Used'}: <strong>{formatTokens(session.lastInputTokens)}</strong></div>
                                <div>{t.usageRemaining || 'Remaining'}: <strong>{formatTokens(session.currentContextRemaining)}</strong></div>
                                <div>{t.usageTotal || 'Total'}: <strong>{formatTokens(session.contextLength)}</strong></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Budget bar ── */}
                {budget > 0 && (
                    <div className="afp-usage-section">
                        <h3>{t.usageBudget || 'Budget'}</h3>
                        <BudgetBar spent={totalCost} budget={budget} />
                    </div>
                )}

                {/* ── Token bar chart (session only) ── */}
                {isSession && calls.length > 0 && (
                    <div className="afp-usage-section">
                        <h3>{t.usageTokenChart || 'Tokens per Call'}</h3>
                        <div className="afp-usage-chart-wrap">
                            <TokenBarChart calls={calls} />
                            <div className="afp-usage-chart-legend">
                                <span className="afp-usage-legend-item"><span className="afp-usage-dot" style={{background:'#6366f1'}}></span>{t.usageInputTokens || 'Input'}</span>
                                <span className="afp-usage-legend-item"><span className="afp-usage-dot" style={{background:'#22d3ee'}}></span>{t.usageOutputTokens || 'Output'}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Cost timeline (session only) ── */}
                {isSession && calls.length > 1 && totalCost > 0 && (
                    <div className="afp-usage-section">
                        <h3>{t.usageCostTimeline || 'Cumulative Cost'}</h3>
                        <div className="afp-usage-chart-wrap">
                            <CostTimeline calls={calls} />
                        </div>
                    </div>
                )}

                {/* ── Call history table (session only) ── */}
                {isSession && calls.length > 0 && (
                    <div className="afp-usage-section">
                        <h3>{t.usageCallHistory || 'Call History'}</h3>
                        <div className="afp-usage-table-wrap">
                            <table className="afp-usage-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>{t.usageInputTokens || 'In'}</th>
                                        <th>{t.usageOutputTokens || 'Out'}</th>
                                        <th>{t.usageCost || 'Cost'}</th>
                                        <th>{t.usageCtxPct || 'Ctx%'}</th>
                                        {calls[0]?.toolCalls?.length > 0 && <th>{t.usageTools || 'Tools'}</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {calls.map((c, i) => (
                                        <tr key={c.id || i}>
                                            <td>{i + 1}</td>
                                            <td>{formatTokens(c.inputTokens)}</td>
                                            <td>{formatTokens(c.outputTokens)}</td>
                                            <td>{formatCost(c.costUsd)}</td>
                                            <td>{c.contextUsedPct?.toFixed(1)}%</td>
                                            {c.toolCalls?.length > 0 && <td>{c.toolCalls.join(', ')}</td>}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── All-time by model breakdown ── */}
                {!isSession && allTime.byModel && Object.keys(allTime.byModel).length > 0 && (
                    <div className="afp-usage-section">
                        <h3>{t.usageByModel || 'By Model'}</h3>
                        <div className="afp-usage-table-wrap">
                            <table className="afp-usage-table">
                                <thead>
                                    <tr>
                                        <th>{t.usageModel || 'Model'}</th>
                                        <th>{t.usageTotalCalls || 'Calls'}</th>
                                        <th>{t.usageInputTokens || 'Input'}</th>
                                        <th>{t.usageOutputTokens || 'Output'}</th>
                                        <th>{t.usageCost || 'Cost'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(allTime.byModel).map(([key, m]) => (
                                        <tr key={key}>
                                            <td>{key}</td>
                                            <td>{m.calls}</td>
                                            <td>{formatTokens(m.inputTokens)}</td>
                                            <td>{formatTokens(m.outputTokens)}</td>
                                            <td>{formatCost(m.costUsd)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── Service Tier info ── */}
                <div className="afp-usage-section">
                    <h3>{t.usageServiceTier || 'Service Tier'}</h3>
                    <div className="afp-usage-tier-info">
                        {session.serviceTier ? (
                            <>
                                <div className={`afp-usage-tier-badge ${session.serviceTier === 'standard' ? 'afp-usage-tier-standard' : 'afp-usage-tier-paid'}`}>
                                    {session.serviceTier === 'standard' ? (t.usageTierFree || 'Free Tier') : (t.usageTierPaid || 'Pay-as-you-go')}
                                </div>
                                {session.serviceTier === 'standard' && (
                                    <div className="afp-usage-tier-details">
                                        <div>{t.usageTierFreeDesc || 'Rate-limited: 15 RPM, 1M TPM, 1500 RPD'}</div>
                                        <div>{t.usageTierFreeCost || 'Cost: $0 — no charges'}</div>
                                    </div>
                                )}
                                {session.serviceTier !== 'standard' && (
                                    <div className="afp-usage-tier-details">
                                        <div>{t.usageTierPaidDesc || 'Pay per token, higher rate limits'}</div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="afp-usage-tier-details">
                                {provider === 'gemini' && (
                                    <div>{t.usageTierPending || 'Tier will be detected after first message'}</div>
                                )}
                                {provider === 'anthropic' && (
                                    <div>{t.usageTierAnthropic || 'API Key based — charges apply per token'}</div>
                                )}
                                {provider === 'ollama' && (
                                    <div className="afp-usage-tier-badge afp-usage-tier-standard">{t.usageTierOllama || 'Self-hosted — Free'}</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Pricing info ── */}
                <div className="afp-usage-section">
                    <h3>{t.usagePricing || 'Pricing'}</h3>
                    <div className="afp-usage-pricing-info">
                        <div>{t.usageModel || 'Model'}: <strong>{model}</strong></div>
                        <div>{t.usageInputPrice || 'Input'}: <strong>${pricing.input}/MTok</strong></div>
                        <div>{t.usageOutputPrice || 'Output'}: <strong>${pricing.output}/MTok</strong></div>
                        <div>{t.usageContext || 'Context'}: <strong>{formatTokens(geminiModelInfo?.inputTokenLimit || pricing.context)}</strong></div>
                        {geminiModelInfo?.outputTokenLimit && <div>{t.usageOutputLimit || 'Max Output'}: <strong>{formatTokens(geminiModelInfo.outputTokenLimit)}</strong></div>}
                    </div>
                </div>

                {/* ── Budget setting ── */}
                <div className="afp-usage-section">
                    <h3>{t.usageBudgetSetting || 'Set Budget'}</h3>
                    <div className="afp-usage-budget-input-row">
                        <span>$</span>
                        <input type="number" min="0" step="0.01" value={budgetInput}
                               onChange={(e) => setBudgetInput(e.target.value)}
                               placeholder={budget > 0 ? String(budget) : '0.00'}
                               onKeyDown={(e) => e.key === 'Enter' && handleSetBudget()} />
                        <button onClick={handleSetBudget}>{t.usageSetBudget || 'Set'}</button>
                        {budget > 0 && (
                            <button className="afp-usage-btn-danger" onClick={() => { setBudget(0); setRefreshKey(k => k + 1); }}>
                                {t.usageClearBudget || 'Clear'}
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Reset ── */}
                {!isSession && (
                    <div className="afp-usage-section">
                        <button className="afp-usage-btn-danger" onClick={handleResetAllTime}>
                            {t.usageResetAllTime || 'Reset All-Time Stats'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default UsagePanelFP;