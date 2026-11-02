/*
 * The same 20 checks as java/DESTests.java, runnable in the browser
 * (Test Suite page) and in Node: `node js/tests.js`.
 */
(function (root) {
  "use strict";
  const DES = root.DES || (typeof require !== "undefined" ? require("./des.js") : null);

  const TEST_KEY = "0001001100110100010101110111100110011011101111001101111111110001";

  function runTests() {
    const results = [];
    let group = "";
    const check = (label, pass, detail) => results.push({ group, label, pass: !!pass, detail: detail || "" });

    const roundTrip = (text) => {
      const enc = DES.encryptMessage(text, keys);
      const back = DES.decryptMessage(enc.hex, keys);
      return {
        pass: back === text,
        detail: enc.bytes.length + " bytes, " + (enc.padded.length - enc.bytes.length) +
          " padding, " + enc.padded.length / 8 + " block(s) → " + enc.hex
      };
    };
    const rejects = (label, fn) => {
      try { fn(); check(label + " rejected", false, "No error was raised"); }
      catch (e) { check(label + " rejected", e instanceof DES.DESError, e.message); }
    };
    const encRaw = (hex) =>
      DES.bitsToHex(DES.encryptBlock(DES.hexToBits(hex), keys));

    const keys = DES.generateRoundKeys(TEST_KEY);

    group = "Test 1: Standard raw block (no padding)";
    check("K1 and K16 verification",
      keys[0].keyHex === "1B02EFFC7072" && keys[15].keyHex === "CB3D8B0E17F5",
      "K1 = " + keys[0].keyHex + ", K16 = " + keys[15].keyHex);
    check("16 complete round-key records",
      keys.length === 16 && keys.every((k, i) => k.round === i + 1 &&
        k.keyBits.length === 48 && k.keyHex.length === 12), keys.length + " records");
    const cipher = encRaw("0123456789ABCDEF");
    check("Expected ciphertext 85E813540F0AB405", cipher === "85E813540F0AB405", "0123456789ABCDEF → " + cipher);
    const plain = DES.bitsToHex(DES.decryptBlock(DES.hexToBits("85E813540F0AB405"), keys));
    check("Known ciphertext decrypts to raw plaintext", plain === "0123456789ABCDEF", "85E813540F0AB405 → " + plain);

    group = "Test 2: Short text";
    let r = roundTrip("DES Lab 2"); check("Short text", r.pass, r.detail);

    group = "Test 3: Multi-block text";
    r = roundTrip("Wael is testing DES encryption and decryption."); check("Multi-block text", r.pass, r.detail);

    group = "Test 4: Boundary and UTF-8";
    r = roundTrip("12345678"); check("Exactly 8 bytes", r.pass, r.detail);
    check("8-byte message receives 8 padding bytes",
      DES.addPadding(new TextEncoder().encode("12345678")).length === 16, "16 bytes after padding");
    r = roundTrip("مرحبا DES"); check("Non-ASCII text", r.pass, r.detail);
    r = roundTrip(""); check("Empty text", r.pass, r.detail);
    r = roundTrip("  DES Lab 2  "); check("Spaces are preserved", r.pass, r.detail);

    group = "Test 5: Invalid inputs";
    rejects("Short key", () => DES.generateRoundKeys("10101"));
    rejects("64-character non-binary key", () => DES.generateRoundKeys(TEST_KEY.slice(0, 63) + "X"));
    rejects("Non-hex ciphertext", () => DES.decryptMessage("GGGGGGGGGGGGGGGG", keys));
    rejects("Incomplete ciphertext block", () => DES.decryptMessage("0123456789ABCDEF00", keys));
    rejects("Empty ciphertext", () => DES.decryptMessage("", keys));
    rejects("Padding value zero", () => DES.decryptMessage(encRaw("0000000000000000"), keys));
    rejects("Padding value greater than eight", () => DES.decryptMessage(encRaw("0000000000000009"), keys));
    rejects("Mismatched padding bytes", () => DES.decryptMessage(encRaw("4142434445460102"), keys));
    rejects("Invalid UTF-8 after valid padding", () => DES.decryptMessage(encRaw("C007070707070707"), keys));

    return results;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { runTests, TEST_KEY };
    if (require.main === module) {
      const results = runTests();
      let group = "";
      for (const t of results) {
        if (t.group !== group) { group = t.group; console.log("\n" + group); }
        console.log("  " + (t.pass ? "PASS" : "FAIL") + "  " + t.label + "  (" + t.detail + ")");
      }
      const passed = results.filter((t) => t.pass).length;
      console.log("\nCHECKS PASSED: " + passed + " / " + results.length);
      process.exit(passed === results.length ? 0 : 1);
    }
  } else {
    root.DESTests = { runTests, TEST_KEY };
  }
})(typeof window !== "undefined" ? window : globalThis);
