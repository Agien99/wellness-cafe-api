<?php

/**
 * DuitNow QR configuration.
 *
 * These values are encoded into the EMV-format QR payload presented to the
 * customer at the counter. The cafe owner must replace the placeholders below
 * with their real DuitNow merchant details (obtained when they register a
 * DuitNow QR merchant account with any participating bank — Maybank, CIMB,
 * Public Bank, etc., or via TNG Pay·Hi).
 *
 * Until real credentials are provided, the QR will scan-decode but most banking
 * apps will reject it as an unregistered merchant. That is fine for development
 * and demo purposes — the cashier can still confirm payment manually.
 */
return [

    /*
    |--------------------------------------------------------------------------
    | Whether the dynamic DuitNow QR option is enabled at all.
    |--------------------------------------------------------------------------
    */
    'enabled' => env('DUITNOW_ENABLED', true),

    /*
    |--------------------------------------------------------------------------
    | Merchant identifier issued to the cafe by its bank / DuitNow acquirer.
    | This is the unique account number the funds will be routed to.
    |--------------------------------------------------------------------------
    */
    'merchant_id' => env('DUITNOW_MERCHANT_ID', '60000000000'),

    /*
    |--------------------------------------------------------------------------
    | Globally Unique Identifier of the QR scheme. For PayNet DuitNow QR this
    | is usually "DUITNOW" or a bank-issued reverse-DNS identifier.
    |--------------------------------------------------------------------------
    */
    'guid' => env('DUITNOW_GUID', 'DUITNOW'),

    /*
    |--------------------------------------------------------------------------
    | Merchant Category Code (ISO 18245). 5812 = Eating Places / Restaurants.
    |--------------------------------------------------------------------------
    */
    'mcc' => env('DUITNOW_MCC', '5812'),

    /*
    |--------------------------------------------------------------------------
    | Human-readable merchant name + city. Shown to customer in the banking
    | app payment confirmation screen. Length-limited by the EMV spec.
    |--------------------------------------------------------------------------
    */
    'merchant_name' => env('DUITNOW_MERCHANT_NAME', 'Wellness Cafe'),
    'merchant_city' => env('DUITNOW_MERCHANT_CITY', 'Tanjong Malim'),

];
