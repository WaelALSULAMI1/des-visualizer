/*
 * DES engine in plain JavaScript.
 * A line-by-line port of the Java sources in /java, plus tracing so the
 * website can show every intermediate value. Bits are kept as "0"/"1"
 * strings on purpose: it is slower than integer math, but each step reads
 * exactly like the textbook tables.
 */
(function (root) {
  "use strict";

  // ---- Key schedule tables (DESKeySchedule.java) ----
  const PC1 = [
    57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18,
    10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36,
    63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22,
    14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4
  ];
  const PC2 = [
    14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10,
    23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2,
    41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48,
    44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32
  ];
  const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

  // ---- Block tables (DESBlock.java) ----
  const IP = [
    58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4,
    62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
    57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3,
    61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7
  ];
  const FP = [
    40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31,
    38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
    36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27,
    34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25
  ];
  const E = [
    32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9,
    8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17,
    16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25,
    24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1
  ];
  const P = [
    16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10,
    2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25
  ];
  const S = [
    [[14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7],
     [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8],
     [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0],
     [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13]],
    [[15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10],
     [3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5],
     [0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15],
     [13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9]],
    [[10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8],
     [13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1],
     [13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7],
     [1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12]],
    [[7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15],
     [13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9],
     [10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4],
     [3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14]],
    [[2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9],
     [14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6],
     [4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14],
     [11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3]],
    [[12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11],
     [10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8],
     [9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6],
     [4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13]],
    [[4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1],
     [13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6],
     [1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2],
     [6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12]],
    [[13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7],
     [1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2],
     [7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8],
     [2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11]]
  ];

  class DESError extends Error {}

  // ---- Bit helpers ----
  function checkBits(bits, length) {
    if (typeof bits !== "string" || bits.length !== length) {
      throw new DESError("Expected " + length + " binary digits.");
    }
    if (!/^[01]*$/.test(bits)) throw new DESError("Bits must contain only 0 and 1.");
  }

  // Table positions start at 1; string indexes start at 0.
  function permute(bits, table) {
    let out = "";
    for (const p of table) out += bits[p - 1];
    return out;
  }

  function xor(a, b) {
    checkBits(a, b.length);
    checkBits(b, a.length);
    let out = "";
    for (let i = 0; i < a.length; i++) out += a[i] === b[i] ? "0" : "1";
    return out;
  }

  function leftShift(bits, n) {
    return bits.slice(n) + bits.slice(0, n);
  }

  function bitsToHex(bits) {
    let out = "";
    for (let i = 0; i < bits.length; i += 4) {
      out += parseInt(bits.slice(i, i + 4), 2).toString(16).toUpperCase();
    }
    return out;
  }

  function hexToBits(hex) {
    let out = "";
    for (const ch of hex) out += parseInt(ch, 16).toString(2).padStart(4, "0");
    return out;
  }

  function bytesToBits(bytes) {
    let out = "";
    for (const b of bytes) out += (b & 0xff).toString(2).padStart(8, "0");
    return out;
  }

  function bitsToBytes(bits) {
    checkBits(bits, bits.length);
    if (bits.length % 8 !== 0) throw new DESError("Binary length must be a multiple of 8.");
    const out = new Uint8Array(bits.length / 8);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
    return out;
  }

  function hexToBytes(hex) {
    if (typeof hex !== "string" || hex.length % 2 !== 0) {
      throw new DESError("Hexadecimal requires pairs of digits.");
    }
    if (!/^[0-9a-fA-F]*$/.test(hex)) throw new DESError("Ciphertext contains a non-hex character.");
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
  }

  function bytesToHex(bytes) {
    let out = "";
    for (const b of bytes) out += (b & 0xff).toString(16).toUpperCase().padStart(2, "0");
    return out;
  }

  // ---- Key schedule ----
  function validKey(key) {
    return typeof key === "string" && key.length === 64 && /^[01]+$/.test(key);
  }

  /** Returns 16 records {round, keyBits, keyHex}, plus the C/D trace. */
  function generateRoundKeys(key) {
    if (!validKey(key)) throw new DESError("Enter exactly 64 bits, using only 0 and 1.");
    const key56 = permute(key, PC1);
    let c = key56.slice(0, 28);
    let d = key56.slice(28);
    const trace = { key, pc1: key56, c0: c, d0: d, rounds: [] };
    const roundKeys = [];
    for (let i = 0; i < 16; i++) {
      c = leftShift(c, SHIFTS[i]);
      d = leftShift(d, SHIFTS[i]);
      const keyBits = permute(c + d, PC2);
      const record = { round: i + 1, keyBits, keyHex: bitsToHex(keyBits) };
      roundKeys.push(record);
      trace.rounds.push({ ...record, shift: SHIFTS[i], c, d });
    }
    roundKeys.trace = trace;
    return roundKeys;
  }

  // ---- Round function f(R, K) ----
  function substitute(bits48, detail) {
    checkBits(bits48, 48);
    let out = "";
    for (let i = 0; i < 8; i++) {
      const group = bits48.slice(i * 6, i * 6 + 6);
      const row = parseInt(group[0] + group[5], 2);
      const col = parseInt(group.slice(1, 5), 2);
      const value = S[i][row][col];
      const bits = value.toString(2).padStart(4, "0");
      if (detail) detail.push({ box: i + 1, input: group, row, col, value, output: bits });
      out += bits;
    }
    return out;
  }

  function roundFunction(r32, k48, detail) {
    checkBits(r32, 32);
    checkBits(k48, 48);
    const expanded = permute(r32, E);
    const mixed = xor(expanded, k48);
    const sboxes = [];
    const sOut = substitute(mixed, sboxes);
    const f = permute(sOut, P);
    if (detail) Object.assign(detail, { expanded, key: k48, mixed, sboxes, sOut, f });
    return f;
  }

  // ---- Block ----
  function processBlock(block64, roundKeys, decrypt, wantTrace) {
    if (!roundKeys || roundKeys.length !== 16) {
      throw new DESError("Exactly 16 round-key records are required.");
    }
    for (const k of roundKeys) {
      if (!k) throw new DESError("A round-key record is missing.");
      checkBits(k.keyBits, 48);
    }
    checkBits(block64, 64);
    const initial = permute(block64, IP);
    let left = initial.slice(0, 32);
    let right = initial.slice(32);
    const trace = wantTrace
      ? { input: block64, ip: initial, l0: left, r0: right, decrypt, rounds: [] }
      : null;
    for (let i = 0; i < 16; i++) {
      // Same rounds both ways; decryption only reverses the key order.
      const keyIndex = decrypt ? 15 - i : i;
      const detail = wantTrace ? {} : null;
      const f = roundFunction(right, roundKeys[keyIndex].keyBits, detail);
      const nextLeft = right;
      const nextRight = xor(left, f);
      if (trace) {
        trace.rounds.push({
          round: i + 1, keyRound: keyIndex + 1,
          lIn: left, rIn: right, ...detail, lOut: nextLeft, rOut: nextRight
        });
      }
      left = nextLeft;
      right = nextRight;
    }
    // Final swap (R16 || L16), then the inverse initial permutation.
    const preoutput = right + left;
    const output = permute(preoutput, FP);
    if (trace) Object.assign(trace, { preoutput, output });
    return wantTrace ? trace : output;
  }

  const encryptBlock = (b, k) => processBlock(b, k, false, false);
  const decryptBlock = (b, k) => processBlock(b, k, true, false);
  const traceBlock = (b, k, decrypt) => processBlock(b, k, !!decrypt, true);

  // ---- Messages: UTF-8 + PKCS#7 + ECB ----
  function addPadding(bytes) {
    const count = 8 - (bytes.length % 8);
    const out = new Uint8Array(bytes.length + count);
    out.set(bytes);
    out.fill(count, bytes.length);
    return out;
  }

  function removePadding(bytes) {
    if (bytes.length === 0 || bytes.length % 8 !== 0) {
      throw new DESError("Invalid padded message length.");
    }
    const count = bytes[bytes.length - 1];
    if (count < 1 || count > 8) throw new DESError("Invalid PKCS#7 padding value.");
    for (let i = bytes.length - count; i < bytes.length; i++) {
      if (bytes[i] !== count) throw new DESError("Invalid PKCS#7 padding bytes.");
    }
    return bytes.slice(0, bytes.length - count);
  }

  // ECB: each 8-byte block is processed independently, with no IV.
  function processBlocks(bytes, keys, decrypt) {
    const out = new Uint8Array(bytes.length);
    for (let start = 0; start < bytes.length; start += 8) {
      const bits = bytesToBits(bytes.slice(start, start + 8));
      const result = decrypt ? decryptBlock(bits, keys) : encryptBlock(bits, keys);
      out.set(bitsToBytes(result), start);
    }
    return out;
  }

  function encryptMessage(message, keys) {
    const bytes = new TextEncoder().encode(message);
    const padded = addPadding(bytes);
    const cipher = processBlocks(padded, keys, false);
    return { bytes, padded, cipher, hex: bytesToHex(cipher) };
  }

  function decryptMessage(hex, keys) {
    if (typeof hex !== "string" || hex.length === 0 || hex.length % 16 !== 0) {
      throw new DESError("Ciphertext must have a positive multiple of 16 hex digits.");
    }
    const encrypted = hexToBytes(hex);
    const padded = processBlocks(encrypted, keys, true);
    const original = removePadding(padded);
    try {
      // fatal: reject malformed UTF-8 instead of silently replacing bytes.
      return new TextDecoder("utf-8", { fatal: true }).decode(original);
    } catch (e) {
      throw new DESError("Decrypted bytes are not valid UTF-8.");
    }
  }

  const DES = {
    TABLES: { PC1, PC2, SHIFTS, IP, FP, E, P, S },
    DESError, checkBits, permute, xor, validKey,
    bitsToHex, hexToBits, bytesToBits, bitsToBytes, hexToBytes, bytesToHex,
    generateRoundKeys, roundFunction, encryptBlock, decryptBlock, traceBlock,
    addPadding, removePadding, encryptMessage, decryptMessage
  };

  if (typeof module !== "undefined" && module.exports) module.exports = DES;
  else root.DES = DES;
})(typeof window !== "undefined" ? window : globalThis);
