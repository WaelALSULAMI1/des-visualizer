public class DESTests {
    private static int passed;
    private static int total;

    public static void main(String[] args) {
        String key = "0001001100110100010101110111100110011011101111001101111111110001";
        DESKeySchedule.RoundKey[] keys = DESKeySchedule.generateRoundKeys(key);
        DESApp.showKeys(key, keys);
        run(keys);
    }

    static void check(String label, boolean condition) {
        total++;
        if (condition) passed++;
        System.out.println(label + ": " + (condition ? "PASS" : "FAIL"));
    }

    static void run(DESKeySchedule.RoundKey[] keys) {
        passed = 0;
        total = 0;
        System.out.println("\nTEST 1 - Standard raw block (no padding)");
        boolean standardKey = keys[0].keyHex.equals("1B02EFFC7072")
            && keys[15].keyHex.equals("CB3D8B0E17F5");
        if (!standardKey) {
            System.out.println("Use the supplied binary test key for these tests.");
            return;
        }
        check("K1 and K16 verification", standardKey);
        boolean recordsOK = keys.length == 16;
        for (int i = 0; i < keys.length; i++) {
            recordsOK = recordsOK && keys[i].round == i + 1
                && keys[i].keyBits.length() == 48 && keys[i].keyHex.length() == 12;
        }
        check("16 complete round-key records", recordsOK);
        String block = DESMessage.bytesToBits(DESMessage.hexToBytes("0123456789ABCDEF"));
        String cipher = DESApp.showBlock("0123456789ABCDEF", keys);
        check("Expected ciphertext 85E813540F0AB405", cipher.equals("85E813540F0AB405"));
        String decrypted = DESBlock.decryptBlock(
            DESMessage.bytesToBits(DESMessage.hexToBytes("85E813540F0AB405")), keys);
        check("Known ciphertext decrypts to raw plaintext", decrypted.equals(block));

        System.out.println("\nTEST 2 - Short text");
        check("Short text", DESApp.showMessage("DES Lab 2", keys));
        System.out.println("\nTEST 3 - Multi-block text");
        check("Multi-block text", DESApp.showMessage("Wael is testing DES encryption and decryption.", keys));
        System.out.println("\nTEST 4 - Boundary and UTF-8");
        check("Exactly 8 bytes", DESApp.showMessage("12345678", keys));
        check("8-byte message receives 8 padding bytes",
            DESMessage.addPadding("12345678".getBytes(java.nio.charset.StandardCharsets.UTF_8)).length == 16);
        check("Non-ASCII text", DESApp.showMessage("\u0645\u0631\u062d\u0628\u0627 DES", keys));
        check("Empty text", DESApp.showMessage("", keys));
        check("Spaces are preserved", DESApp.showMessage("  DES Lab 2  ", keys));

        System.out.println("\nTEST 5 - Invalid inputs");
        rejectKey("10101", "Short key");
        rejectKey("000100110011010001010111011110011001101110111100110111111111000X", "64-character non-binary key");
        rejectCipher("GGGGGGGGGGGGGGGG", keys, "Non-hex ciphertext");
        rejectCipher("0123456789ABCDEF00", keys, "Incomplete ciphertext block");
        rejectCipher("", keys, "Empty ciphertext");
        // Encrypt intentionally malformed padded bytes, then test the public decrypt method.
        rejectCipher(encryptRawHex("0000000000000000", keys), keys, "Padding value zero");
        rejectCipher(encryptRawHex("0000000000000009", keys), keys, "Padding value greater than eight");
        rejectCipher(encryptRawHex("4142434445460102", keys), keys, "Mismatched padding bytes");
        rejectCipher(encryptRawHex("C007070707070707", keys), keys, "Invalid UTF-8 after valid padding");
        System.out.println("\nCHECKS PASSED: " + passed + " / " + total);
        System.out.println("OVERALL: " + (passed == total ? "PASS" : "FAIL"));
    }

    private static String encryptRawHex(String hex, DESKeySchedule.RoundKey[] keys) {
        String block = DESMessage.bytesToBits(DESMessage.hexToBytes(hex));
        return DESMessage.bytesToHex(DESMessage.bitsToBytes(DESBlock.encryptBlock(block, keys)));
    }

    private static void rejectKey(String key, String label) {
        try {
            DESKeySchedule.generateRoundKeys(key);
            check(label + " rejected", false);
        } catch (IllegalArgumentException ex) {
            check(label + " rejected", true);
            System.out.println("  " + ex.getMessage());
        }
    }

    private static void rejectCipher(String hex, DESKeySchedule.RoundKey[] keys, String label) {
        try {
            DESMessage.decryptMessage(hex, keys);
            check(label + " rejected", false);
        } catch (IllegalArgumentException ex) {
            check(label + " rejected", true);
            System.out.println("  " + ex.getMessage());
        }
    }
}
