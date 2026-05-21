/**
 * lib/objectFieldBuilder.js — ai-chatbot-fullpage
 * Helper per costruire field definitions in modo semplice e parametrizzato
 */

export const FIELD_TYPES = {
  TEXT: { businessType: 'Text', DBType: 'String' },
  LONGTEXT: { businessType: 'LongText', DBType: 'Clob' },
  DATE: { businessType: 'Date', DBType: 'Date' },
  INTEGER: { businessType: 'Integer', DBType: 'Integer' },
  DECIMAL: { businessType: 'Decimal', DBType: 'Double' },
  BOOLEAN: { businessType: 'Boolean', DBType: 'Boolean' },
  RELATIONSHIP: { businessType: 'Relationship', DBType: 'Long' },
};

/**
 * Crea un field definition
 * @param {string} name - Nome campo (es: 'articleId', 'reviewDate')
 * @param {object} label - { en_US: '...', it_IT: '...' } oppure string
 * @param {string} type - Chiave da FIELD_TYPES (es: 'TEXT', 'DATE')
 * @param {object} options - { required, indexed, indexedAsKeyword }
 */
export function buildField(name, label, type, options = {}) {
  const {
    required = false,
    indexed = false,
    indexedAsKeyword = false,
    indexedLanguageId = 'en_US',
  } = options;

  // Normalizza il nome: solo lettere e cifre, niente spazi o caratteri speciali
  const normalizedName = name.replace(/[^a-zA-Z0-9]/g, '');
  if (normalizedName !== name) {
    dbg(`[objectFieldBuilder] Nome campo "${name}" normalizzato in "${normalizedName}" (rimossi caratteri non alfanumerici)`);
  }

  const typeInfo = FIELD_TYPES[type] || FIELD_TYPES.TEXT;

  // indexedLanguageId è valido solo per Text (String) e LongText (Clob)
  // che non sono indexedAsKeyword. Gli altri tipi lo rifiutano con 400.
  const isTextLike = typeInfo.businessType === 'Text' || typeInfo.businessType === 'LongText';
  const canUseIndexedLanguageId = isTextLike && !indexedAsKeyword;

  // Nota: Liferay ObjectField NON accetta "description" — viene ignorato o causa 400.
  // Non includiamo proprietà con valore null/undefined per evitare errori di validazione.
  const field = {
    name: normalizedName,
    label: typeof label === 'string' 
      ? { en_US: label, it_IT: label }
      : label,
    businessType: typeInfo.businessType,
    DBType: typeInfo.DBType,
    required: Boolean(required),
  };

  // Aggiungi proprietà opzionali solo se hanno valori validi
  if (indexed) field.indexed = true;
  if (indexedAsKeyword) field.indexedAsKeyword = true;
  if (canUseIndexedLanguageId && indexedLanguageId) field.indexedLanguageId = indexedLanguageId;

  return field;
}

/**
 * Normalizza tipo campo (accetta varianti)
 */
export function normalizeFieldType(input) {
  if (!input) return 'TEXT';
  const normalized = String(input).toUpperCase().trim();
  if (FIELD_TYPES[normalized]) return normalized;
  
  // Fallback per varianti comuni
  const map = {
    'INT': 'INTEGER',
    'NUM': 'DECIMAL',
    'FLOAT': 'DECIMAL',
    'BOOL': 'BOOLEAN',
    'LONG': 'LONGTEXT',
    'TEXTAREA': 'LONGTEXT',
    'RICH_TEXT': 'LONGTEXT',
    'RELATION': 'RELATIONSHIP',
  };
  
  return map[normalized] || 'TEXT';
}

/**
 * Helper per i18n
 */
export function buildI18nLabel(enLabel, itLabel) {
  return { en_US: enLabel, it_IT: itLabel };
}

/**
 * Valida un array di field definitions
 */
export function validateFields(fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error('fields deve essere un array non vuoto');
  }
  
  const names = new Set();
  for (const f of fields) {
    if (!f.name) throw new Error('Ogni field deve avere un name');
    if (names.has(f.name)) throw new Error(`Field duplicato: ${f.name}`);
    names.add(f.name);
    
    if (!f.businessType || !f.DBType) {
      throw new Error(`Field ${f.name} missing businessType/DBType`);
    }
  }
  
  return true;
}
