// Example routes for visitors who have no trip yet (the front page globe, the story's sample trip).
// The flight starts from a home airport for the language they chose; the destinations are common first trips abroad.
const HOME = {
  en: ['DEL', 'Delhi'], hi: ['DEL', 'Delhi'], ta: ['MAA', 'Chennai'], te: ['HYD', 'Hyderabad'], kn: ['BLR', 'Bengaluru'],
  ml: ['COK', 'Kochi'], bn: ['CCU', 'Kolkata'], mr: ['BOM', 'Mumbai'], gu: ['AMD', 'Ahmedabad'], ms: ['KUL', 'Kuala Lumpur'],
  zh: ['PEK', 'Beijing'], ar: ['DXB', 'Dubai'], es: ['MAD', 'Madrid'], fr: ['CDG', 'Paris'], de: ['FRA', 'Frankfurt'],
  ja: ['HND', 'Tokyo'], ko: ['ICN', 'Seoul'], ru: ['SVO', 'Moscow'], th: ['BKK', 'Bangkok'], it: ['FCO', 'Rome'],
}
const AWAY = [['SIN', 'Singapore'], ['DXB', 'Dubai'], ['LHR', 'London'], ['JFK', 'New York'], ['SYD', 'Sydney'], ['YYZ', 'Toronto']]

// the i-th example route from the visitor's home airport (never to itself)
export function sampleRoute(lang, i = 0) {
  const [oc, ocity] = HOME[lang] || HOME.en
  const dests = AWAY.filter(([c]) => c !== oc)
  const [dc, dcity] = dests[i % dests.length]
  return { origin_code: oc, origin_city: ocity, destination_code: dc, destination_city: dcity }
}
export const SAMPLE_COUNT = AWAY.length - 1
