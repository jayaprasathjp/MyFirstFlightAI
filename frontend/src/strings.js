export const LANGUAGES = [
  { code: 'en', native: 'English', english: 'English', locale: 'en-IN' },
  { code: 'hi', native: 'हिंदी', english: 'Hindi', locale: 'hi-IN' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil', locale: 'ta-IN' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu', locale: 'te-IN' },
  { code: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada', locale: 'kn-IN' },
  { code: 'ml', native: 'മലയാളം', english: 'Malayalam', locale: 'ml-IN' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali', locale: 'bn-IN' },
  { code: 'mr', native: 'मराठी', english: 'Marathi', locale: 'mr-IN' },
  { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati', locale: 'gu-IN' },
  { code: 'ms', native: 'Bahasa Melayu', english: 'Malay', locale: 'ms-MY' },
  { code: 'zh', native: '中文', english: 'Mandarin', locale: 'zh-CN' },
  { code: 'ar', native: 'العربية', english: 'Arabic', locale: 'ar', rtl: true },
  { code: 'es', native: 'Español', english: 'Spanish', locale: 'es-ES' },
  { code: 'fr', native: 'Français', english: 'French', locale: 'fr-FR' },
  { code: 'de', native: 'Deutsch', english: 'German', locale: 'de-DE' },
  { code: 'ja', native: '日本語', english: 'Japanese', locale: 'ja-JP' },
  { code: 'ko', native: '한국어', english: 'Korean', locale: 'ko-KR' },
  { code: 'ru', native: 'Русский', english: 'Russian', locale: 'ru-RU' },
  { code: 'th', native: 'ไทย', english: 'Thai', locale: 'th-TH' },
  { code: 'it', native: 'Italiano', english: 'Italian', locale: 'it-IT' },
]

// English source strings live in locales/en.json. The other languages are pre-translated files in locales/
// (regenerate with backend/tools/gen_ui_locales.py); any key missing there is translated live and cached.
export { default as EN } from './locales/en.json'
