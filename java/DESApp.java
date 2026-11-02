import java.nio.charset.StandardCharsets;
import java.util.Scanner;

public class DESApp {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        System.out.println("DES Phase 2 - Educational DES/ECB");
        System.out.println("Enter a 64-bit binary key:");
        if (!input.hasNextLine()) {
            return;
        }
        String key = input.nextLine();
        try {
            // Generate the array once, then pass it to every DES operation.
            DESKeySchedule.RoundKey[] roundKeys = DESKeySchedule.generateRoundKeys(key);
            showKeys(key, roundKeys);
            while (true) {
                System.out.println("\n1. Encrypt and recover a text message");
                System.out.println("2. Decrypt ciphertext (hex)");
                System.out.println("3. Raw 64-bit block test");
                System.out.println("4. Run required tests");
                System.out.println("0. Exit");
                if (!input.hasNextLine()) {
                    break;
                }
                String choice = input.nextLine();
                if (choice.equals("0")) {
                    break;
                }
                try {
                    if (choice.equals("1")) {
                        System.out.println("Enter text (Enter alone tests an empty message):");
                        if (!input.hasNextLine()) break;
                        showMessage(input.nextLine(), roundKeys);
                    } else if (choice.equals("2")) {
                        System.out.println("Enter ciphertext as hexadecimal:");
                        if (!input.hasNextLine()) break;
                        String restored = DESMessage.decryptMessage(input.nextLine(), roundKeys);
                        System.out.println("Recovered plaintext: [" + restored + "]");
                    } else if (choice.equals("3")) {
                        System.out.println("Enter exactly 16 hex digits for a raw block (no padding):");
                        if (!input.hasNextLine()) break;
                        String hex = input.nextLine();
                        if (hex.length() != 16) {
                            throw new IllegalArgumentException("A raw block requires 16 hex digits.");
                        }
                        showBlock(hex, roundKeys);
                    } else if (choice.equals("4")) {
                        DESTests.run(roundKeys);
                    } else {
                        System.out.println("Choose 0, 1, 2, 3 or 4.");
                    }
                } catch (IllegalArgumentException ex) {
                    System.out.println("Error: " + ex.getMessage());
                }
            }
        } catch (IllegalArgumentException ex) {
            System.out.println("Error: " + ex.getMessage());
        }
    }

    static void showKeys(String key, DESKeySchedule.RoundKey[] keys) {
        System.out.println("Validated key (binary): " + key);
        System.out.println("Phase 1 roundKeys records: " + keys.length);
        for (int index : new int[] {0, 15}) {
            System.out.println("K" + keys[index].round + " binary: " + keys[index].keyBits);
            System.out.println("K" + keys[index].round + " hex:    " + keys[index].keyHex);
        }
    }

    static boolean showMessage(String text, DESKeySchedule.RoundKey[] keys) {
        int bytes = text.getBytes(StandardCharsets.UTF_8).length;
        int padding = 8 - bytes % 8;
        String cipher = DESMessage.encryptMessage(text, keys);
        String restored = DESMessage.decryptMessage(cipher, keys);
        boolean passed = text.equals(restored);
        System.out.println("Original plaintext: [" + text + "]");
        System.out.println("UTF-8 byte count: " + bytes);
        System.out.println("PKCS#7 padding bytes: " + padding);
        System.out.println("Processed 8-byte blocks: " + (bytes + padding) / 8);
        System.out.println("Ciphertext (hex): " + cipher);
        System.out.println("Recovered plaintext: [" + restored + "]");
        System.out.println("Exact text round trip: " + (passed ? "PASS" : "FAIL"));
        return passed;
    }

    static String showBlock(String hex, DESKeySchedule.RoundKey[] keys) {
        String original = DESMessage.bytesToBits(DESMessage.hexToBytes(hex));
        String cipher = DESBlock.encryptBlock(original, keys);
        String restored = DESBlock.decryptBlock(cipher, keys);
        String cipherHex = DESMessage.bytesToHex(DESMessage.bitsToBytes(cipher));
        System.out.println("Raw plaintext (hex): " + hex.toUpperCase());
        System.out.println("Raw ciphertext (hex): " + cipherHex);
        System.out.println("Recovered raw block: "
            + DESMessage.bytesToHex(DESMessage.bitsToBytes(restored)));
        System.out.println("Raw block round trip: " + (original.equals(restored) ? "PASS" : "FAIL"));
        return cipherHex;
    }
}
