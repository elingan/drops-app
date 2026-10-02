import type { CategoryTone } from '$lib/domain/types';

/**
 * Built-in content: a small hand-picked starter set plus the Austria-focused
 * vocabulary (≈800 words + 260 phrases) in vocabulary-at.json. Users can add
 * more through the JSON/CSV importer, which uses the same shape.
 */
export interface SeedCategory {
	id: string;
	name: string;
	description: string;
	tone: CategoryTone;
}

export interface SeedItem {
	type?: 'word' | 'phrase';
	german: string;
	alt?: string;
	translation: string;
	context?: string;
	category: string;
}

export const SEED_CATEGORIES: SeedCategory[] = [
	{ id: 'alltag', name: 'Alltag', description: 'Vida cotidiana', tone: 0 },
	{ id: 'arbeit', name: 'Arbeit', description: 'Trabajo y oficina', tone: 1 },
	{ id: 'familie', name: 'Familie', description: 'Familia y amigos', tone: 0 },
	{ id: 'einkaufen', name: 'Einkaufen', description: 'Compras', tone: 1 },
	{ id: 'restaurant', name: 'Restaurant', description: 'Comer fuera', tone: 0 },
	{ id: 'verkehr', name: 'Verkehr', description: 'Transporte', tone: 1 },
	{ id: 'gesundheit', name: 'Gesundheit', description: 'Salud', tone: 0 },
	{ id: 'freizeit', name: 'Freizeit', description: 'Tiempo libre', tone: 1 },
	{ id: 'redewendungen', name: 'Redewendungen', description: 'Expresiones hechas', tone: 0 },
	{ id: 'korrespondenz', name: 'Korrespondenz', description: 'Emails y cartas', tone: 1 },
	{ id: 'technik', name: 'Technik', description: 'Web, IT y dispositivos', tone: 0 },
	{ id: 'finanzen', name: 'Finanzen', description: 'Facturas, banco e impuestos', tone: 1 },
	{ id: 'behoerden', name: 'Behörden', description: 'Trámites y administración en Austria', tone: 0 },
	{ id: 'wohnen', name: 'Wohnen', description: 'Vivienda y alquiler', tone: 1 }
];

/**
 * Bump when the bundled vocabulary changes: existing installs then get the
 * new items (duplicates are skipped, progress is untouched).
 */
export const SEED_VERSION = 2;

/** Main dataset (data/vocabulary/*.txt → npm run vocab:build). Loaded lazily. */
export const loadVocabulary = async (): Promise<SeedItem[]> =>
	(await import('./vocabulary-at.json')).default as SeedItem[];

export const SEED_ITEMS: SeedItem[] = [
	// Alltag
	{ german: 'Das kriegen wir heute noch hin.', alt: 'Wir schaffen das heute noch.', translation: 'Lo conseguiremos hoy mismo.', category: 'Alltag' },
	{ german: 'erledigen', alt: 'machen, abschließen', translation: 'hacer, despachar', category: 'Alltag' },
	{ german: 'eigentlich', alt: 'im Grunde', translation: 'en realidad', category: 'Alltag' },
	{ german: 'aufräumen', translation: 'ordenar', category: 'Alltag' },
	{ german: 'Mir ist langweilig.', translation: 'Me aburro.', category: 'Alltag' },
	{ german: 'übrigens', translation: 'por cierto', category: 'Alltag' },
	{ german: 'Servus!', alt: 'Hallo! / Tschüss!', translation: '¡Hola! / ¡Adiós!', context: 'Austria y Baviera, informal.', category: 'Alltag' },
	{ german: 'heuer', alt: 'dieses Jahr', translation: 'este año', context: 'Austriaco.', category: 'Alltag' },
	{ german: 'Baba!', alt: 'Tschüss!', translation: '¡Chao!', context: 'Austriaco coloquial.', category: 'Alltag' },
	// Arbeit
	{ german: 'ausmachen', alt: 'vereinbaren · ausschalten', translation: 'acordar · apagar', category: 'Arbeit' },
	{ german: 'Das können wir morgen besprechen.', alt: 'Darüber reden wir morgen.', translation: 'Podemos hablarlo mañana.', context: 'En el trabajo, cuando aplazas un tema a otro día.', category: 'Arbeit' },
	{ german: 'die Frist', alt: 'der Termin, bis wann etwas fertig sein muss', translation: 'el plazo', category: 'Arbeit' },
	{ german: 'die Besprechung', translation: 'la reunión', category: 'Arbeit' },
	{ german: 'Ich melde mich bei dir.', translation: 'Te escribo / te aviso.', category: 'Arbeit' },
	{ german: 'kündigen', translation: 'renunciar · despedir', category: 'Arbeit' },
	// Familie
	{ german: 'die Schwiegermutter', alt: 'die Mutter des Ehepartners', translation: 'la suegra', category: 'Familie' },
	{ german: 'Wir kommen am Sonntag vorbei.', alt: 'Wir besuchen euch am Sonntag.', translation: 'Pasamos a veros el domingo.', category: 'Familie' },
	{ german: 'die Geschwister', translation: 'los hermanos', category: 'Familie' },
	{ german: 'verwandt', translation: 'emparentado', category: 'Familie' },
	// Einkaufen
	{ german: 'der Beleg', alt: 'die Quittung', translation: 'el recibo', category: 'Einkaufen' },
	{ german: 'Kann ich mit Karte zahlen?', alt: 'Geht Kartenzahlung?', translation: '¿Puedo pagar con tarjeta?', category: 'Einkaufen' },
	{ german: 'das Sonderangebot', translation: 'la oferta', category: 'Einkaufen' },
	{ german: 'Ich schaue nur.', translation: 'Solo estoy mirando.', category: 'Einkaufen' },
	{ german: 'das Sackerl', alt: 'die Tüte', translation: 'la bolsa', context: 'Austriaco.', category: 'Einkaufen' },
	{ german: 'der Paradeiser', alt: 'die Tomate', translation: 'el tomate', context: 'Austriaco.', category: 'Einkaufen' },
	// Restaurant
	{ german: 'Wir hätten gern die Rechnung.', alt: 'Bitte zahlen.', translation: 'Nos trae la cuenta, por favor.', category: 'Restaurant' },
	{ german: 'bestellen', translation: 'pedir', category: 'Restaurant' },
	{ german: 'Ist hier noch frei?', translation: '¿Está libre?', category: 'Restaurant' },
	{ german: 'die Jause', alt: 'die Zwischenmahlzeit', translation: 'la merienda', context: 'Austriaco.', category: 'Restaurant' },
	// Verkehr
	{ german: 'umsteigen', alt: 'das Verkehrsmittel wechseln', translation: 'hacer transbordo', category: 'Verkehr' },
	{ german: 'die Verspätung', translation: 'el retraso', category: 'Verkehr' },
	{ german: 'Der Zug fällt aus.', translation: 'El tren está cancelado.', category: 'Verkehr' },
	// Gesundheit
	{ german: 'sich erkälten', alt: 'eine Erkältung bekommen', translation: 'resfriarse', category: 'Gesundheit' },
	{ german: 'der Termin beim Arzt', translation: 'la cita con el médico', category: 'Gesundheit' },
	{ german: 'Mir ist schwindelig.', translation: 'Estoy mareado.', category: 'Gesundheit' },
	// Freizeit
	{ german: 'Hast du am Wochenende schon was vor?', alt: 'Hast du schon Pläne?', translation: '¿Ya tienes planes para el finde?', category: 'Freizeit' },
	{ german: 'spazieren gehen', translation: 'ir a pasear', category: 'Freizeit' },
	{ german: 'Lust haben', translation: 'tener ganas', category: 'Freizeit' },
	// Redewendungen
	{ german: 'Ich verstehe nur Bahnhof.', alt: 'Ich verstehe gar nichts.', translation: 'No entiendo nada.', context: 'Coloquial. Literalmente: «solo entiendo estación».', category: 'Redewendungen' },
	{ german: 'Das ist nicht mein Bier.', alt: 'Das geht mich nichts an.', translation: 'No es asunto mío.', context: 'Coloquial, para decir que algo no te incumbe.', category: 'Redewendungen' },
	{ german: 'Daumen drücken', translation: 'cruzar los dedos', category: 'Redewendungen' },
	{ german: 'Tomaten auf den Augen haben', translation: 'no ver lo evidente', category: 'Redewendungen' },
	{ german: 'Das ist mir Wurst.', alt: 'Das ist mir egal.', translation: 'Me da igual.', category: 'Redewendungen' },
	{ german: 'Schmäh führen', alt: 'Witze machen', translation: 'bromear', context: 'Austriaco (Viena).', category: 'Redewendungen' }
];
