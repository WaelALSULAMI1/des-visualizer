/* DES Visualizer UI. All crypto lives in des.js; this file only renders. */
(function () {
  "use strict";

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hex = (bits) => DES.bitsToHex(bits);
  const group = (bits, n) => bits.match(new RegExp(".{1," + n + "}", "g")).map((g) => `<span class="g">${g}</span>`).join("");

  const TEST_KEY = DESTests.TEST_KEY;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };

  const state = {
    roundKeys: null,
    route: "overview",
    dir: "enc",
    round: 1,
    sbox: 0
  };

  // ================= Key handling =================
  // Accept 64 binary digits (as in the Java app) or 16 hex digits for convenience.
  function parseKey(raw) {
    const v = raw.replace(/\s+/g, "");
    if (/^[01]{64}$/.test(v)) return v;
    if (/^[0-9a-fA-F]{16}$/.test(v)) return DES.hexToBits(v);
    return null;
  }

  function setKey(raw) {
    const status = $("#keyStatus");
    const bits = parseKey(raw);
    if (bits) {
      // Generate the 16 round keys once and share them with every tool.
      state.roundKeys = DES.generateRoundKeys(bits);
      status.textContent = "✓ " + hex(bits);
      status.className = "key-status ok";
      store.set("des-key", raw.trim());
    } else {
      state.roundKeys = null;
      const len = raw.replace(/\s+/g, "").length;
      status.textContent = len ? "✗ " + len + " chars" : "";
      status.className = "key-status bad";
    }
    renderCurrent();
  }

  function loadTestKey() {
    $("#keyInput").value = TEST_KEY;
    setKey(TEST_KEY);
    toast("Test key loaded");
  }

  // ================= Router =================
  const renderers = {};

  function route() {
    const name = (location.hash || "#overview").slice(1);
    state.route = renderers[name] ? name : "overview";
    $$(".page").forEach((p) => (p.hidden = p.dataset.page !== state.route));
    $$(".sidebar a[data-route]").forEach((a) => {
      const on = a.dataset.route === state.route;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    document.body.classList.remove("nav-open");
    $("#menuToggle").setAttribute("aria-expanded", "false");
    window.scrollTo(0, 0);
    renderCurrent();
  }

  function renderCurrent() {
    const page = $(`.page[data-page="${state.route}"]`);
    const needsKey = page && page.querySelector("[data-needs-key]");
    const missing = needsKey && !state.roundKeys;
    $("#keyMissing").hidden = !missing;
    if (needsKey) needsKey.hidden = missing;
    if (missing) {
      page.after($("#keyMissing"));
      return;
    }
    renderers[state.route]();
  }

  // ================= Overview =================
  let cascadeTimer = null;
  renderers.overview = function () {
    const box = $("#cascade");
    const keys = state.roundKeys || DES.generateRoundKeys(TEST_KEY);
    const draw = (blockHex) => {
      const t = DES.traceBlock(DES.hexToBits(blockHex), keys, false);
      const rows = [
        ["input", t.input], ["IP", t.ip], ["round 4", t.rounds[3].lOut + t.rounds[3].rOut],
        ["round 8", t.rounds[7].lOut + t.rounds[7].rOut], ["round 12", t.rounds[11].lOut + t.rounds[11].rOut],
        ["round 16", t.rounds[15].lOut + t.rounds[15].rOut], ["output", t.output]
      ];
      box.innerHTML = rows.map(([tag, bits]) =>
        `<div class="c-row"><span class="c-tag">${tag}</span><span class="c-bits">${
          [...bits].map((b) => `<span class="${b === "1" ? "on" : "off"}">${b}</span>`).join("")
        }</span><span class="c-hex">${hex(bits)}</span></div>`).join("");
    };
    const random = () => [...crypto.getRandomValues(new Uint8Array(8))]
      .map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    draw("0123456789ABCDEF");
    clearInterval(cascadeTimer);
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cascadeTimer = setInterval(() => {
        if (state.route !== "overview") return clearInterval(cascadeTimer);
        draw(random());
      }, 2600);
    }
  };

  // ================= Key schedule =================
  renderers.keys = function () {
    const t = state.roundKeys.trace;
    const keyBits = [...t.key].map((b, i) => (i % 8 === 7 ? `<span class="parity" title="parity bit ${i + 1}">${b}</span>` : b)).join("");
    $("#keyIntro").innerHTML = `
      <span class="kv-k">64-bit key</span><span class="kv-v bits">${keyBits}</span><span class="kv-h">${hex(t.key)}</span>
      <span class="kv-k">After PC-1 (56)</span><span class="kv-v">${group(t.pc1, 7)}</span><span class="kv-h">${hex(t.pc1)}</span>
      <span class="kv-k">C<sub>0</sub> (28)</span><span class="kv-v">${group(t.c0, 7)}</span><span class="kv-h">${hex(t.c0)}</span>
      <span class="kv-k">D<sub>0</sub> (28)</span><span class="kv-v">${group(t.d0, 7)}</span><span class="kv-h">${hex(t.d0)}</span>`;
    $("#keyTable tbody").innerHTML = t.rounds.map((r) => `
      <tr><td class="k-round">K${r.round}</td>
      <td><span class="shift-pill ${r.shift === 2 ? "two" : ""}">${r.shift}</span></td>
      <td>${r.c}</td><td>${r.d}</td>
      <td>${group(r.keyBits, 6)}</td><td class="k-hex">${r.keyHex}</td></tr>`).join("");
  };

  // ================= Round explorer =================
  let lastTrace = null;
  renderers.rounds = function () {
    const raw = $("#blockInput").value.trim();
    const err = $("#blockError");
    if (!/^[0-9a-fA-F]{16}$/.test(raw)) {
      err.textContent = "A raw block needs exactly 16 hex digits (0-9, A-F).";
      return;
    }
    err.textContent = "";
    lastTrace = DES.traceBlock(DES.hexToBits(raw), state.roundKeys, state.dir === "dec");
    const t = lastTrace;
    $("#flowSummary").innerHTML = `
      <div><span>Input</span><strong>${hex(t.input)}</strong></div>
      <div><span>After IP (L₀ | R₀)</span><strong>${hex(t.l0)} ${hex(t.r0)}</strong></div>
      <div><span>Swap R₁₆ | L₁₆</span><strong>${hex(t.preoutput.slice(0, 32))} ${hex(t.preoutput.slice(32))}</strong></div>
      <div><span>Output (IP⁻¹)</span><strong>${hex(t.output)}</strong></div>`;
    $("#roundStrip").innerHTML = t.rounds.map((r) => `<button type="button" data-r="${r.round}">${r.round}</button>`).join("");
    renderRound();
  };

  function renderRound() {
    const t = lastTrace;
    if (!t) return;
    const r = t.rounds[state.round - 1];
    $("#roundSlider").value = state.round;
    $("#roundLabel").textContent = `Round ${r.round} · uses K${r.keyRound}`;
    $$("#roundStrip button").forEach((b) => {
      const n = +b.dataset.r;
      b.className = n === state.round ? "cur" : n < state.round ? "done" : "";
    });
    const i = r.round;
    const row = (name, bits, n, cls = "") =>
      `<div class="trace-row ${cls}"><span class="t-name">${name}</span><span class="t-bits">${group(bits, n)}</span><span class="t-hex">${hex(bits)}</span></div>`;

    const sel = state.sbox;
    const sb = r.sboxes[sel];
    const table = DES.TABLES.S[sel];
    const sTable = `<table class="sbox-table"><thead><tr><th></th>${
      table[0].map((_, c) => `<th class="${c === sb.col ? "hl-col" : ""}">${c}</th>`).join("")}</tr></thead><tbody>${
      table.map((rowVals, ri) => `<tr><th class="${ri === sb.row ? "hl-row" : ""}">${ri}</th>${
        rowVals.map((v, ci) => {
          const cls = ri === sb.row && ci === sb.col ? "hit" : ri === sb.row ? "hl-row" : ci === sb.col ? "hl-col" : "";
          return `<td class="${cls}">${v}</td>`;
        }).join("")}</tr>`).join("")}</tbody></table>`;

    $("#roundDetail").innerHTML = `
      <div class="trace">
        ${row(`<b>L${sub(i - 1)}</b> left half in`, r.lIn, 4)}
        ${row(`<b>R${sub(i - 1)}</b> right half in`, r.rIn, 4)}
        ${row(`<b>E(R${sub(i - 1)})</b> expand 32→48`, r.expanded, 6)}
        ${row(`<b>K${sub(r.keyRound)}</b> round key`, r.key, 6, "key")}
        ${row(`<b>E ⊕ K</b> key mixing`, r.mixed, 6)}
        ${row(`<b>S-boxes</b> 48→32`, r.sOut, 4)}
        ${row(`<b>P</b> = f(R, K)`, r.f, 4)}
        ${row(`<b>L${sub(i)}</b> = R${sub(i - 1)}`, r.lOut, 4, "res")}
        ${row(`<b>R${sub(i)}</b> = L${sub(i - 1)} ⊕ f`, r.rOut, 4, "res")}
      </div>
      <p class="sec-title">S-box lookups (click one)</p>
      <div class="sbox-grid">${r.sboxes.map((s, k) => `
        <button type="button" class="sbox ${k === sel ? "sel" : ""}" data-s="${k}">
          <span class="s-name"><span>S${s.box}</span><span class="s-out">${s.value} → ${s.output}</span></span>
          <div class="s-in"><span class="outer">${s.input[0]}</span><span class="mid">${s.input.slice(1, 5)}</span><span class="outer">${s.input[5]}</span></div>
          <div class="s-meta">row ${s.row} · col ${s.col}</div>
        </button>`).join("")}
      </div>
      <p class="sbox-caption">S${sb.box}: input <b>${sb.input}</b>. The outer bits <b>${sb.input[0]}${sb.input[5]}</b> give row <b>${sb.row}</b>, the middle bits <b>${sb.input.slice(1, 5)}</b> give column <b>${sb.col}</b>, and S${sb.box}[${sb.row}][${sb.col}] = <b>${sb.value}</b> = <b>${sb.output}</b>.</p>
      <div class="sbox-table-wrap">${sTable}</div>`;
  }

  const SUBS = "₀₁₂₃₄₅₆₇₈₉";
  function sub(n) { return String(n).replace(/\d/g, (d) => SUBS[d]); }

  // ================= Text =================
  renderers.text = function () {
    const text = $("#plainInput").value;
    const enc = DES.encryptMessage(text, state.roundKeys);
    const pad = enc.padded.length - enc.bytes.length;
    $("#encStats").innerHTML = `
      <div><strong>${enc.bytes.length}</strong><span>UTF-8 bytes</span></div>
      <div><strong>${pad}</strong><span>padding bytes</span></div>
      <div><strong>${enc.padded.length / 8}</strong><span>blocks</span></div>`;
    let grid = "";
    for (let b = 0; b < enc.padded.length; b += 8) {
      grid += `<div class="byte-block"><span class="blk-label">#${b / 8 + 1}</span>`;
      for (let i = b; i < b + 8; i++) {
        const v = enc.padded[i].toString(16).toUpperCase().padStart(2, "0");
        grid += `<span class="byte ${i >= enc.bytes.length ? "pad" : ""}">${v}</span>`;
      }
      grid += "</div>";
    }
    $("#byteGrid").innerHTML = grid;
    $("#cipherOut").innerHTML = enc.hex.match(/.{16}/g).map((h) => `<span class="blk">${h}</span>`).join("");
    $("#cipherOut").dataset.hex = enc.hex;
  };

  function decryptNow() {
    const out = $("#decryptResult");
    if (!state.roundKeys) return;
    const raw = $("#cipherInput").value.replace(/\s+/g, "");
    try {
      const plain = DES.decryptMessage(raw, state.roundKeys);
      out.innerHTML = `<div class="ok-box"><span class="tag">Recovered plaintext</span><div class="plain" dir="auto">[${esc(plain)}]</div></div>`;
    } catch (e) {
      if (!(e instanceof DES.DESError)) throw e;
      out.innerHTML = `<div class="err-box"><span class="tag">Rejected</span>${esc(e.message)}</div>`;
    }
  }

  // ================= Learn (computed with the test key) =================
  renderers.learn = function () {
    const keys = DES.generateRoundKeys(TEST_KEY);
    const t = DES.traceBlock(DES.hexToBits("0123456789ABCDEF"), keys, false);
    const r1 = t.rounds[0];
    const s1 = r1.sboxes[0];
    const steps = [
      ["Key schedule", "PC-1 removes the 8 parity bits (56 left) and splits them into C₀ and D₀. Each round rotates both halves left (by 1 in rounds 1, 2, 9 and 16, otherwise by 2), and PC-2 selects 48 bits as Kᵢ.",
        `K1 = <b>${keys[0].keyHex}</b>   K16 = <b>${keys[15].keyHex}</b>`],
      ["Initial permutation (IP)", "The 64 input bits are reordered by a fixed table. Output bit j is input bit IP[j], so the first output bits come from input positions 58, 50, 42, 34, … The result splits into L₀ and R₀.",
        `0123456789ABCDEF → IP → <b>${hex(t.ip)}</b><br>L0 = ${hex(t.l0)}   R0 = ${hex(t.r0)}`],
      ["Expansion (E)", "The round function starts by expanding the 32-bit right half to 48 bits. Some bits are copied twice, so the result lines up with the 48-bit round key.",
        `E(R0) = <b>${hex(r1.expanded)}</b>`],
      ["Key mixing", "The expanded half is XORed with the round key. This is the only step where the key enters the round.",
        `${hex(r1.expanded)} ⊕ ${keys[0].keyHex} = <b>${hex(r1.mixed)}</b>`],
      ["Substitution (S-boxes)", "The 48 bits are cut into eight 6-bit groups. Each S-box uses the outer two bits as a row and the middle four as a column, and outputs a 4-bit number. The S-boxes are the only non-linear part of DES.",
        `S1 input ${s1.input}: row ${s1.input[0]}${s1.input[5]} = ${s1.row}, col ${s1.input.slice(1, 5)} = ${s1.col} → <b>${s1.value} (${s1.output})</b><br>All eight S-boxes → <b>${hex(r1.sOut)}</b>`],
      ["Permutation (P) and the round equations", "P shuffles the 32 S-box bits to give f(R, K). The new right half is L XOR f, and the old right half becomes the new left half.",
        `f(R0, K1) = <b>${hex(r1.f)}</b><br>L1 = R0 = ${hex(r1.lOut)}   R1 = L0 ⊕ f = <b>${hex(r1.rOut)}</b>`],
      ["Sixteen rounds, swap, IP⁻¹", "After 16 rounds the halves are swapped (R₁₆ ‖ L₁₆), and the inverse initial permutation gives the ciphertext.",
        `Ciphertext = <b>${hex(t.output)}</b>`],
      ["Decryption", "From Lᵢ = Rᵢ₋₁ and Rᵢ = Lᵢ₋₁ ⊕ f(Rᵢ₋₁, Kᵢ) it follows that Rᵢ₋₁ = Lᵢ and Lᵢ₋₁ = Rᵢ ⊕ f(Lᵢ, Kᵢ). So decryption runs the same rounds with K16…K1, and f never has to be inverted.",
        `${hex(t.output)} → (K16 … K1) → <b>0123456789ABCDEF</b>`],
      ["From text to blocks", "Text is encoded as UTF-8 bytes. PKCS#7 appends n bytes with value n so the length becomes a multiple of 8, and an exact multiple gets a full block of 08. Each block is then encrypted separately (ECB). When decrypting, the padding and UTF-8 are checked before the text is returned.",
        `"DES Lab 2" = 9 bytes + <b>7 × 07</b> = 2 blocks   "12345678" = 8 bytes + <b>8 × 08</b> = 2 blocks`]
    ];
    $("#learnSteps").innerHTML = steps.map(([h, p, ex]) =>
      `<li><h3>${h}</h3><p>${p}</p><div class="example">${ex}</div></li>`).join("");
  };

  // ================= ECB =================
  const ECB_COLORS = ["#38d9c0", "#f5b84a", "#a48bff", "#ff7a6b", "#5fb2ff", "#7ee081", "#ff9ed2", "#d4c35a"];
  renderers.ecb = function () {
    const text = $("#ecbInput").value;
    const enc = DES.encryptMessage(text, state.roundKeys);
    const colors = new Map();
    let html = "";
    for (let b = 0; b < enc.padded.length; b += 8) {
      const ct = enc.hex.slice(b * 2, b * 2 + 16);
      if (!colors.has(ct)) colors.set(ct, ECB_COLORS[colors.size % ECB_COLORS.length]);
      const c = colors.get(ct);
      const chunk = enc.padded.slice(b, b + 8);
      const pt = [...chunk].map((x) => (x >= 32 && x < 127 ? String.fromCharCode(x) : "·")).join("");
      html += `<div class="ecb-cell" style="border-color:${c};background:${c}1f"><span class="pt">${esc(pt)}</span><span class="ct" style="color:${c}">${ct}</span></div>`;
    }
    $("#ecbView").innerHTML = html;
    const blocks = enc.padded.length / 8;
    $("#ecbSummary").textContent = `${blocks} block${blocks > 1 ? "s" : ""}, ${colors.size} distinct ciphertext block${colors.size > 1 ? "s" : ""}. ` +
      (colors.size < blocks ? "Repeated colours show where the plaintext repeats, even though nothing was decrypted." : "No repeated blocks in this input.");
  };

  // ================= Tests =================
  renderers.tests = function () { /* runs on demand */ };
  function runTests() {
    const results = DESTests.runTests();
    const passed = results.filter((r) => r.pass).length;
    const score = $("#testScore");
    score.textContent = `CHECKS PASSED: ${passed} / ${results.length}`;
    score.className = "test-score " + (passed === results.length ? "ok" : "bad");
    const groups = {};
    results.forEach((r) => (groups[r.group] = groups[r.group] || []).push(r));
    $("#testResults").innerHTML = Object.entries(groups).map(([g, items]) =>
      `<div class="test-group"><h4>${esc(g)}</h4>${items.map((r) => `
        <div class="test-item"><span class="badge ${r.pass ? "pass" : "fail"}">${r.pass ? "PASS" : "FAIL"}</span>
        <span>${esc(r.label)}<span class="t-detail">${esc(r.detail)}</span></span></div>`).join("")}</div>`).join("");
  }

  // ================= Toast =================
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  // ================= Wiring =================
  function init() {
    const keyInput = $("#keyInput");
    keyInput.value = store.get("des-key") || TEST_KEY;
    keyInput.addEventListener("input", () => setKey(keyInput.value));
    $("#keyForm").addEventListener("submit", (e) => e.preventDefault());
    $("#useTestKey").addEventListener("click", loadTestKey);
    $("#useTestKey2").addEventListener("click", loadTestKey);

    $("#menuToggle").addEventListener("click", () => {
      const open = document.body.classList.toggle("nav-open");
      $("#menuToggle").setAttribute("aria-expanded", String(open));
    });
    $("#scrim").addEventListener("click", () => document.body.classList.remove("nav-open"));

    // Round explorer
    $("#blockInput").addEventListener("input", () => renderers.rounds());
    $$(".segmented button").forEach((b) => b.addEventListener("click", () => {
      state.dir = b.dataset.dir;
      $$(".segmented button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      renderers.rounds();
    }));
    const go = (n) => { state.round = Math.min(16, Math.max(1, n)); renderRound(); };
    $("#roundSlider").addEventListener("input", (e) => go(+e.target.value));
    $("#prevRound").addEventListener("click", () => go(state.round - 1));
    $("#nextRound").addEventListener("click", () => go(state.round + 1));
    $("#roundStrip").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) go(+b.dataset.r); });
    $("#roundDetail").addEventListener("click", (e) => {
      const b = e.target.closest(".sbox");
      if (b) { state.sbox = +b.dataset.s; renderRound(); }
    });
    document.addEventListener("keydown", (e) => {
      if (state.route !== "rounds" || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (e.key === "ArrowRight") go(state.round + 1);
      if (e.key === "ArrowLeft") go(state.round - 1);
    });

    // Text
    $("#plainInput").addEventListener("input", () => renderers.text());
    $("#sampleChips").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-sample]");
      if (!b) return;
      $("#plainInput").value = b.dataset.sample;
      renderers.text();
    });
    $("#copyCipher").addEventListener("click", () => {
      const h = $("#cipherOut").dataset.hex;
      (navigator.clipboard ? navigator.clipboard.writeText(h) : Promise.reject())
        .then(() => toast("Ciphertext copied"), () => toast("Copy failed. Select the text instead"));
    });
    $("#sendToDecrypt").addEventListener("click", () => {
      $("#cipherInput").value = $("#cipherOut").dataset.hex;
      decryptNow();
    });
    $("#decryptBtn").addEventListener("click", decryptNow);

    $("#ecbInput").addEventListener("input", () => renderers.ecb());
    $("#runTests").addEventListener("click", runTests);

    // Point "View source" at the repo automatically when hosted on GitHub Pages.
    const gh = $(".gh-link");
    const m = location.hostname.match(/^([^.]+)\.github\.io$/);
    if (m) {
      const repo = location.pathname.split("/").filter(Boolean)[0];
      gh.href = "https://github.com/" + m[1] + (repo && !repo.endsWith(".html") ? "/" + repo : "");
    } else {
      gh.hidden = true;
    }

    window.addEventListener("hashchange", route);
    setKey(keyInput.value);
    route();
  }

  init();
})();
