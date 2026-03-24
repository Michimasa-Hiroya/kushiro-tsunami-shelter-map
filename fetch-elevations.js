// 国土地理院API で EXTRA_SHELTERS の標高を取得して extra-shelters-data.js を更新するスクリプト
// 実行: node fetch-elevations.js

const https = require('https');
const fs = require('fs');
const path = require('path');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchElevation(lat, lng) {
  return new Promise((resolve) => {
    const url = `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lng}&lat=${lat}&outtype=JSON`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const elev = json.elevation;
          resolve(typeof elev === 'number' && !isNaN(elev) ? Math.round(elev * 10) / 10 : null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function main() {
  const filePath = path.join(__dirname, 'extra-shelters-data.js');
  let src = fs.readFileSync(filePath, 'utf8');

  // EXTRA_SHELTERS 配列を eval して取得
  const match = src.match(/const EXTRA_SHELTERS\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) { console.error('EXTRA_SHELTERS が見つかりません'); process.exit(1); }

  const shelters = eval(match[1]); // eslint-disable-line no-eval
  console.log(`対象: ${shelters.length} 件`);

  let updated = 0;
  for (let i = 0; i < shelters.length; i++) {
    const s = shelters[i];
    if (s.elevation_m !== undefined) {
      console.log(`[${i+1}/${shelters.length}] SKIP ${s.name} (既存: ${s.elevation_m}m)`);
      continue;
    }
    await sleep(120); // レートリミット対策
    const elev = await fetchElevation(s.lat, s.lng);
    shelters[i] = { ...s, elevation_m: elev };
    console.log(`[${i+1}/${shelters.length}] ${s.name}: ${elev}m`);
    updated++;
  }

  // ファイルを再生成
  const lines = shelters.map(s => {
    const elevStr = s.elevation_m !== null && s.elevation_m !== undefined
      ? `, elevation_m:${s.elevation_m}`
      : '';
    const disastersStr = JSON.stringify(s.disasters);
    const typesStr = JSON.stringify(s.types);
    return `  { name:${JSON.stringify(s.name)}, address:${JSON.stringify(s.address)}, lat:${s.lat}, lng:${s.lng}, capacity:${s.capacity}, town:${JSON.stringify(s.town)}, types:${typesStr}, disasters:${disastersStr}${elevStr} }`;
  });

  // 釧路町と白糠町の区切りを維持しながら書き出し
  const newContent = src.replace(
    /const EXTRA_SHELTERS\s*=\s*\[[\s\S]*?\];/,
    `const EXTRA_SHELTERS = [\n${lines.join(',\n')}\n];`
  );

  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`\n完了: ${updated} 件の標高データを追加しました`);
}

main().catch(console.error);
