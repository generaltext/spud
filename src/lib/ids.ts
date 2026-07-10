// Crockford base32 ULID-ish ids: a 48-bit time prefix + 80 bits of randomness,
// so ids sort by creation time (handy as an ordering tiebreak) and collide with
// vanishing probability. Prefixed by kind so the log is self-describing:
// `spd_01J...`, `cmt_01J...`, `evt_01J...`.

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford, no I L O U
const TIME_LEN = 10
const RAND_LEN = 16

function encodeTime(now: number): string {
  let out = ''
  let t = now
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    const mod = t % 32
    out = ENCODING[mod] + out
    t = (t - mod) / 32
  }
  return out
}

function encodeRandom(): string {
  const bytes = new Uint8Array(RAND_LEN)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < RAND_LEN; i++) out += ENCODING[bytes[i]! % 32]
  return out
}

export function ulid(): string {
  return encodeTime(Date.now()) + encodeRandom()
}

export function newId(prefix: string): string {
  return `${prefix}_${ulid()}`
}
