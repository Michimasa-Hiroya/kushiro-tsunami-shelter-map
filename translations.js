// ===== 多言語対応 (ja / en) =====
window.lang = localStorage.getItem('appLang') || 'ja';

const T = {
  // Header
  'app-title':       { ja: '釧路津波避難所マップ', en: 'Kushiro Tsunami Shelter Map' },
  'scenario-unset':  { ja: '🌊 シナリオ未設定',    en: '🌊 Scenario not set' },

  // Filter buttons
  'filter-kinkyuu':  { ja: '緊急避難場所',  en: 'Emergency' },
  'filter-hinanjo':  { ja: '避難所',        en: 'Shelters' },
  'filter-all':      { ja: '全避難所',      en: 'All' },

  // GPS / search
  'gps-btn':         { ja: '📍 現在地から最寄りの避難所を探す', en: '📍 Find Nearest Shelter (GPS)' },
  'gps-hint':        { ja: '👆 ここをタップ',                  en: '👆 Tap here' },
  'reset-btn':       { ja: '🔄 やり直す',                      en: '🔄 Reset' },
  'map-tap-btn':     { ja: '🗺 地図をタップして位置を指定',    en: '🗺 Tap map to set location' },
  'or-divider':      { ja: 'または住所を入力',                 en: 'or enter address' },
  'search-btn':      { ja: '検索',                             en: 'Search' },
  'addr-hint':       { ja: '例: 大楽毛〇丁目〇番 / 大楽毛〇-〇　※住所入力は番地までのデータです',
                       en: 'e.g. Otanoshike ○-○  ※Address data is available down to street number' },
  'addr-placeholder':{ ja: '町名・番地またはキーワード',       en: 'Town, address or keyword' },
  'results-title':   { ja: '🏃 最も近い避難場所',              en: '🏃 Nearest Shelters' },

  // Map tap banner
  'map-tap-text':    { ja: '📍 地図をタップして現在地を指定してください', en: '📍 Tap the map to set your location' },

  // Loading
  'loading-text':    { ja: '避難場所を検索中...',  en: 'Searching for shelters...' },

  // Offline
  'offline-banner':  { ja: '📵 オフラインモード — 地図・避難所データはキャッシュから表示しています',
                       en: '📵 Offline mode — Showing cached map & shelter data' },

  // Help tooltip
  'help-tooltip':    { ja: '👆 使い方を見る', en: '👆 How to use' },

  // Consent modal
  'consent-title':   { ja: '位置情報を使用します',                          en: 'Location Access' },
  'consent-body':    { ja: '現在地を取得して、最寄りの避難所を案内します。', en: 'We will use GPS to find the nearest shelter.' },
  'consent-li1':     { ja: '🔒 位置情報は<strong>端末内のみ</strong>で処理。外部送信しません',
                       en: '🔒 Location is processed <strong>on-device only</strong>. Not sent externally.' },
  'consent-li2':     { ja: '⚠️ ルート表示時のみ、座標を経路探索サービスへ送信します',
                       en: '⚠️ Route coordinates are sent to OSRM routing service when displaying routes.' },
  'consent-agree':   { ja: '同意して現在地を取得', en: 'Agree & Get Location' },
  'consent-cancel':  { ja: 'キャンセル',           en: 'Cancel' },

  // Settings modal
  'settings-title':  { ja: '⚙ シナリオ設定',  en: '⚙ Scenario Settings' },
  'scenario-tsunami':{ ja: '🌊 津波高さ',      en: '🌊 Tsunami Height' },
  'scenario-time':   { ja: '⏱ 到達時間',       en: '⏱ Arrival Time' },
  'scenario-tide':   { ja: '🌊 潮位',           en: '🌊 Tide Level' },
  'tide-low':        { ja: '干潮 −1m',          en: 'Low −1m' },
  'tide-avg':        { ja: '平均潮位',           en: 'Mean' },
  'tide-high':       { ja: '満潮 +1m',          en: 'High +1m' },

  // Dynamic result strings
  'rank-1':          { ja: '🥇 第1候補', en: '🥇 1st' },
  'rank-2':          { ja: '🥈 第2候補', en: '🥈 2nd' },
  'rank-3':          { ja: '🥉 第3候補', en: '🥉 3rd' },
  'walk-min':        { ja: (n) => `🚶 徒歩 約${n}分`, en: (n) => `🚶 ~${n} min walk` },
  'walk-warn':       { ja: ' ⚠ 津波到達前に間に合わない可能性', en: ' ⚠ May not reach in time' },
  'route-btn':       { ja: 'ルートを地図に表示', en: 'Show Route on Map' },
  'details-btn':     { ja: '詳細を見る',         en: 'Details' },
  'from-sea':        { ja: (km) => `🌊 海岸から ${km}km`, en: (km) => `🌊 ${km}km from sea` },
  'estimated':       { ja: '概算',  en: 'Est.' },
  'time-danger-warn':{ ja: ' ⚠ 間に合わない可能性', en: ' ⚠ May not make it' },

  // Advice box
  'advice-title':    { ja: '⚠️ 避難の際のご注意',        en: '⚠️ Evacuation Notes' },
  'advice-1':        { ja: '🏃 最寄りの避難所を3箇所出しています。どこに逃げれば良いか、自宅に留まるかはご自身で判断してください。',
                       en: '🏃 3 nearest shelters are shown. Please decide where to evacuate based on your own judgment.' },
  'advice-2':        { ja: '📻 実際の避難行動は、行政・防災無線の指示に必ず従ってください。',
                       en: '📻 Always follow official government and disaster radio instructions.' },
  'advice-3':        { ja: '🏠 指定避難所は参考程度に出しています。緊急の場合は、指定緊急避難場所に逃げてください。',
                       en: '🏠 Designated shelters are for reference. In emergencies, go to an emergency evacuation site.' },
  'advice-4':        { ja: '🚗 車での避難は渋滞が発生しやすく、到達時間に大きなばらつきが生じる可能性があります。高台・内陸方向を目指してください。',
                       en: '🚗 Evacuation by car may cause traffic jams. Head to higher ground or inland.' },
  'advice-5':        { ja: '🌉 大津波警報発令時は橋が封鎖される場合があります。橋を渡る経路を避難ルートとしている場合は、別ルートも事前に確認しておいてください。',
                       en: '🌉 Bridges may be closed during major tsunami warnings. Check alternate routes in advance.' },
};

// ===== 言語適用 =====
function applyLang(lang) {
  window.lang = lang;
  localStorage.setItem('appLang', lang);
  document.documentElement.lang = lang === 'en' ? 'en' : 'ja';

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (T[key] && typeof T[key][lang] === 'string') el.textContent = T[key][lang];
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.dataset.i18nHtml;
    if (T[key] && typeof T[key][lang] === 'string') el.innerHTML = T[key][lang];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (T[key] && typeof T[key][lang] === 'string') el.placeholder = T[key][lang];
  });

  const btn = document.getElementById('lang-btn');
  if (btn) btn.textContent = lang === 'ja' ? '🌐 EN' : '🌐 JA';

  if (typeof updateScenarioChip === 'function') updateScenarioChip();
}

function toggleLang() {
  applyLang(window.lang === 'ja' ? 'en' : 'ja');
}

// ===== 翻訳ヘルパー =====
function tStr(key, ...args) {
  const entry = T[key];
  if (!entry) return key;
  const val = entry[window.lang] || entry['ja'];
  return typeof val === 'function' ? val(...args) : val;
}

document.addEventListener('DOMContentLoaded', () => {
  applyLang(window.lang);
});
