/**
 * lib/skillsManager.js — ai-chatbot-fullpage
 *
 * Manages Skills persistence via a Liferay Custom Object (ACFPSkill).
 * Falls back to localStorage when Liferay is unavailable.
 *
 * Object definition:
 *   ACFPSkill (REST path: /o/c/acfpskills/)
 *   Fields:
 *     skillId      — String (required, indexed): unique skill identifier
 *     name         — String (required, indexed): skill display name
 *     icon         — String: emoji icon
 *     description  — String: short description
 *     content      — LongText: full markdown content
 *     active       — Boolean: whether the skill is active
 *     createdAt    — String: ISO timestamp
 */

import { dbg } from './utils.js';
import { getBaseUrl, getLiferayToken } from './liferay.js';

const OBJECT_NAME = 'acfpskills'; // REST context path (Liferay adds trailing 's')
const LOCAL_STORAGE_KEY = 'acfp_skills_v1';

// ── Local storage helpers (fallback) ────────────────────────────────────────

function _loadLocal() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

function _saveLocal(skills) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(skills));
    } catch (e) {
        dbg('[SkillsManager] localStorage save error:', e);
    }
}

// ── Liferay Custom Object helpers ────────────────────────────────────────────

function _headers() {
    const headers = { 'Content-Type': 'application/json' };
    const token = getLiferayToken();
    if (token) headers['x-csrf-token'] = token;
    return headers;
}

function _baseUrl() {
    return getBaseUrl();
}

/**
 * Check if the ACFPSkill Custom Object exists in Liferay.
 * @returns {Promise<boolean>}
 */
async function _objectExists() {
    const base = _baseUrl();
    if (!base) return false;
    try {
        const res = await fetch(`${base}/o/c/${OBJECT_NAME}/?pageSize=1`, {
            headers: _headers(),
            credentials: 'same-origin',
        });
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * Create the ACFPSkill Custom Object in Liferay.
 * @returns {Promise<boolean>}
 */
export async function ensureSkillsObject() {
    const base = _baseUrl();
    const token = getLiferayToken();
    if (!base) return false;

    // 1. Check if the object already exists
    const exists = await _objectExists();
    if (exists) {
        dbg('[SkillsManager] ACFPSkill object already exists');
        return true;
    }

    // 2. Create the Object Definition via object-admin API
    try {
        const adminHeaders = { 'Content-Type': 'application/json' };
        if (token) adminHeaders['x-csrf-token'] = token;

        const createBody = JSON.stringify({
            externalReferenceCode: 'ACFPSkill',
            name: 'ACFPSkill',
            label: { en_US: 'ACFP Skill', it_IT: 'ACFP Skill' },
            pluralLabel: { en_US: 'ACFP Skills', it_IT: 'ACFP Skills' },
            panelCategoryKey: 'control_panel.object',
            system: false,
            active: true,
            scope: 'company',
            objectFields: [
                { name: 'skillId', businessType: 'Text', DBType: 'String', label: { en_US: 'Skill ID', it_IT: 'ID Skill' }, required: true, indexed: true, indexedAsKeyword: true },
                { name: 'name', businessType: 'Text', DBType: 'String', label: { en_US: 'Name', it_IT: 'Nome' }, required: true, indexed: true, indexedAsKeyword: false },
                { name: 'icon', businessType: 'Text', DBType: 'String', label: { en_US: 'Icon', it_IT: 'Icona' }, required: false, indexed: false },
                { name: 'description', businessType: 'LongText', DBType: 'String', label: { en_US: 'Description', it_IT: 'Descrizione' }, required: false, indexed: false },
                { name: 'content', businessType: 'LongText', DBType: 'Clob', label: { en_US: 'Content', it_IT: 'Contenuto' }, required: false, indexed: false },
                { name: 'active', businessType: 'Boolean', DBType: 'Boolean', label: { en_US: 'Active', it_IT: 'Attiva' }, required: false, indexed: true },
                { name: 'createdAt', businessType: 'Text', DBType: 'String', label: { en_US: 'Created At', it_IT: 'Data Creazione' }, required: false, indexed: true, indexedAsKeyword: false },
            ],
        });

        const createRes = await fetch(`${base}/o/object-admin/v1.0/object-definitions`, {
            method: 'POST',
            headers: adminHeaders,
            credentials: 'same-origin',
            body: createBody,
        });

        if (!createRes.ok) {
            const errText = await createRes.text();
            // 409 means it already exists — that's fine
            if (createRes.status === 409) {
                dbg('[SkillsManager] ACFPSkill object already exists (409 Conflict)');
                return true;
            }
            dbg('[SkillsManager] Failed to create ACFPSkill object', createRes.status, errText);
            return false;
        }

        const created = await createRes.json();
        const objId = created.id;
        dbg('[SkillsManager] Created ACFPSkill object, id=', objId);

        // 3. Publish the object definition
        const publishRes = await fetch(`${base}/o/object-admin/v1.0/object-definitions/${objId}/publish`, {
            method: 'POST',
            headers: adminHeaders,
            credentials: 'same-origin',
        });

        if (!publishRes.ok) {
            const errText = await publishRes.text();
            dbg('[SkillsManager] Failed to publish ACFPSkill object', publishRes.status, errText);
            return false;
        }

        dbg('[SkillsManager] ACFPSkill object published successfully');

        // Wait for the REST endpoint to become available
        await new Promise(resolve => setTimeout(resolve, 3000));
        return true;
    } catch (e) {
        dbg('[SkillsManager] Error creating ACFPSkill object:', e.message);
        return false;
    }
}

// ── CRUD operations ──────────────────────────────────────────────────────────

/**
 * Load all skills from Liferay Custom Object.
 * Falls back to localStorage if Liferay is unavailable.
 * @returns {Promise<Array>}
 */
export async function loadSkillsFromLiferay() {
    const base = _baseUrl();
    if (!base) return _loadLocal();

    try {
        const res = await fetch(`${base}/o/c/${OBJECT_NAME}/?pageSize=200`, {
            headers: _headers(),
            credentials: 'same-origin',
        });

        if (!res.ok) {
            dbg('[SkillsManager] Failed to load skills from Liferay, falling back to localStorage');
            return _loadLocal();
        }

        const data = await res.json();
        const items = data.items || [];

        // Map Liferay entries to local skill format
        const skills = items.map(entry => ({
            id: entry.skillId || String(entry.id),
            name: entry.name || '',
            icon: entry.icon || '🧠',
            description: entry.description || '',
            content: entry.content || '',
            active: entry.active !== false && entry.active !== 'false',
            createdAt: entry.createdAt || entry.dateCreated || new Date().toISOString(),
            _liferayId: entry.id, // Liferay internal ID for updates
        }));

        dbg('[SkillsManager] Loaded', skills.length, 'skills from Liferay');

        // Sync to localStorage as cache
        _saveLocal(skills);
        return skills;
    } catch (e) {
        dbg('[SkillsManager] Error loading skills from Liferay, falling back to localStorage:', e.message);
        return _loadLocal();
    }
}

/**
 * Save a skill to Liferay Custom Object.
 * Creates a new entry or updates an existing one.
 * @param {object} skill - The skill object
 * @returns {Promise<object>} The saved skill (with _liferayId if created/updated in Liferay)
 */
export async function saveSkillToLiferay(skill) {
    const base = _baseUrl();
    if (!base) return skill;

    try {
        const payload = {
            skillId: skill.id,
            name: skill.name,
            icon: skill.icon || '🧠',
            description: skill.description || '',
            content: skill.content || '',
            active: skill.active !== false,
            createdAt: skill.createdAt || new Date().toISOString(),
        };

        if (skill._liferayId) {
            // Update existing entry
            const res = await fetch(`${base}/o/c/${OBJECT_NAME}/${skill._liferayId}`, {
                method: 'PUT',
                headers: _headers(),
                credentials: 'same-origin',
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                dbg('[SkillsManager] Updated skill in Liferay:', skill.id);
                return skill;
            } else {
                const err = await res.text();
                dbg('[SkillsManager] Failed to update skill in Liferay:', res.status, err);
                return skill;
            }
        } else {
            // Create new entry
            const res = await fetch(`${base}/o/c/${OBJECT_NAME}/`, {
                method: 'POST',
                headers: _headers(),
                credentials: 'same-origin',
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                const created = await res.json();
                dbg('[SkillsManager] Created skill in Liferay:', skill.id, '→ Liferay id:', created.id);
                return { ...skill, _liferayId: created.id };
            } else {
                const err = await res.text();
                dbg('[SkillsManager] Failed to create skill in Liferay:', res.status, err);
                return skill;
            }
        }
    } catch (e) {
        dbg('[SkillsManager] Error saving skill to Liferay:', e.message);
        return skill;
    }
}

/**
 * Delete a skill from Liferay Custom Object.
 * @param {object} skill - The skill object (must have _liferayId or id)
 * @returns {Promise<boolean>}
 */
export async function deleteSkillFromLiferay(skill) {
    const base = _baseUrl();
    if (!base) return false;

    try {
        if (skill._liferayId) {
            // Delete by Liferay internal ID
            const res = await fetch(`${base}/o/c/${OBJECT_NAME}/${skill._liferayId}`, {
                method: 'DELETE',
                headers: _headers(),
                credentials: 'same-origin',
            });

            if (res.ok) {
                dbg('[SkillsManager] Deleted skill from Liferay:', skill.id);
                return true;
            } else {
                dbg('[SkillsManager] Failed to delete skill from Liferay:', res.status);
                return false;
            }
        } else {
            // Try to find by skillId filter
            const filter = encodeURIComponent(`skillId eq '${skill.id}'`);
            const listRes = await fetch(`${base}/o/c/${OBJECT_NAME}/?filter=${filter}&pageSize=1`, {
                headers: _headers(),
                credentials: 'same-origin',
            });

            if (listRes.ok) {
                const listData = await listRes.json();
                const items = listData.items || [];
                if (items.length > 0) {
                    const liferayId = items[0].id;
                    const delRes = await fetch(`${base}/o/c/${OBJECT_NAME}/${liferayId}`, {
                        method: 'DELETE',
                        headers: _headers(),
                        credentials: 'same-origin',
                    });
                    if (delRes.ok) {
                        dbg('[SkillsManager] Deleted skill from Liferay by filter:', skill.id);
                        return true;
                    }
                }
            }
            dbg('[SkillsManager] Skill not found in Liferay for deletion:', skill.id);
            return false;
        }
    } catch (e) {
        dbg('[SkillsManager] Error deleting skill from Liferay:', e.message);
        return false;
    }
}

/**
 * Sync all local skills to Liferay.
 * Creates the Custom Object if it doesn't exist, then pushes all local skills.
 * @returns {Promise<Array>} The synced skills with _liferayId populated
 */
export async function syncSkillsToLiferay() {
    // 1. Ensure the object exists
    const ready = await ensureSkillsObject();
    if (!ready) {
        dbg('[SkillsManager] Cannot sync: ACFPSkill object not available');
        return _loadLocal();
    }

    // 2. Load local skills
    const localSkills = _loadLocal();

    // 3. Push each skill to Liferay
    const synced = [];
    for (const skill of localSkills) {
        const saved = await saveSkillToLiferay(skill);
        synced.push(saved);
    }

    // 4. Update localStorage with Liferay IDs
    _saveLocal(synced);
    dbg('[SkillsManager] Synced', synced.length, 'skills to Liferay');
    return synced;
}

/**
 * Load skills — tries Liferay first, falls back to localStorage.
 * @returns {Promise<Array>}
 */
export async function loadSkills() {
    const base = _baseUrl();
    if (!base) return _loadLocal();

    const exists = await _objectExists();
    if (exists) {
        return loadSkillsFromLiferay();
    }

    // Object doesn't exist yet — return local skills
    return _loadLocal();
}

/**
 * Save all skills — saves to localStorage immediately and syncs to Liferay in background.
 * @param {Array} skills
 * @returns {Promise<Array>} The skills with _liferayId populated (if Liferay is available)
 */
export async function saveSkills(skills) {
    // Always save to localStorage immediately
    _saveLocal(skills);

    // Try to sync to Liferay in background
    const base = _baseUrl();
    if (!base) return skills;

    try {
        const exists = await _objectExists();
        if (!exists) return skills;

        // Get current Liferay entries to match by skillId
        const res = await fetch(`${base}/o/c/${OBJECT_NAME}/?pageSize=200`, {
            headers: _headers(),
            credentials: 'same-origin',
        });

        if (!res.ok) return skills;

        const data = await res.json();
        const existingEntries = data.items || [];
        const existingMap = new Map();
        for (const entry of existingEntries) {
            existingMap.set(entry.skillId, entry);
        }

        // Sync each skill
        const synced = [];
        for (const skill of skills) {
            const existing = existingMap.get(skill.id);
            const skillWithLiferayId = existing ? { ...skill, _liferayId: existing.id } : skill;
            const saved = await saveSkillToLiferay(skillWithLiferayId);
            synced.push(saved);
        }

        // Delete entries in Liferay that are no longer in local skills
        const localIds = new Set(skills.map(s => s.id));
        for (const entry of existingEntries) {
            if (!localIds.has(entry.skillId)) {
                await fetch(`${base}/o/c/${OBJECT_NAME}/${entry.id}`, {
                    method: 'DELETE',
                    headers: _headers(),
                    credentials: 'same-origin',
                });
                dbg('[SkillsManager] Deleted orphaned skill from Liferay:', entry.skillId);
            }
        }

        // Update localStorage with Liferay IDs
        _saveLocal(synced);
        return synced;
    } catch (e) {
        dbg('[SkillsManager] Error syncing skills to Liferay:', e.message);
        return skills;
    }
}

/**
 * Save a single skill — saves to localStorage immediately and syncs to Liferay.
 * @param {object} skill
 * @returns {Promise<object>} The skill with _liferayId populated
 */
export async function saveOneSkill(skill) {
    // Save to localStorage
    const local = _loadLocal();
    const idx = local.findIndex(s => s.id === skill.id);
    if (idx >= 0) {
        local[idx] = skill;
    } else {
        local.push(skill);
    }
    _saveLocal(local);

    // Sync to Liferay
    return saveSkillToLiferay(skill);
}

/**
 * Delete a single skill — removes from localStorage and Liferay.
 * @param {string} skillId
 * @returns {Promise<boolean>}
 */
export async function deleteOneSkill(skillId) {
    // Remove from localStorage
    const local = _loadLocal();
    const skill = local.find(s => s.id === skillId);
    const updated = local.filter(s => s.id !== skillId);
    _saveLocal(updated);

    // Delete from Liferay
    if (skill) {
        return deleteSkillFromLiferay(skill);
    }
    return false;
}