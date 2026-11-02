# DES Visualizer

An interactive, step-by-step look inside the **Data Encryption Standard (DES)**.

DES was the standard symmetric cipher for more than twenty years. Its design ideas still appear in modern ciphers: the Feistel structure, substitution boxes, key schedules and permutations. This project shows each of those steps on real data, with every value computed live in your browser, so you can watch 64 bits being turned into ciphertext.

The algorithm is written twice:

- **JavaScript** powers the website. It records every intermediate value so the page can display it.
- **Java** is a standalone console version of the same algorithm. Both versions give the same results.

Neither version uses a cryptography library. Every table, permutation and round is written out by hand.

---

## Features

| Page | What you can explore |
|---|---|
| **Key Schedule** | How one 64-bit key becomes sixteen 48-bit round keys: PC-1, the C/D halves, the left rotations and PC-2 |
| **Round Explorer** | A 64-bit block going through all 16 rounds. Shows the expansion, key mixing, the eight S-box lookups (the selected row and column are highlighted in the table), the P permutation and the new left/right halves. Works for encryption and decryption |
| **Encrypt & Decrypt** | Any text, Arabic and emoji included, as UTF-8 bytes. Shows the PKCS#7 padding, the 8-byte blocks and the hexadecimal ciphertext. Decryption checks its input and rejects anything malformed |
| **How DES Works** | The whole algorithm on one page, with worked numbers |
| **Why ECB Leaks** | Equal plaintext blocks give equal ciphertext blocks, shown in colour |
| **Test Suite** | 20 automated checks, including the standard DES test vector and invalid-input cases |

You enter the key once in the top bar, as 64 binary digits or 16 hex digits. The sixteen round keys are generated once and shared by every page.

---

## How DES works

### The big picture

DES encrypts one **64-bit block** at a time with a **64-bit key**. Only 56 of the key bits are used; the other 8 are parity bits.

```
plaintext (64)
     │
 Initial Permutation (IP)
     │
 ┌── L0 (32) ── R0 (32) ──┐
 │   16 Feistel rounds    │ ← one 48-bit round key per round
 └── L16 ───── R16 ───────┘
     │
 swap → R16 ‖ L16
     │
 Inverse Initial Permutation (IP⁻¹)
     │
ciphertext (64)
```

### 1. Key schedule

1. **PC-1** drops the 8 parity bits and reorders the other 56.
2. The result is split into two 28-bit halves, **C** and **D**.
3. In every round both halves rotate left: by one position in rounds 1, 2, 9 and 16, and by two positions otherwise.
4. **PC-2** picks 48 of the 56 bits to form that round's key **Kᵢ**.

### 2. Initial permutation

A fixed table reorders the 64 input bits. Output bit *j* is input bit `IP[j]`. The result is split into a left half **L₀** and a right half **R₀**.

### 3. The Feistel round

Each of the 16 rounds does:

```
Lᵢ = Rᵢ₋₁
Rᵢ = Lᵢ₋₁ ⊕ f(Rᵢ₋₁, Kᵢ)
```

The round function **f** has four steps:

| Step | What happens | Bits |
|---|---|---|
| **Expansion (E)** | The right half is expanded, with some bits copied twice | 32 → 48 |
| **Key mixing** | XOR with the round key | 48 |
| **Substitution (S-boxes)** | Eight S-boxes each turn 6 bits into 4 bits | 48 → 32 |
| **Permutation (P)** | The 32 bits are shuffled | 32 |

### 4. Inside an S-box

Each S-box is a 4 × 16 lookup table. From a 6-bit input:

- the **first and last bits** choose the **row** (0–3)
- the **middle four bits** choose the **column** (0–15)

Example: input `011000` gives row `00` = 0 and column `1100` = 12. `S1[0][12] = 5`, so the output is `0101`.

The S-boxes are the only **non-linear** part of DES, which makes them the core of its security. Without them, the whole cipher would be a system of linear equations that anyone could solve.

### 5. Final swap and output

After round 16, the halves are joined in **swapped order** (`R16 ‖ L16`), and the inverse initial permutation produces the ciphertext.

### 6. Why decryption is so simple

You can rearrange the round equations to undo a round:

```
Rᵢ₋₁ = Lᵢ
Lᵢ₋₁ = Rᵢ ⊕ f(Lᵢ, Kᵢ)
```

XOR cancels itself out, so **f never needs to be inverted**. Decryption runs exactly the same rounds with the keys in reverse order (K16 → K1). This is the main advantage of the Feistel design: the round function can be any function, even one that cannot be reversed.

### 7. From text to blocks

DES only processes 8-byte blocks, so text needs some preparation first:

1. **UTF-8 encoding** turns characters into bytes. An Arabic letter takes 2 bytes, an emoji takes 4.
2. **PKCS#7 padding** fills the last block. If *n* bytes are missing, it adds *n* bytes with the value *n*. A message that is already a multiple of 8 still gets a full extra block of `08`, so the receiver can always tell where the padding begins.
3. **ECB mode** encrypts each block on its own.
4. When decrypting, the padding and the UTF-8 encoding are both checked. If either is wrong, the input is rejected instead of returning corrupted text.

---

## Worked example (round 1)

Key `133457799BBCDFF1`, plaintext block `0123456789ABCDEF`:

| Step | Value |
|---|---|
| After IP | `CC00CCFF F0AAF0AA` |
| K1 | `1B02EFFC7072` |
| E(R0) | `7A15557A1555` |
| E(R0) ⊕ K1 | `6117BA866527` |
| S-box output | `5C82B597` |
| f(R0, K1) | `234AA9BB` |
| L1 / R1 | `F0AAF0AA` / `EF4A6544` |
| **Ciphertext after 16 rounds** | **`85E813540F0AB405`** |

The Round Explorer page shows all of these values, and those of the other 15 rounds.

---

## Project structure

```
index.html            The website (single page)
css/style.css         Styles
js/des.js             DES engine with round-by-round tracing
js/tests.js           20 automated checks (browser + Node)
js/app.js             User interface
java/
  DESKeySchedule.java   Key schedule: PC-1, rotations, PC-2
  DESBlock.java         IP, E, S-boxes, P, Feistel rounds, IP⁻¹
  DESMessage.java       UTF-8, PKCS#7, ECB, hex conversion
  DESApp.java           Interactive console menu
  DESTests.java         The same 20 checks in Java
```

The parts are kept separate on purpose. The **key schedule**, the **single-block cipher** and the **message layer** (encoding and padding) each have their own module, and each can be tested on its own.

---

## Running it

**Website:** open `index.html` in any browser. There is no build step and nothing to install.

**JavaScript tests:**

```bash
node js/tests.js
```

**Java version:**

```bash
cd java
javac *.java
java DESTests     # run all checks
java DESApp       # interactive menu
```

Standard test key (binary):
`0001001100110100010101110111100110011011101111001101111111110001`

---

## ⚠️ Security note

This project is for **learning only**.

- DES has a 56-bit key, which is far too short today. A dedicated machine brute-forced a DES key in less than a day back in 1999.
- **ECB mode** shows patterns in the data, because identical blocks always give identical ciphertext. The *Why ECB Leaks* page demonstrates this.

To protect real data, use **AES-GCM** (or another modern authenticated cipher) from a well-tested library.

---

## Further reading

- FIPS 46-3: the official DES specification
- *Cryptography and Network Security*, William Stallings, the chapter on block ciphers and DES
- Search for "Feistel cipher" and "ECB penguin" to read more about the ideas shown here

---

## License

[MIT](LICENSE)
