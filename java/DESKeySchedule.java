import java.util.Scanner;

public class DESKeySchedule {
    private static final int[] PC1 = {
        57,49,41,33,25,17,9, 1,58,50,42,34,26,18,
        10,2,59,51,43,35,27, 19,11,3,60,52,44,36,
        63,55,47,39,31,23,15, 7,62,54,46,38,30,22,
        14,6,61,53,45,37,29, 21,13,5,28,20,12,4
    };
    private static final int[] PC2 = {
        14,17,11,24,1,5, 3,28,15,6,21,10,
        23,19,12,4,26,8, 16,7,27,20,13,2,
        41,52,31,37,47,55, 30,40,51,45,33,48,
        44,49,39,56,34,53, 46,42,50,36,29,32
    };
    private static final int[] SHIFTS = {
        1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1
    };

    static class RoundKey {
        int round;
        String keyBits;
        String keyHex;

        RoundKey(int round, String keyBits) {
            this.round = round;
            this.keyBits = keyBits;
            keyHex = String.format("%012X", Long.parseLong(keyBits, 2));
        }
    }

    static boolean validKey(String key) {
        if (key == null || key.length() != 64) {
            return false;
        }
        for (int i = 0; i < key.length(); i++) {
            if (key.charAt(i) != '0' && key.charAt(i) != '1') {
                return false;
            }
        }
        return true;
    }

    // Used for both PC-1 and PC-2.
    static String permute(String bits, int[] table) {
        String result = "";
        for (int i = 0; i < table.length; i++) {
            // Table positions start at 1, but string indexes start at 0.
            result += bits.charAt(table[i] - 1);
        }
        return result;
    }

    static String leftShift(String bits, int count) {
        return bits.substring(count) + bits.substring(0, count);
    }

    public static RoundKey[] generateRoundKeys(String key) {
        if (!validKey(key)) {
            throw new IllegalArgumentException("Enter exactly 64 bits, using only 0 and 1.");
        }

        String key56 = permute(key, PC1);
        String c = key56.substring(0, 28);
        String d = key56.substring(28);
        RoundKey[] roundKeys = new RoundKey[16];

        for (int i = 0; i < 16; i++) {
            c = leftShift(c, SHIFTS[i]);
            d = leftShift(d, SHIFTS[i]);
            String key48 = permute(c + d, PC2);
            roundKeys[i] = new RoundKey(i + 1, key48);
        }
        return roundKeys;
    }

    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        System.out.println("Enter a 64-bit binary key:");
        if (!input.hasNextLine()) {
            System.out.println("No key entered.");
            return;
        }
        String key = input.nextLine();

        if (!validKey(key)) {
            System.out.println("Invalid key. Enter exactly 64 bits, using only 0 and 1.");
            return;
        }

        String key56 = permute(key, PC1);
        System.out.println("Original key: " + key);
        System.out.println("After PC-1: " + key56);
        System.out.println("C0: " + key56.substring(0, 28));
        System.out.println("D0: " + key56.substring(28));

        RoundKey[] roundKeys = generateRoundKeys(key);
        System.out.println("Records in roundKeys: " + roundKeys.length);
        System.out.println("Round / Binary (48 bits) / Hex (12 digits)");
        for (int i = 0; i < roundKeys.length; i++) {
            System.out.println("K" + roundKeys[i].round + "  "
                + roundKeys[i].keyBits + "  " + roundKeys[i].keyHex);
        }
    }
}
