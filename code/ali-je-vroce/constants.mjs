/**
 * @typedef {'p00' | 'p05' | 'p20' | 'p40' | 'p60' | 'p80' | 'p95'} ValidPercentile
 * @typedef { ValidPercentile | ''} PercentileKey
 * 
 */

/**
 * @constant {string} CACHE_KEY_PREFIX
 * @description The prefix used for all localStorage cache keys in the application.
 */
export const CACHE_KEY_PREFIX = 'ali-je-vroce-cache';

/**
 * @constant {number} DEFAULT_STATION_ID
 * @description The default weather station ID for Ljubljana.
 */
const DEFAULT_STATION_ID = 1495; // Ljubljana
/**
 * @constant {string} DEFAULT_STATION_NAME
 * @description The default name of the weather station.
 */
const DEFAULT_STATION_NAME = 'Ljubljana';
/**
 * @constant {string} DEFAULT_STATION_PREFIX
 * @description The default prefix for the weather station, used in the UI.
 */
const DEFAULT_STATION_PREFIX = 'v'; // 'v' for "v Ljubljani"    

/**
 * @constant DEFAULT_STATION
 * @description The default weather station object containing ID, name, and prefix.
 */
export const DEFAULT_STATION = {
    value: DEFAULT_STATION_ID,
    label: DEFAULT_STATION_NAME,
    prefix: DEFAULT_STATION_PREFIX,
}

// URL
/**
 * @constant {string} BASE_URL
 * @description The base URL for the API.
 */
export const BASE_URL = 'https://stage-data.podnebnik.org'
// const baseUrl = 'http://localhost:8010'
/**
 * @constant {string} VREMENAR_BASE_URL
 * @description The base URL for the Vremenar API.
 */
export const VREMENAR_BASE_URL = 'https://podnebnik.vremenar.app/staging'
// const vremenarBaseUrl = 'http://localhost:8000'

/**
 * @type {Record<PercentileKey, string>} PercentileLabels
 */
export const percentile_labels = {
    'p00': 'manj kot 5 %',
    'p05': '5 %',
    'p20': '20 %',
    'p40': '40 %',
    'p60': '60 %',
    'p80': '80 %',
    'p95': '95 %',
    '': '',
}

/**
 * @type {Record<PercentileKey, string>} PercentileValues
 */
export const vrednosti = {
    'p00': 'Niti pod razno',
    'p05': 'Ne!',
    'p20': 'Ne.',
    'p40': 'Niti ne.',
    'p60': 'Ja.',
    'p80': 'Ja!',
    'p95': 'Ja, absolutno!',
    '': '',
}

/**
 * @type {Record<PercentileKey, string>} PercentileDescriptions
 */
export const opisi = {
    'p00': 'Se hecaš?! Ful je mraz!',
    'p05': 'Pravzaprav je res mrzlo.',
    'p20': 'Dejansko je kar hladno.',
    'p40': 'Precej povprečno.',
    'p60': 'Je topleje kot običajno.',
    'p80': 'Res je vroče!',
    'p95': 'Peklensko vroče je!',
    '': '',
}