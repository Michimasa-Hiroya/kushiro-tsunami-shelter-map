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

  // ===== 使い方ページ =====
  'howto-intro':    { ja: 'このアプリは、釧路市・釧路町・白糠町・音別町の<strong>津波発生時の最寄り避難所</strong>を素早く確認するための防災支援ツールです。',
                      en: 'This app helps you quickly find the <strong>nearest tsunami evacuation shelter</strong> in Kushiro City, Kushiro Town, Shiranuka Town, and Onbetsu Town.' },

  'howto-s1-title': { ja: 'まずこのボタンをタップ！',          en: 'Tap this button first!' },
  'howto-s1-body':  { ja: '画面下の光るボタン <strong>「📍 現在地から最寄りの避難所を探す」</strong> をタップするだけで、GPS が現在地を取得し、最寄りの避難所を3ヶ所案内します。',
                      en: 'Tap the glowing button <strong>"📍 Find Nearest Shelter (GPS)"</strong> at the bottom of the screen. GPS will locate you and show the 3 nearest shelters.' },

  'howto-s2-title': { ja: '地図上の避難所マーカーを確認する',    en: 'Check shelter markers on the map' },
  'howto-s2-li1':   { ja: '🔵 <strong>緊急避難場所</strong>（水色）：すぐ逃げる高台・建物', en: '🔵 <strong>Emergency site</strong> (blue): High ground / building to flee to immediately' },
  'howto-s2-li2':   { ja: '🟢 <strong>避難所</strong>（緑）：しばらく生活できる施設',       en: '🟢 <strong>Shelter</strong> (green): Facility for extended stay' },
  'howto-s2-li3':   { ja: 'マーカーをタップ → 施設名・住所・標高を表示',                    en: 'Tap a marker → Shows name, address, and elevation' },
  'howto-s2-li4':   { ja: '<strong>空</strong>=空き　<strong>混</strong>=混雑　<strong>満</strong>=満室', en: '<strong>Open</strong>=Available　<strong>Busy</strong>=Crowded　<strong>Full</strong>=Full' },

  'howto-s3-title': { ja: '住所・地図タップでも検索できる',       en: 'Search by address or map tap' },
  'howto-s3-li1':   { ja: '🔍 <strong>住所入力</strong>：市町村＋番地を入力して「検索」',    en: '🔍 <strong>Address</strong>: Enter town + street number and tap "Search"' },
  'howto-s3-li2':   { ja: '🗺 <strong>地図タップ</strong>：ボタン後、地図の場所をタップ',   en: '🗺 <strong>Map tap</strong>: Press button then tap any spot on the map' },
  'howto-s3-li3':   { ja: '結果は近い順に3ヶ所。<strong>🔄 やり直す</strong>でリセット',     en: '3 results shown by distance. Tap <strong>🔄 Reset</strong> to start over.' },

  'howto-s4-title': { ja: 'シナリオを設定する（任意）',           en: 'Set a scenario (optional)' },
  'howto-s4-body':  { ja: 'ヘッダーの <strong>🌊 シナリオ表示</strong> をタップで開きます。', en: 'Tap <strong>🌊 Scenario</strong> in the header to open settings.' },
  'howto-s4-li1':   { ja: '🌊 <strong>津波高さ</strong>：危険な避難所を自動除外',             en: '🌊 <strong>Tsunami height</strong>: Auto-excludes unsafe shelters' },
  'howto-s4-li2':   { ja: '⏱ <strong>到達時間</strong>：到達圏を地図に表示',                 en: '⏱ <strong>Arrival time</strong>: Shows reachable area on map' },
  'howto-s4-li3':   { ja: '🌊 <strong>潮位</strong>：干潮〜満潮で補正',                       en: '🌊 <strong>Tide level</strong>: Adjusts for low/high tide' },

  'howto-s5-title': { ja: 'メニューからページを切り替える',        en: 'Navigate pages from the menu' },
  'howto-s5-body':  { ja: '左上の <strong>☰</strong> をタップするとメニューが開きます。',     en: 'Tap <strong>☰</strong> in the top-left to open the menu.' },
  'howto-s5-li1':   { ja: '📖 使い方　📂 避難所データ',                                        en: '📖 How to use　📂 Shelter data' },
  'howto-s5-li2':   { ja: '🔒 プライバシーポリシー　👤 製作者情報',                            en: '🔒 Privacy Policy　👤 Creator' },

  'howto-s6-title': { ja: '病院・通行止め情報を確認する',          en: 'Check hospital & road closure info' },
  'howto-s6-li1':   { ja: '🏥 病院マーカーをタップ → 標高・安全階数の目安',                   en: '🏥 Tap hospital marker → Elevation & safe floor estimate' },
  'howto-s6-li2':   { ja: '🔴 赤丸 → <strong>通行止め箇所</strong>。タップで詳細表示',        en: '🔴 Red circle → <strong>Road closure</strong>. Tap for details.' },

  'howto-note-title': { ja: '⚠️ ご注意', en: '⚠️ Notice' },
  'howto-note-body':  { ja: '本アプリはシミュレーションです。実際の避難行動は<strong>行政・防災無線の指示</strong>に必ず従ってください。',
                         en: 'This app is a simulation. Always follow <strong>official government and disaster radio instructions</strong> in real emergencies.' },

  'howto-glossary-title': { ja: '📚 用語解説', en: '📚 Glossary' },
  'howto-g1-term': { ja: '指定緊急避難場所', en: 'Emergency Evacuation Site' },
  'howto-g1-def':  { ja: '🏃 すぐ逃げる場所', en: '🏃 Go here immediately' },
  'howto-g2-term': { ja: '指定避難所', en: 'Designated Shelter' },
  'howto-g2-def':  { ja: '🏠 しばらく過ごせる場所', en: '🏠 Stay here for extended period' },
  'howto-g3-term': { ja: '浸水深', en: 'Inundation Depth' },
  'howto-g3-def':  { ja: '🌊 津波の届く高さ（予想）', en: '🌊 Estimated tsunami reach height' },
  'howto-g4-term': { ja: '到達圏', en: 'Reachable Zone' },
  'howto-g4-def':  { ja: '⏱️ ここまで何分で着くか', en: '⏱️ Area reachable within time limit' },

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
