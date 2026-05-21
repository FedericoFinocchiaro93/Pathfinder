/**
 * lib/objectManager.js — ai-chatbot-fullpage
 * Gestione generica di Object nel portale
 */

import { liferayGet, liferayPost, liferayPatch, liferayDelete } from './liferay.js';
import { dbg } from './utils.js';

const DEFAULT_SCOPE = 'company';

/**
 * Cerca se un Object esiste già per name
 */
export async function findObjectDefinition(base, objectName, user, pass) {
  try {
    const filter = encodeURIComponent(`name eq '${objectName}'`);
    const data = await liferayGet(
      base,
      `/o/object-admin/v1.0/object-definitions?filter=${filter}&pageSize=1`,
      user, pass
    );
    const found = (data.items || [])[0];
    return found ? { id: found.id, active: found.active } : null;
  } catch (e) {
    dbg(`[ObjectManager] findObjectDefinition(${objectName}):`, e.message);
    return null;
  }
}

/**
 * Crea e pubblica un Object
 * @param {string} base - URL base Liferay
 * @param {string} name - Nome Object (es: 'ChatSession', 'ArticleReview')
 * @param {object} labels - { en_US: 'Label', it_IT: 'Etichetta' }
 * @param {array} fields - Array di field definitions
 * @param {string} scope - 'company' o 'site' (default: 'company')
 * @param {string} user - Username
 * @param {string} pass - Password
 */
export async function createObjectDefinition(
  base, name, labels, fields, scope = DEFAULT_SCOPE, user, pass,
  objectFolderExternalReferenceCode = null, titleObjectFieldName = null
) {
  dbg(`[ObjectManager] Creazione Object ${name}…`);

  const pluralLabel = {
    en_US: (labels.en_US || '') + 's',
    it_IT: (labels.it_IT || '') + 's',
  };

  const definition = {
    name,
    label: labels,
    pluralLabel,
    scope,
    status: { code: 0 },
    objectFields: fields,
  };

  // Se scope è depot, aggiungi le impostazioni per gli Space e il campo title
  if (scope === 'depot') {
    definition.objectFolderExternalReferenceCode = objectFolderExternalReferenceCode || 'L_CMS_CONTENT_STRUCTURES';
    definition.objectDefinitionSettings = [{ name: 'acceptAllGroups', value: 'true' }];
    definition.enableComments = true;
    definition.enableFriendlyURLCustomization = true;
    definition.enableIndexSearch = true;
    definition.enableLocalization = true;
    definition.enableObjectEntryDraft = true;
    definition.enableObjectEntryHistory = true;
    definition.enableObjectEntrySchedule = true;
    definition.enableObjectEntryVersioning = true;

    // Per depot scope, il titleObjectFieldName DEVE essere "title".
    // Liferay crea automaticamente un campo title di sistema se lo specifichiamo.
    // Verifichiamo che non esista già un campo "title" nei fields forniti dall'utente.
    const hasTitleField = fields.some((f) => f.name === 'title');
    if (!hasTitleField) {
      // Aggiungiamo il campo title come primo campo (sarà il campo titolo dell'Object)
      fields.unshift({
        name: 'title',
        label: { en_US: 'Title', it_IT: 'Titolo' },
        type: 'String',
        DBType: 'String',
        businessType: 'Text',
        required: true,
        indexed: true,
        localized: true,
        indexedLanguageId: 'it_IT',
      });
    }
    definition.titleObjectFieldName = 'title';
  } else if (objectFolderExternalReferenceCode) {
    definition.objectFolderExternalReferenceCode = objectFolderExternalReferenceCode;
  }

  // Per company/site scope, imposta titleObjectFieldName se specificato o auto-detect
  if (scope !== 'depot') {
    if (titleObjectFieldName) {
      definition.titleObjectFieldName = titleObjectFieldName;
    } else {
      const titleField = fields.find((f) => f.type === 'String' && f.indexed);
      if (titleField) {
        definition.titleObjectFieldName = titleField.name;
      }
    }
  }

  // 1. Crea l'Object — con status code 0 (approved) Liferay lo pubblica automaticamente.
  // Non è necessaria una chiamata /publish separata: ritornerebbe sempre 400 perché
  // l'Object è già attivo.
  const created = await liferayPost(
    base,
    '/o/object-admin/v1.0/object-definitions',
    definition,
    user, pass
  );
  const defId = created.id;
  dbg(`[ObjectManager] Object ${name} creato e pubblicato, id: ${defId}`);
  return defId;
}

/**
 * Attende che l'endpoint REST del nuovo Object sia disponibile
 */
export async function waitForObjectEndpoint(
  base, restPath, maxAttempts = 5, user, pass
) {
  let attempts = 0;
  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 1000));
    attempts++;
    try {
      await liferayGet(base, `${restPath}?pageSize=1`, user, pass);
      dbg(`[ObjectManager] Endpoint ${restPath} pronto dopo ${attempts} tentativo/i.`);
      return true;
    } catch (_) {
      dbg(`[ObjectManager] Endpoint ${restPath} non pronto, tentativo ${attempts}`);
    }
  }
  dbg(`[ObjectManager] Timeout Endpoint ${restPath}.`);
  return false;
}

/**
 * Crea un Object se non esiste, altrimenti lo usa
 */
export async function ensureObjectExists(
  base, name, labels, fields, restPath, scope = DEFAULT_SCOPE, user, pass,
  objectFolderExternalReferenceCode = null, titleObjectFieldName = null
) {
  const found = await findObjectDefinition(base, name, user, pass);

  if (!found) {
    try {
      await createObjectDefinition(base, name, labels, fields, scope, user, pass, objectFolderExternalReferenceCode, titleObjectFieldName);
    } catch (eCreate) {
      if (!eCreate.message.includes('409')) throw eCreate;
      dbg(`[ObjectManager] Object ${name} già presente (409 Conflict).`);
    }

    await waitForObjectEndpoint(base, restPath, 5, user, pass);
  } else {
    dbg(`[ObjectManager] Object ${name} già esistente.`);
  }

  return true;
}

/**
 * Aggiorna un campo di un Object esistente (PATCH).
 * Supporta: label, businessType/DBType, indexed, indexedLanguageId.
 * NOTA: "required" e "name" (rename) NON sono supportati su campi di Object già pubblicati.
 * @param {string} base - URL base Liferay
 * @param {number} fieldId - ID del campo da aggiornare
 * @param {object} updates - Campi da aggiornare { label, businessType, DBType, indexed, indexedLanguageId }
 * @param {string} user - Username
 * @param {string} pass - Password
 */
export async function updateObjectField(base, fieldId, updates, user, pass) {
  dbg(`[ObjectManager] updateObjectField fieldId=${fieldId}`, updates);

  const body = {};

  // Label (i18n)
  if (updates.label) {
    body.label = typeof updates.label === 'string'
      ? { en_US: updates.label, it_IT: updates.label }
      : updates.label;
  }

  // Tipo campo (businessType + DBType vanno insieme)
  if (updates.businessType) {
    body.businessType = updates.businessType;
    // Se non viene fornito il DBType, inferiamo quello standard
    const typeMap = {
      'Text': 'String', 'LongText': 'Clob', 'Integer': 'Integer',
      'Decimal': 'Double', 'Boolean': 'Boolean', 'Date': 'Date',
    };
    body.DBType = updates.DBType || typeMap[updates.businessType] || 'String';
  } else if (updates.DBType) {
    body.DBType = updates.DBType;
  }

  // Indexed
  if (updates.indexed !== undefined) {
    body.indexed = Boolean(updates.indexed);
  }

  // indexedLanguageId (solo per Text/LongText)
  if (updates.indexedLanguageId) {
    body.indexedLanguageId = updates.indexedLanguageId;
  }

  if (Object.keys(body).length === 0) {
    return { error: 'Nessun campo valido da aggiornare. Campi supportati: label, businessType, DBType, indexed, indexedLanguageId. NOTA: required e name (rename) non sono supportati su Object già pubblicati.' };
  }

  try {
    const result = await liferayPatch(
      base,
      `/o/object-admin/v1.0/object-fields/${fieldId}`,
      body,
      user, pass
    );
    dbg(`[ObjectManager] updateObjectField OK: name=${result.name} businessType=${result.businessType}`);
    return {
      success: true,
      id: result.id,
      name: result.name,
      businessType: result.businessType,
      DBType: result.DBType,
      label: result.label,
      indexed: result.indexed,
      required: result.required,
      message: `Campo "${result.name}" aggiornato con successo`,
    };
  } catch (e) {
    dbg(`[ObjectManager] updateObjectField ERRORE:`, e.message);
    return { error: e.message || String(e), fieldId };
  }
}

/**
 * Aggiunge un nuovo campo a un Object esistente.
 * @param {string} base - URL base Liferay
 * @param {number} definitionId - ID della Object Definition
 * @param {object} fieldDef - Definizione del campo (come restituito da buildField)
 * @param {string} user - Username
 * @param {string} pass - Password
 */
export async function addObjectField(base, definitionId, fieldDef, user, pass) {
  dbg(`[ObjectManager] addObjectField definitionId=${definitionId} fieldName=${fieldDef.name}`);

  try {
    const result = await liferayPost(
      base,
      `/o/object-admin/v1.0/object-definitions/${definitionId}/object-fields`,
      fieldDef,
      user, pass
    );
    dbg(`[ObjectManager] addObjectField OK: id=${result.id} name=${result.name}`);
    return {
      success: true,
      id: result.id,
      name: result.name,
      businessType: result.businessType,
      DBType: result.DBType,
      label: result.label,
      indexed: result.indexed,
      required: result.required,
      message: `Campo "${result.name}" aggiunto con successo all'Object`,
    };
  } catch (e) {
    dbg(`[ObjectManager] addObjectField ERRORE:`, e.message);
    return { error: e.message || String(e), definitionId, fieldName: fieldDef.name };
  }
}

/**
 * Elimina un campo da un Object esistente.
 * @param {string} base - URL base Liferay
 * @param {number} fieldId - ID del campo da eliminare
 * @param {string} user - Username
 * @param {string} pass - Password
 */
export async function deleteObjectField(base, fieldId, user, pass) {
  dbg(`[ObjectManager] deleteObjectField fieldId=${fieldId}`);

  try {
    await liferayDelete(
      base,
      `/o/object-admin/v1.0/object-fields/${fieldId}`,
      user, pass
    );
    dbg(`[ObjectManager] deleteObjectField OK: fieldId=${fieldId}`);
    return {
      success: true,
      message: `Campo con ID ${fieldId} eliminato con successo`,
      fieldId,
    };
  } catch (e) {
    dbg(`[ObjectManager] deleteObjectField ERRORE:`, e.message);
    return { error: e.message || String(e), fieldId };
  }
}

/**
 * Cerca un Object Definition per nome e restituisce i suoi campi.
 * Usato dai tool update_object_field / add_object_field / delete_object_field
 * per risolvere object_name → definitionId + fieldId.
 * @param {string} base - URL base Liferay
 * @param {string} objectName - Nome dell'Object (es. "Segnalazione")
 * @param {string} user - Username
 * @param {string} pass - Password
 * @returns {object|null} - { id, name, scope, objectFields: [...] } oppure null
 */
export async function findObjectDefinitionWithFields(base, objectName, user, pass) {
  try {
    // Prova prima il nome esatto
    const filterExact = encodeURIComponent(`name eq '${objectName.replace(/'/g, "''")}'`);
    let listData = await liferayGet(
      base,
      `/o/object-admin/v1.0/object-definitions?filter=${filterExact}&pageSize=1`,
      user, pass
    );
    let found = (listData.items || [])[0];

    // Se non trovato, prova case-insensitive con contains
    if (!found) {
      const filterContains = encodeURIComponent(`name contains '${objectName.replace(/'/g, "''")}'`);
      listData = await liferayGet(
        base,
        `/o/object-admin/v1.0/object-definitions?filter=${filterContains}&pageSize=5`,
        user, pass
      );
      found = (listData.items || []).find((o) => o.name.toLowerCase() === objectName.toLowerCase())
        || (listData.items || [])[0];
    }

    if (!found) return null;

    // Recupera la definizione completa con i campi
    const objDef = await liferayGet(
      base,
      `/o/object-admin/v1.0/object-definitions/${found.id}?nestedFields=objectFields`,
      user, pass
    );

    return {
      id: objDef.id,
      name: objDef.name,
      label: objDef.label,
      scope: objDef.scope,
      externalReferenceCode: objDef.externalReferenceCode,
      objectFields: (objDef.objectFields || []).filter((f) => !f.system),
    };
  } catch (e) {
    dbg(`[ObjectManager] findObjectDefinitionWithFields(${objectName}):`, e.message);
    return null;
  }
}
