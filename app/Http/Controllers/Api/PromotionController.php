<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Promotion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PromotionController extends Controller
{
    /** GET /api/promotions — only active promotions for POS */
    public function index(): JsonResponse
    {
        return response()->json(Promotion::where('active', true)->get());
    }

    /**
     * POST /api/promotions/validate
     * Body: { code: "WELCOME10", subtotal: 25.50 }
     * Returns: { valid, discount, promo? }
     */
    public function validateCode(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code'     => ['required', 'string'],
            'subtotal' => ['required', 'numeric', 'min:0'],
        ]);

        $promo = Promotion::where('code', strtoupper($data['code']))
            ->where('active', true)
            ->first();

        if (!$promo) {
            return response()->json([
                'valid'    => false,
                'message'  => 'Invalid or inactive promo code.',
                'discount' => 0,
            ], 422);
        }

        $discount = $promo->discountFor((float) $data['subtotal']);
        if ($discount <= 0) {
            return response()->json([
                'valid'    => false,
                'message'  => "Minimum order RM{$promo->min_order} required.",
                'discount' => 0,
                'promo'    => $promo,
            ], 422);
        }

        return response()->json([
            'valid'    => true,
            'message'  => "Promo \"{$promo->name}\" applied.",
            'discount' => $discount,
            'promo'    => $promo,
        ]);
    }
}
