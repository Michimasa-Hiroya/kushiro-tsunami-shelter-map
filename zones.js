// ===== 地区別避難戦略 =====
// carMode 'nearby'  = 近くの避難所でOK（安全エリア・高台）
// carMode 'distant' = 遠方・高台へ車で避難（低地・海岸エリア）
// ※ 安全ゾーンを先頭に定義して優先判定させる

const ZONES = [

  // ── 安全ゾーン（高台・内陸：近くの避難所で対応可）──
  {
    name: '春採・鶴が台・興津・貝塚エリア',
    bounds: { minLat: 42.950, maxLat: 43.025, minLng: 144.390, maxLng: 144.475 },
    minElevationWalk: 0, carMode: 'nearby', reason: null
  },
  {
    name: '緑が岡エリア',
    bounds: { minLat: 43.010, maxLat: 43.040, minLng: 144.360, maxLng: 144.408 },
    minElevationWalk: 0, carMode: 'nearby', reason: null
  },
  {
    name: '浦見・弥生・千歳町・幣舞エリア',
    bounds: { minLat: 42.960, maxLat: 43.005, minLng: 144.360, maxLng: 144.396 },
    minElevationWalk: 0, carMode: 'nearby', reason: null
  },

  // ── 要注意ゾーン（低地・海岸付近：車で遠方・高台へ）──
  {
    name: '大楽毛・新大楽毛エリア',
    bounds: { minLat: 42.955, maxLat: 43.010, minLng: 144.250, maxLng: 144.335 },
    minElevationWalk: 10, carMode: 'distant',
    reason: '海岸に近く高台がないため、標高10m以上の避難場所を優先します'
  },
  {
    name: '鳥取・昭和・橋北・中部西部エリア',
    bounds: { minLat: 42.970, maxLat: 43.025, minLng: 144.310, maxLng: 144.400 },
    minElevationWalk: 0, carMode: 'distant',
    reason: '低地・海岸付近のため、車では高台や海から離れた場所への避難を推奨します'
  },
  {
    name: '音別・白糠沿岸エリア',
    bounds: { minLat: 42.820, maxLat: 42.960, minLng: 143.790, maxLng: 143.980 },
    minElevationWalk: 8, carMode: 'distant',
    reason: '沿岸部のため標高8m以上を優先します'
  }

];

function getZone(lat, lng) {
  return ZONES.find(z =>
    lat >= z.bounds.minLat && lat <= z.bounds.maxLat &&
    lng >= z.bounds.minLng && lng <= z.bounds.maxLng
  ) ?? null;
}

// ===== 海岸基準点（ユーザー・避難所の海岸距離推定用）=====
const COAST_POINTS = [
  [42.977, 144.384], // 釧路港
  [42.975, 144.356], // 鳥取海岸
  [42.962, 144.316], // 庶路海岸
  [42.960, 144.280], // 大楽毛海岸
  [42.968, 144.265], // 新大楽毛
  [42.855, 143.862], // 音別
  [42.878, 143.895], // 白糠方面
];

// ===== 主要河川ライン（各点 [lat, lng]、河口→上流の順）=====
const RIVER_LINES = [
  // 釧路川
  [[42.977, 144.384], [42.985, 144.380], [42.993, 144.374],
   [43.000, 144.371], [43.012, 144.368], [43.025, 144.370], [43.040, 144.373]],
  // 新釧路川
  [[42.972, 144.267], [42.982, 144.278], [42.993, 144.295],
   [43.005, 144.312], [43.018, 144.328], [43.030, 144.345]],
  // 音別川
  [[42.853, 143.862], [42.865, 143.860], [42.878, 143.868], [42.892, 143.880]],
];

// 河川中心線からこの距離以内の避難所を除外（メートル）
const RIVER_BUFFER_M = 300;
