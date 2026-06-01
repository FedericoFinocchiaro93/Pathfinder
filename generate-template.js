const XLSX = require('xlsx');

// Foglio "Strutture" — DDM Structures
const strutture = [
    ['NomeStruttura', 'Campo', 'Tipo', 'Obbligatorio', 'Opzioni'],
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
    ['Evento', 'Titolo', 'text', 'si', ''],
    ['Evento', 'Descrizione', 'textarea', 'no', ''],
    ['Evento', 'Data Inizio', 'date', 'si', ''],
    ['Evento', 'Data Fine', 'date', 'no', ''],
    ['Evento', 'Luogo', 'text', 'no', ''],
    ['Evento', 'Immagine', 'document', 'no', ''],
];

// Foglio "Oggetti" — Object Definitions
const oggetti = [
    ['NomeOggetto', 'Campo', 'Tipo', 'Obbligatorio', 'Scope'],
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
];

// Foglio "Vocabolari" — Taxonomy Vocabularies & Categories
// NOTA: VocabolarioPadre è vuoto per i vocabolari (righe di primo livello).
//       Le categorie figlie indicano il nome del vocabolario o della categoria padre.
//       MultiValued: "si" = il vocabolario permette più categorie per contenuto.
const vocabolari = [
    ['Nome', 'Tipo', 'Descrizione', 'VocabolarioPadre', 'MultiValued'],
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
];

// Foglio "Ruoli" — Role Definitions
// Type: "Regular" (portale), "Site" (sito), "Organization" (organizzazione)
const ruoli = [
    ['NomeRuolo', 'Tipo', 'Descrizione'],
    ['Editor Contenuti', 'Site', 'Può creare e modificare contenuti web'],
    ['Revisore Contenuti', 'Site', 'Può revisionare e approvare contenuti per la pubblicazione'],
    ['Gestore Pagine', 'Site', 'Può creare, modificare ed eliminare pagine del sito'],
    ['Gestore Documenti', 'Site', 'Può caricare e gestire documenti e media'],
];

// Foglio "Utenti" — User Accounts
// Ruolo: lista di nomi ruolo separati da virgola (devono corrispondere ai nomi nel foglio Ruoli).
const utenti = [
    ['Nome', 'Cognome', 'Email', 'ScreenName', 'Password', 'Ruolo'],
    ['Mario', 'Rossi', 'mario.rossi@example.com', 'mario.rossi', 'ChangeMe123!', 'Editor Contenuti, Gestore Pagine'],
    ['Laura', 'Bianchi', 'laura.bianchi@example.com', 'laura.bianchi', 'ChangeMe123!', 'Revisore Contenuti'],
    ['Giuseppe', 'Verdi', 'giuseppe.verdi@example.com', 'giuseppe.verdi', 'ChangeMe123!', 'Gestore Documenti, Editor Contenuti'],
];

// Foglio "Pagine" — Site Pages with hierarchy
// NOTA: le pagine figlie (con PaginaPadre) NON hanno FriendlyURL
//       perché Liferay lo genera automaticamente dal titolo.
//       Solo le pagine radice hanno FriendlyURL.
//       PaginaPadre contiene il NOME della pagina padre (non il friendlyUrlPath).
const pagine = [
    ['Pagina', 'Tipo', 'FriendlyURL', 'PaginaPadre', 'MasterPage'],
    ['Home', 'Pagina contenuto', '/home', '', 'almaviva'],
    ['Chi Siamo', 'Pagina contenuto', '', 'Home', 'almaviva'],
    ['Servizi', 'Pagina contenuto', '/servizi', '', 'almaviva'],
    ['Consulenza', 'Pagina contenuto', '', 'Servizi', 'almaviva'],
    ['Sviluppo', 'Pagina contenuto', '', 'Servizi', 'almaviva'],
    ['Contatti', 'Pagina widget', '/contatti', '', ''],
];

const wb = XLSX.utils.book_new();

const ws1 = XLSX.utils.aoa_to_sheet(strutture);
ws1['!cols'] = [
    { wch: 18 }, // NomeStruttura
    { wch: 22 }, // Campo
    { wch: 12 }, // Tipo
    { wch: 14 }, // Obbligatorio
    { wch: 40 }, // Opzioni
];
XLSX.utils.book_append_sheet(wb, ws1, 'Strutture');

const ws2 = XLSX.utils.aoa_to_sheet(oggetti);
ws2['!cols'] = [
    { wch: 18 }, // NomeOggetto
    { wch: 22 }, // Campo
    { wch: 12 }, // Tipo
    { wch: 14 }, // Obbligatorio
    { wch: 12 }, // Scope
];
XLSX.utils.book_append_sheet(wb, ws2, 'Oggetti');

const ws3 = XLSX.utils.aoa_to_sheet(vocabolari);
ws3['!cols'] = [
    { wch: 20 }, // Nome
    { wch: 14 }, // Tipo
    { wch: 30 }, // Descrizione
    { wch: 20 }, // VocabolarioPadre
    { wch: 14 }, // MultiValued
];
XLSX.utils.book_append_sheet(wb, ws3, 'Vocabolari');

const ws4 = XLSX.utils.aoa_to_sheet(pagine);
ws4['!cols'] = [
    { wch: 20 }, // Pagina
    { wch: 20 }, // Tipo
    { wch: 18 }, // FriendlyURL
    { wch: 18 }, // PaginaPadre
    { wch: 14 }, // MasterPage
];
XLSX.utils.book_append_sheet(wb, ws4, 'Pagine');

const ws5 = XLSX.utils.aoa_to_sheet(ruoli);
ws5['!cols'] = [
    { wch: 22 }, // NomeRuolo
    { wch: 14 }, // Tipo
    { wch: 50 }, // Descrizione
];
XLSX.utils.book_append_sheet(wb, ws5, 'Ruoli');

const ws6 = XLSX.utils.aoa_to_sheet(utenti);
ws6['!cols'] = [
    { wch: 16 }, // Nome
    { wch: 16 }, // Cognome
    { wch: 30 }, // Email
    { wch: 18 }, // ScreenName
    { wch: 16 }, // Password
    { wch: 40 }, // Ruolo
];
XLSX.utils.book_append_sheet(wb, ws6, 'Utenti');

XLSX.writeFile(wb, 'template_strutture.xlsx');
console.log('File template_strutture.xlsx creato con successo!');