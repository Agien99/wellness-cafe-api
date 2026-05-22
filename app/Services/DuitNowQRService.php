<?php

namespace App\Services;

use App\Models\Order;

/**
 * DuitNowQRService
 * ----------------
 * Generates an EMV-format DuitNow QR payload string for a single Order.
 *
 * The payload follows the EMVCo "QR Code Specification for Payment Systems"
 * with PayNet's DuitNow QR profile. The string is a series of Tag-Length-Value
 * (TLV) fields ending with a CRC-16/CCITT-FALSE checksum.
 *
 * The output of {@see payloadFor()} is the plain text that should be encoded
 * into a QR image (we do this client-side with a JS library so the backend
 * stays dependency-free).
 *
 * Example:
 *   $payload = app(DuitNowQRService::class)->payloadFor($order);
 *   // → "00020101021226...58025959165804580025..."
 */
class DuitNowQRService
{
    /**
     * Build the EMV TLV payload for a given Order.
     */
    public function payloadFor(Order $order): string
    {
        $merchantId   = (string) config('duitnow.merchant_id');
        $merchantName = (string) config('duitnow.merchant_name', 'Wellness Cafe');
        $merchantCity = (string) config('duitnow.merchant_city', 'Tanjong Malim');
        $guid         = (string) config('duitnow.guid', 'DUITNOW');
        $mcc          = (string) config('duitnow.mcc', '5812');

        $amount    = number_format((float) $order->total, 2, '.', '');
        $reference = $order->order_no;

        // Tag 26 — Merchant Account Information (DuitNow). Nested TLV.
        $merchantAccountInfo = $this->tlv('00', $guid)
                             . $this->tlv('01', $merchantId);

        // Tag 62 — Additional Data Field Template. Nested TLV.
        // Sub-tag 01 = Bill Number (we use the order_no so the cashier can
        // tie a bank-app notification back to the right order).
        $additionalData = $this->tlv('01', $reference);

        $payload = $this->tlv('00', '01')                                    // Payload Format Indicator
                 . $this->tlv('01', '12')                                    // Point of Initiation = Dynamic
                 . $this->tlv('26', $merchantAccountInfo)                    // DuitNow merchant info
                 . $this->tlv('52', $mcc)                                    // Merchant Category Code
                 . $this->tlv('53', '458')                                   // Transaction Currency (MYR)
                 . $this->tlv('54', $amount)                                 // Transaction Amount
                 . $this->tlv('58', 'MY')                                    // Country Code
                 . $this->tlv('59', $this->clip($merchantName, 25))          // Merchant Name (max 25)
                 . $this->tlv('60', $this->clip($merchantCity, 15))          // Merchant City (max 15)
                 . $this->tlv('62', $additionalData);                        // Additional data

        // CRC: tag 63 length 04 over the entire payload-so-far + "6304"
        $payload .= '6304';
        $crc = $this->crc16Ccitt($payload);
        return $payload . strtoupper(str_pad(dechex($crc), 4, '0', STR_PAD_LEFT));
    }

    /** Encode a single TLV element. Length is the value's byte length, 2 digits. */
    private function tlv(string $tag, string $value): string
    {
        $len = str_pad((string) strlen($value), 2, '0', STR_PAD_LEFT);
        return $tag . $len . $value;
    }

    /** ASCII-clip a string (EMV QR values are ASCII). */
    private function clip(string $s, int $max): string
    {
        $ascii = preg_replace('/[^\x20-\x7E]/', '', $s) ?? $s;
        return substr($ascii, 0, $max);
    }

    /**
     * CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, no reflect, no xor-out).
     * This is the variant used by EMV QR and DuitNow.
     */
    private function crc16Ccitt(string $data): int
    {
        $crc = 0xFFFF;
        for ($i = 0, $n = strlen($data); $i < $n; $i++) {
            $crc ^= (ord($data[$i]) << 8);
            for ($b = 0; $b < 8; $b++) {
                if (($crc & 0x8000) !== 0) {
                    $crc = (($crc << 1) ^ 0x1021) & 0xFFFF;
                } else {
                    $crc = ($crc << 1) & 0xFFFF;
                }
            }
        }
        return $crc;
    }
}
