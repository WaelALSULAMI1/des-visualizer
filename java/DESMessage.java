import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

public class DESMessage {
    public static String encryptMessage(String message, DESKeySchedule.RoundKey[] roundKeys) {
        byte[] bytes = message.getBytes(StandardCharsets.UTF_8);
        byte[] padded = addPadding(bytes);
        byte[] encrypted = processBlocks(padded, roundKeys, false);
        return bytesToHex(encrypted);
    }

    public static String decryptMessage(String hex, DESKeySchedule.RoundKey[] roundKeys) {
        if (hex == null || hex.length() == 0 || hex.length() % 16 != 0) {
            throw new IllegalArgumentException("Ciphertext must have a positive multiple of 16 hex digits.");
        }
        byte[] encrypted = hexToBytes(hex);
        byte[] padded = processBlocks(encrypted, roundKeys, true);
        byte[] original = removePadding(padded);
        try {
            // Reject malformed UTF-8 instead of silently replacing bytes.
            return StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(original)).toString();
        } catch (CharacterCodingException ex) {
            throw new IllegalArgumentException("Decrypted bytes are not valid UTF-8.");
        }
    }

    // ECB: each eight-byte block is processed independently, without an IV.
    private static byte[] processBlocks(byte[] bytes, DESKeySchedule.RoundKey[] keys,
                                        boolean decrypt) {
        byte[] result = new byte[bytes.length];
        for (int start = 0; start < bytes.length; start += 8) {
            byte[] block = Arrays.copyOfRange(bytes, start, start + 8);
            String bits = bytesToBits(block);
            String output = decrypt ? DESBlock.decryptBlock(bits, keys)
                                    : DESBlock.encryptBlock(bits, keys);
            byte[] processed = bitsToBytes(output);
            System.arraycopy(processed, 0, result, start, 8);
        }
        return result;
    }

    static byte[] addPadding(byte[] bytes) {
        int count = 8 - bytes.length % 8;
        byte[] padded = Arrays.copyOf(bytes, bytes.length + count);
        for (int i = bytes.length; i < padded.length; i++) {
            padded[i] = (byte) count;
        }
        return padded;
    }

    static byte[] removePadding(byte[] bytes) {
        if (bytes.length == 0 || bytes.length % 8 != 0) {
            throw new IllegalArgumentException("Invalid padded message length.");
        }
        int count = bytes[bytes.length - 1] & 0xFF;
        if (count < 1 || count > 8) {
            throw new IllegalArgumentException("Invalid PKCS#7 padding value.");
        }
        for (int i = bytes.length - count; i < bytes.length; i++) {
            if ((bytes[i] & 0xFF) != count) {
                throw new IllegalArgumentException("Invalid PKCS#7 padding bytes.");
            }
        }
        return Arrays.copyOf(bytes, bytes.length - count);
    }

    static String bytesToBits(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte value : bytes) {
            String bits = Integer.toBinaryString(value & 0xFF);
            for (int i = bits.length(); i < 8; i++) {
                result.append('0');
            }
            result.append(bits);
        }
        return result.toString();
    }

    static byte[] bitsToBytes(String bits) {
        DESBlock.checkBits(bits, bits.length());
        if (bits.length() % 8 != 0) {
            throw new IllegalArgumentException("Binary length must be a multiple of 8.");
        }
        byte[] result = new byte[bits.length() / 8];
        for (int i = 0; i < result.length; i++) {
            result[i] = (byte) Integer.parseInt(bits.substring(i * 8, i * 8 + 8), 2);
        }
        return result;
    }

    static byte[] hexToBytes(String hex) {
        if (hex == null || hex.length() % 2 != 0) {
            throw new IllegalArgumentException("Hexadecimal requires pairs of digits.");
        }
        byte[] result = new byte[hex.length() / 2];
        String digits = "0123456789abcdefABCDEF";
        for (int i = 0; i < hex.length(); i++) {
            if (digits.indexOf(hex.charAt(i)) < 0) {
                throw new IllegalArgumentException("Ciphertext contains a non-hex character.");
            }
        }
        for (int i = 0; i < result.length; i++) {
            result[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        return result;
    }

    static String bytesToHex(byte[] bytes) {
        StringBuilder hex = new StringBuilder();
        for (byte value : bytes) {
            hex.append(String.format("%02X", value & 0xFF));
        }
        return hex.toString();
    }
}
