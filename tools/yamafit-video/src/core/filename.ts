// 書き出しファイル名の規則：yamafit_{型番}_{YYYYMMDD}.mp4

/** 型番をファイル名に使える形にする（使えない文字は - に置き換える） */
export function sanitizeModelNumber(modelNumber: string): string {
  const s = modelNumber
    .normalize('NFKC')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return s.length > 0 ? s : 'item';
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * 書き出しファイル名を決める。同じ名前がすでにあれば _2、_3… を付ける。
 * exists は「その名前のファイルがあるか」を答える関数。
 */
export function outputFileName(modelNumber: string, date: Date, exists: (name: string) => boolean = () => false): string {
  const base = `yamafit_${sanitizeModelNumber(modelNumber)}_${formatDate(date)}`;
  let name = `${base}.mp4`;
  for (let n = 2; exists(name); n++) name = `${base}_${n}.mp4`;
  return name;
}
