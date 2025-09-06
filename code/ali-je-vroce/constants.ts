// =============================================================================
// PERCENTILE TYPES
// =============================================================================

type ValidPercentile = 'p00' | 'p05' | 'p20' | 'p40' | 'p60' | 'p80' | 'p95';
type PercentileKey = ValidPercentile | ''
type PercentileLabels = Record<PercentileKey, string>
type PercentileValues = Record<PercentileKey, string>
type PercentileDescriptions = Record<PercentileKey, string>

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * The prefix used for all localStorage cache keys in the application
 */
export const CACHE_KEY_PREFIX = 'ali-je-vroce-cache' as const

/**
 * The default weather station object containing ID, name, and prefix.
 * 
 * Current for Ljubljana.
 */
export const DEFAULT_STATION = {
    value: 1495,
    label: 'Ljubljana',
    prefix: 'v'
} as const

/**
The base URL for the API.

I believe this URL is like local dataset server.
 */
export const STAGE_DATA_BASE_URL = 'https://stage-data.podnebnik.org' as const
// const baseUrl = 'http://localhost:8010'

/**
 * The base URL for the Vremenar API.
 */
export const VREMENAR_BASE_URL = 'https://podnebnik.vremenar.app' as const

/**
 * The base URL for the Vremenar API.
 * 
 * I believe this works only for stations details
 * example url: https://podnebnik.vremenar.app/staging/stations/details/METEO-1402?country=si
 * 
 */
export const STAGING_VREMENAR_API_URL = 'https://podnebnik.vremenar.app/staging' as const
// const vremenarBaseUrl = 'http://localhost:8000'

/**
 * Labels for the percentiles.
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
} satisfies PercentileLabels

/**
 * Value labels for the percentiles.
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
} satisfies PercentileValues

/**
 * Descriptions for the percentiles.
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
} satisfies PercentileDescriptions