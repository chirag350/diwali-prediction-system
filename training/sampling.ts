/** Hash time and station: a horizon must not be a direct modulo of clock hour. */
export function sampleHorizon(time: number, station: string): number {
  let hash = Math.floor(time) >>> 0;
  for (let i = 0; i < station.length; i++)
    hash = Math.imul(hash ^ station.charCodeAt(i), 16777619) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
  return 1 + (((hash ^ (hash >>> 16)) >>> 0) % 72);
}
