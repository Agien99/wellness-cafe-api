<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Promotion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PromotionController extends Controller
{
    /**
     * GET /api/promotions
     *
     * Query:
     * ?all=1
     *   Include inactive / scheduled / expired promotions.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Promotion::query()
            ->withCount('usages')
            ->orderByRaw('starts_at IS NULL DESC')
            ->orderBy('starts_at')
            ->orderBy('name');

        if (!$request->boolean('all')) {
            $query->where('active', true)
                ->where(function ($q) {
                    $q->whereNull('starts_at')
                        ->orWhere('starts_at', '<=', now());
                })
                ->where(function ($q) {
                    $q->whereNull('ends_at')
                        ->orWhere('ends_at', '>=', now());
                });
        }

        $promotions = $query->get()
            ->map(function (Promotion $promotion) {
                return $this->formatPromotion($promotion);
            });

        return response()->json($promotions);
    }

    /**
     * GET /api/promotions/{promotion}
     */
    public function show(Promotion $promotion): JsonResponse
    {
        $promotion->loadCount('usages');

        return response()->json(
            $this->formatPromotion($promotion)
        );
    }

    /**
     * POST /api/promotions
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(
            $this->validationRules()
        );

        $data = $this->prepareData($data);

        $promotion = Promotion::create($data);

        AuditLog::record(
            $request->user(),
            'PROMO_CREATED',
            $promotion->code
        );

        $promotion->loadCount('usages');

        return response()->json(
            $this->formatPromotion($promotion),
            201
        );
    }

    /**
     * PUT /api/promotions/{promotion}
     */
    public function update(
        Request $request,
        Promotion $promotion
    ): JsonResponse {
        $data = $request->validate(
            $this->validationRules($promotion)
        );

        $data = $this->prepareData($data, false);

        $promotion->update($data);

        AuditLog::record(
            $request->user(),
            'PROMO_UPDATED',
            $promotion->code
        );

        $promotion->refresh();
        $promotion->loadCount('usages');

        return response()->json(
            $this->formatPromotion($promotion)
        );
    }

    /**
     * DELETE /api/promotions/{promotion}
     *
     * Promotions use soft deletes.
     *
     * Historical promotion usages remain preserved.
     */
    public function destroy(
        Request $request,
        Promotion $promotion
    ): JsonResponse {
        $code = $promotion->code;

        $promotion->delete();

        AuditLog::record(
            $request->user(),
            'PROMO_DELETED',
            $code
        );

        return response()->json([
            'message' => 'Promotion deleted.',
        ]);
    }

    /**
     * POST /api/promotions/validate
     *
     * Example body:
     *
     * {
     *   "code": "WELCOME10",
     *   "subtotal": 25.50,
     *   "customer_id": 3,
     *   "channel": "pos"
     * }
     */
    public function validateCode(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => [
                'required',
                'string',
                'max:64',
            ],

            'subtotal' => [
                'required',
                'numeric',
                'min:0',
            ],

            'customer_id' => [
                'nullable',
                'integer',
                'exists:customers,id',
            ],

            'channel' => [
                'nullable',
                Rule::in([
                    'pos',
                    'qr',
                    'online',
                ]),
            ],
        ]);

        $promotion = Promotion::where(
            'code',
            strtoupper(trim($data['code']))
        )->first();

        if (!$promotion) {
            return response()->json([
                'valid' => false,
                'message' => 'Invalid promotion code.',
                'discount' => 0,
            ], 422);
        }

        $result = $promotion->validateForOrder(
            (float) $data['subtotal'],
            $data['customer_id'] ?? null,
            $data['channel'] ?? null
        );

        if (!$result['valid']) {
            return response()->json([
                'valid' => false,
                'message' => $result['message'],
                'discount' => 0,
                'promo' => $this->formatPromotion($promotion),
            ], 422);
        }

        return response()->json([
            'valid' => true,
            'message' => sprintf(
                'Promotion "%s" applied.',
                $promotion->name
            ),
            'discount' => $result['discount'],
            'promo' => $this->formatPromotion($promotion),
        ]);
    }

    /**
     * Validation rules shared by store/update.
     */
    private function validationRules(
        ?Promotion $promotion = null
    ): array {
        $promotionId = $promotion?->id;

        return [
            'code' => [
                $promotion ? 'sometimes' : 'required',
                'string',
                'max:64',
                Rule::unique('promotions', 'code')
                    ->ignore($promotionId),
            ],

            'name' => [
                $promotion ? 'sometimes' : 'required',
                'string',
                'max:255',
            ],

            'description' => [
                'nullable',
                'string',
                'max:2000',
            ],

            'type' => [
                $promotion ? 'sometimes' : 'required',
                Rule::in([
                    'percent',
                    'fixed',
                ]),
            ],

            'value' => [
                $promotion ? 'sometimes' : 'required',
                'numeric',
                'min:0.01',
            ],

            'max_discount' => [
                'nullable',
                'numeric',
                'min:0.01',
            ],

            'min_order' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'starts_at' => [
                'nullable',
                'date',
            ],

            'ends_at' => [
                'nullable',
                'date',
                'after_or_equal:starts_at',
            ],

            'usage_limit' => [
                'nullable',
                'integer',
                'min:1',
            ],

            'usage_limit_per_customer' => [
                'nullable',
                'integer',
                'min:1',
            ],

            'stackable' => [
                'nullable',
                'boolean',
            ],

            'customer_scope' => [
                'nullable',
                Rule::in([
                    'all',
                    'registered',
                ]),
            ],

            'allowed_channels' => [
                'nullable',
                'array',
            ],

            'allowed_channels.*' => [
                Rule::in([
                    'pos',
                    'qr',
                    'online',
                ]),
            ],

            'active' => [
                'nullable',
                'boolean',
            ],
        ];
    }

    /**
     * Normalize incoming request data.
     */
    private function prepareData(
        array $data,
        bool $isCreate = true
    ): array {
        if (isset($data['code'])) {
            $data['code'] = strtoupper(
                trim($data['code'])
            );
        }

        if ($isCreate) {
            $data['active'] = $data['active'] ?? true;
            $data['stackable'] = $data['stackable'] ?? false;
            $data['customer_scope'] =
                $data['customer_scope'] ?? 'all';
            $data['min_order'] =
                $data['min_order'] ?? 0;
        }

        /*
         * max_discount only applies to percentage promos.
         */
        if (
            isset($data['type']) &&
            $data['type'] === 'fixed'
        ) {
            $data['max_discount'] = null;
        }

        /*
         * Legacy compatibility.
         *
         * valid_till is still present in the DB for now,
         * but V2 uses ends_at.
         *
         * We keep it synchronized temporarily so older
         * frontend/backend code will not immediately break.
         */
        if (array_key_exists('ends_at', $data)) {
            $data['valid_till'] = $data['ends_at']
                ? date(
                    'Y-m-d',
                    strtotime($data['ends_at'])
                )
                : null;
        }

        return $data;
    }

    /**
     * Standard API representation.
     */
    private function formatPromotion(
        Promotion $promotion
    ): array {
        $status = 'active';

        if (!$promotion->active) {
            $status = 'disabled';
        } elseif (
            $promotion->starts_at &&
            now()->lt($promotion->starts_at)
        ) {
            $status = 'scheduled';
        } elseif (
            $promotion->ends_at &&
            now()->gt($promotion->ends_at)
        ) {
            $status = 'expired';
        } elseif (
            $promotion->usage_limit !== null &&
            $promotion->usageCount() >=
                $promotion->usage_limit
        ) {
            $status = 'usage_limit_reached';
        }

        return [
            'id' => $promotion->id,

            'code' => $promotion->code,
            'name' => $promotion->name,
            'description' => $promotion->description,

            'type' => $promotion->type,
            'value' => $promotion->value,
            'max_discount' => $promotion->max_discount,
            'min_order' => $promotion->min_order,

            'starts_at' => $promotion->starts_at,
            'ends_at' => $promotion->ends_at,

            'usage_limit' => $promotion->usage_limit,
            'usage_limit_per_customer' =>
                $promotion->usage_limit_per_customer,

            'usage_count' =>
                isset($promotion->usages_count)
                    ? $promotion->usages_count
                    : $promotion->usageCount(),

            'stackable' => $promotion->stackable,
            'customer_scope' =>
                $promotion->customer_scope,
            'allowed_channels' =>
                $promotion->allowed_channels,

            'active' => $promotion->active,

            'status' => $status,

            'created_at' => $promotion->created_at,
            'updated_at' => $promotion->updated_at,
        ];
    }
}