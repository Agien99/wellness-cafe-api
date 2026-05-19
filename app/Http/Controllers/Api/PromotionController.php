<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Promotion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PromotionController extends Controller
{
    /** GET /api/promotions  (?all=1 to include inactive) */
    public function index(Request $request): JsonResponse
    {
        $q = Promotion::query()->orderBy('valid_till');
        if (!$request->boolean('all')) {
            $q->where('active', true);
        }
        return response()->json($q->get());
    }

    /** GET /api/promotions/{promotion} */
    public function show(Promotion $promotion): JsonResponse
    {
        return response()->json($promotion);
    }

    /** POST /api/promotions */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code'      => ['required', 'string', 'max:64', 'unique:promotions,code'],
            'name'      => ['required', 'string', 'max:255'],
            'type'      => ['required', 'in:percent,fixed'],
            'value'     => ['required', 'numeric', 'min:0'],
            'min_order' => ['nullable', 'numeric', 'min:0'],
            'valid_till'=> ['nullable', 'date'],
            'active'    => ['nullable', 'boolean'],
        ]);
        $data['code']   = strtoupper($data['code']);
        $data['active'] = $data['active'] ?? true;
        $promo = Promotion::create($data);
        AuditLog::record($request->user(), 'PROMO_CREATED', $promo->code);
        return response()->json($promo, 201);
    }

    /** PUT /api/promotions/{promotion} */
    public function update(Request $request, Promotion $promotion): JsonResponse
    {
        $data = $request->validate([
            'code'      => ['sometimes', 'required', 'string', 'max:64', 'unique:promotions,code,' . $promotion->id],
            'name'      => ['sometimes', 'required', 'string', 'max:255'],
            'type'      => ['sometimes', 'in:percent,fixed'],
            'value'     => ['sometimes', 'numeric', 'min:0'],
            'min_order' => ['nullable', 'numeric', 'min:0'],
            'valid_till'=> ['nullable', 'date'],
            'active'    => ['nullable', 'boolean'],
        ]);
        if (isset($data['code'])) $data['code'] = strtoupper($data['code']);
        $promotion->update($data);
        AuditLog::record($request->user(), 'PROMO_UPDATED', $promotion->code);
        return response()->json($promotion);
    }

    /** DELETE /api/promotions/{promotion} */
    public function destroy(Request $request, Promotion $promotion): JsonResponse
    {
        $code = $promotion->code;
        $promotion->delete();
        AuditLog::record($request->user(), 'PROMO_DELETED', $code);
        return response()->json(['message' => 'Deleted.']);
    }

    /**
     * POST /api/promotions/validate
     * Body: { code: "WELCOME10", subtotal: 25.50 }
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
