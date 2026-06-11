/**
 * lib/excelTemplate.js — Generate Excel templates on-demand
 * Uses the xlsx library (already loaded for parsing) to create template files.
 */

// ── XLSX loader (CDN-only — npm xlsx is unmaintained & vulnerable) ──
let _XLSX = null;
async function _loadXLSX() {
    if (_XLSX) return _XLSX;
    // Check if already loaded on window (by ChatbotFullpage or another component)
    if (window.XLSX) { _XLSX = window.XLSX; return _XLSX; }
    // Load from CDN — the npm package is unmaintained and vulnerable to Prototype Pollution
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
        script.onload = () => { _XLSX = window.XLSX; resolve(_XLSX); };
        script.onerror = () => reject(new Error('Failed to load xlsx library. Cannot generate Excel template.'));
        document.head.appendChild(script);
    });
}

// ── Template data definitions ──

const TEMPLATES = {
    it: {
        structures: {
            sheetName: 'Strutture',
            headers: ['NomeStruttura', 'Campo', 'Tipo', 'Obbligatorio', 'Opzioni'],
            rows: [
                ['News', 'Titolo', 'text', 'si', ''],
                ['News', 'Contenuto', 'textarea', 'no', ''],
                ['News', 'Data Pubblicazione', 'date', 'si', ''],
                ['News', 'Autore', 'text', 'no', ''],
                ['News', 'Immagine', 'document', 'no', ''],
                ['Prodotto', 'Nome', 'text', 'si', ''],
                ['Prodotto', 'Descrizione', 'textarea', 'no', ''],
                ['Prodotto', 'Prezzo', 'decimal', 'si', ''],
                ['Prodotto', 'Disponibile', 'boolean', 'no', ''],
                ['Prodotto', 'Categoria', 'select', 'si', 'Elettronica|Abbigliamento|Alimentari|Casa'],
                ['Prodotto', 'Immagine', 'document', 'no', ''],
            ],
            colWidths: [18, 22, 12, 14, 40],
        },
        objects: {
            sheetName: 'Oggetti',
            headers: ['NomeOggetto', 'Campo', 'Tipo', 'Obbligatorio', 'Scope'],
            rows: [
                ['Fattura', 'Numero', 'integer', 'si', 'site'],
                ['Fattura', 'Importo', 'decimal', 'si', ''],
                ['Fattura', 'Data Emissione', 'date', 'si', ''],
                ['Fattura', 'Cliente', 'text', 'si', ''],
                ['Fattura', 'Stato', 'select', 'si', ''],
                ['Contatto', 'Nome', 'text', 'si', 'company'],
                ['Contatto', 'Cognome', 'text', 'si', ''],
                ['Contatto', 'Email', 'text', 'no', ''],
                ['Contatto', 'Telefono', 'text', 'no', ''],
                ['Contatto', 'Azienda', 'text', 'no', ''],
            ],
            colWidths: [18, 22, 12, 14, 12],
        },
        vocabularies: {
            sheetName: 'Vocabolari',
            headers: ['Nome', 'Tipo', 'Descrizione', 'VocabolarioPadre', 'MultiValued'],
            rows: [
                ['Temi', 'Vocabolario', 'Categorizzazione per tema', '', 'no'],
                ['Economia', 'Categoria', '', 'Temi', ''],
                ['Politica', 'Categoria', '', 'Temi', ''],
                ['Tecnologia', 'Categoria', '', 'Temi', ''],
                ['Ambiente', 'Categoria', '', 'Temi', ''],
                ['Tipologie', 'Vocabolario', 'Tipologia di contenuto', '', 'si'],
                ['Notizia', 'Categoria', '', 'Tipologie', ''],
                ['Approfondimento', 'Categoria', '', 'Tipologie', ''],
                ['Report', 'Categoria', '', 'Tipologie', ''],
                ['Settori', 'Vocabolario', 'Settori aziendali', '', 'no'],
                ['ICT', 'Categoria', '', 'Settori', ''],
                ['Energy', 'Categoria', '', 'Settori', ''],
                ['PA e Salute', 'Categoria', '', 'Settori', ''],
            ],
            colWidths: [20, 14, 30, 20, 14],
        },
        pages: {
            sheetName: 'Pagine',
            headers: ['Pagina', 'Tipo', 'FriendlyURL', 'PaginaPadre', 'MasterPage'],
            rows: [
                ['Home', 'Pagina contenuto', '/home', '', 'almaviva'],
                ['Chi Siamo', 'Pagina contenuto', '', 'Home', 'almaviva'],
                ['Servizi', 'Pagina contenuto', '/servizi', '', 'almaviva'],
                ['Consulenza', 'Pagina contenuto', '', 'Servizi', 'almaviva'],
                ['Sviluppo', 'Pagina contenuto', '', 'Servizi', 'almaviva'],
                ['Contatti', 'Pagina widget', '/contatti', '', ''],
            ],
            colWidths: [20, 20, 18, 18, 14],
        },
        roles: {
            sheetName: 'Ruoli',
            headers: ['NomeRuolo', 'Tipo', 'Descrizione'],
            rows: [
                ['Editor Contenuti', 'Site', 'Può creare e modificare contenuti web'],
                ['Revisore Contenuti', 'Site', 'Può revisionare e approvare contenuti per la pubblicazione'],
                ['Gestore Pagine', 'Site', 'Può creare, modificare ed eliminare pagine del sito'],
                ['Gestore Documenti', 'Site', 'Può caricare e gestire documenti e media'],
            ],
            colWidths: [22, 12, 50],
        },
        users: {
            sheetName: 'Utenti',
            headers: ['Nome', 'Cognome', 'Email', 'ScreenName', 'Password', 'Ruolo'],
            rows: [
                ['Mario', 'Rossi', 'mario.rossi@example.com', 'mario.rossi', 'ChangeMe123!', 'Editor Contenuti, Gestore Pagine'],
                ['Laura', 'Bianchi', 'laura.bianchi@example.com', 'laura.bianchi', 'ChangeMe123!', 'Revisore Contenuti'],
                ['Giuseppe', 'Verdi', 'giuseppe.verdi@example.com', 'giuseppe.verdi', 'ChangeMe123!', 'Gestore Documenti, Editor Contenuti'],
            ],
            colWidths: [16, 16, 30, 18, 16, 40],
        },
    },
    en: {
        structures: {
            sheetName: 'Structures',
            headers: ['StructureName', 'Field', 'Type', 'Required', 'Options'],
            rows: [
                ['Article', 'Title', 'text', 'yes', ''],
                ['Article', 'Content', 'textarea', 'no', ''],
                ['Article', 'Summary', 'textarea', 'no', ''],
                ['Article', 'Publish Date', 'date', 'yes', ''],
                ['Article', 'Author', 'text', 'no', ''],
                ['Article', 'Featured Image', 'document', 'no', ''],
                ['Article', 'Category', 'select', 'yes', 'Politics|Economy|Technology|Sports|Culture'],
                ['Product', 'Name', 'text', 'yes', ''],
                ['Product', 'Description', 'textarea', 'no', ''],
                ['Product', 'Price', 'decimal', 'yes', ''],
                ['Product', 'Available', 'boolean', 'no', ''],
                ['Product', 'Category', 'select', 'yes', 'Electronics|Clothing|Food|Home|Sports'],
                ['Product', 'Image', 'document', 'no', ''],
                ['Event', 'Title', 'text', 'yes', ''],
                ['Event', 'Description', 'textarea', 'no', ''],
                ['Event', 'Start Date', 'date', 'yes', ''],
                ['Event', 'End Date', 'date', 'no', ''],
                ['Event', 'Location', 'text', 'no', ''],
                ['Event', 'Image', 'document', 'no', ''],
            ],
            colWidths: [18, 22, 12, 12, 50],
        },
        objects: {
            sheetName: 'Objects',
            headers: ['ObjectName', 'Field', 'Type', 'Required', 'Scope'],
            rows: [
                ['Invoice', 'Invoice Number', 'integer', 'yes', 'site'],
                ['Invoice', 'Amount', 'decimal', 'yes', ''],
                ['Invoice', 'Issue Date', 'date', 'yes', ''],
                ['Invoice', 'Customer Name', 'text', 'yes', ''],
                ['Invoice', 'Status', 'select', 'yes', ''],
                ['Contact', 'First Name', 'text', 'yes', 'company'],
                ['Contact', 'Last Name', 'text', 'yes', ''],
                ['Contact', 'Email', 'text', 'no', ''],
                ['Contact', 'Phone', 'text', 'no', ''],
                ['Contact', 'Company', 'text', 'no', ''],
            ],
            colWidths: [18, 22, 12, 12, 12],
        },
        vocabularies: {
            sheetName: 'Vocabularies',
            headers: ['Name', 'Type', 'Description', 'ParentVocabulary', 'MultiValued'],
            rows: [
                ['Topics', 'Vocabulary', 'Content topic classification', '', 'no'],
                ['Politics', 'Category', '', 'Topics', ''],
                ['Economy', 'Category', '', 'Topics', ''],
                ['Technology', 'Category', '', 'Topics', ''],
                ['Sports', 'Category', '', 'Topics', ''],
                ['Culture', 'Category', '', 'Topics', ''],
                ['Content Types', 'Vocabulary', 'Type of content', '', 'yes'],
                ['News', 'Category', '', 'Content Types', ''],
                ['Analysis', 'Category', '', 'Content Types', ''],
                ['Report', 'Category', '', 'Content Types', ''],
                ['Business Sectors', 'Vocabulary', 'Industry sectors', '', 'no'],
                ['ICT', 'Category', '', 'Business Sectors', ''],
                ['Energy', 'Category', '', 'Business Sectors', ''],
                ['Public Administration', 'Category', '', 'Business Sectors', ''],
            ],
            colWidths: [22, 14, 35, 22, 14],
        },
        pages: {
            sheetName: 'Pages',
            headers: ['Page', 'Type', 'FriendlyURL', 'ParentPage', 'MasterPage'],
            rows: [
                ['Home', 'Content Page', '/home', '', 'almaviva'],
                ['About Us', 'Content Page', '', 'Home', 'almaviva'],
                ['Services', 'Content Page', '/services', '', 'almaviva'],
                ['Consulting', 'Content Page', '', 'Services', 'almaviva'],
                ['Software Development', 'Content Page', '', 'Services', 'almaviva'],
                ['Contact', 'Widget Page', '/contact', '', ''],
            ],
            colWidths: [24, 16, 18, 22, 14],
        },
        roles: {
            sheetName: 'Roles',
            headers: ['RoleName', 'Type', 'Description'],
            rows: [
                ['Content Editor', 'Site', 'Can create and edit web content'],
                ['Content Reviewer', 'Site', 'Can review and approve content for publication'],
                ['Page Manager', 'Site', 'Can create, edit, and delete site pages'],
                ['Document Manager', 'Site', 'Can upload and manage documents and media'],
            ],
            colWidths: [22, 12, 50],
        },
        users: {
            sheetName: 'Users',
            headers: ['FirstName', 'LastName', 'Email', 'ScreenName', 'Password', 'RoleName'],
            rows: [
                ['Alice', 'Rossi', 'alice.rossi@example.com', 'alice.rossi', 'ChangeMe123!', 'Content Editor, Page Manager'],
                ['Bob', 'Bianchi', 'bob.bianchi@example.com', 'bob.bianchi', 'ChangeMe123!', 'Content Reviewer'],
                ['Carla', 'Verdi', 'carla.verdi@example.com', 'carla.verdi', 'ChangeMe123!', 'Document Manager, Content Editor'],
            ],
            colWidths: [16, 16, 30, 18, 16, 45],
        },
    },
};

/**
 * Generate an Excel template file as an ArrayBuffer.
 * @param {string} locale - 'it' or 'en'
 * @param {string[]} sheets - Which sheets to include. Options: 'structures', 'objects', 'vocabularies', 'pages', 'roles', 'users'
 * @returns {Promise<ArrayBuffer>} The XLSX file as ArrayBuffer
 */
export async function generateTemplateBuffer(locale = 'it', sheets = null) {
    const XLSX = await _loadXLSX();

    const lang = TEMPLATES[locale] || TEMPLATES.it;
    const sheetKeys = sheets || Object.keys(lang);

    const wb = XLSX.utils.book_new();

    for (const key of sheetKeys) {
        const sheet = lang[key];
        if (!sheet) continue;

        const data = [sheet.headers, ...sheet.rows];
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = sheet.colWidths.map((w) => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName);
    }

    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

/**
 * Generate an Excel template and return it as a File object.
 * @param {string} locale - 'it' or 'en'
 * @param {string[]} sheets - Which sheets to include
 * @param {string} fileName - Output file name
 * @returns {Promise<File>} The XLSX file as a File object
 */
export async function generateTemplateFile(locale = 'it', sheets = null, fileName = null) {
    const buffer = await generateTemplateBuffer(locale, sheets);
    const name = fileName || `template_${locale}.xlsx`;
    return new File([buffer], name, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
}

/**
 * Get available template sheet names for a locale.
 * @param {string} locale - 'it' or 'en'
 * @returns {string[]} Available sheet keys
 */
export function getAvailableTemplateSheets(locale = 'it') {
    const lang = TEMPLATES[locale] || TEMPLATES.it;
    return Object.keys(lang);
}

/**
 * Parse an Excel file from an ArrayBuffer and return structured text.
 * Used by pick_document to extract content from Excel files in the DML.
 * @param {ArrayBuffer} buffer - The XLSX file content as ArrayBuffer
 * @param {string} [locale='it'] - Locale for the sheet label
 * @returns {Promise<string>} Formatted text representation of the Excel data
 */
export async function parseExcelFromBuffer(buffer, locale = 'it') {
    const XLSX = await _loadXLSX();
    const wb = XLSX.read(buffer, { type: 'array' });
    const t = (await import('./i18n.js')).default || {};
    const sheetLabel = t.excelSheetLabel || 'Foglio';

    const parts = [];
    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (rows.length === 0) {
            // Sheet with only headers (or empty)
            const headerRow = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            if (headerRow.length > 0 && headerRow[0].some(h => h !== '')) {
                parts.push(`[${sheetLabel}: "${sheetName}"]`);
                parts.push(headerRow[0].join(' | '));
                parts.push('(nessun dato — solo intestazioni)');
            }
            continue;
        }
        const cols = Object.keys(rows[0]);
        parts.push(`[${sheetLabel}: "${sheetName}"]`);
        parts.push(cols.join(' | '));
        for (const row of rows) {
            parts.push(cols.map(c => String(row[c] ?? '')).join(' | '));
        }
    }
    return parts.join('\n');
}