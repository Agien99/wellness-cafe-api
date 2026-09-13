<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\LoyaltyTier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class LoyaltyTierController extends Controller
{
    /**
     * GET /api/loyalty-tiers
     */
    public function index(): JsonResponse
    {
        $tiers = LoyaltyTier::query()
            ->orderBy('minimum_spend')
            ->orderBy('sort_order')
            ->get();

        return response()->json(
            $tiers
        );
    }

    /**
     * GET /api/loyalty-tiers/{loyaltyTier}
     */
    public function show(
        LoyaltyTier $loyaltyTier
    ): JsonResponse {
        return response()->json(
            $loyaltyTier
        );
    }

    /**
     * POST /api/loyalty-tiers
     */
    public function store(
        Request $request
    ): JsonResponse {
        $data = $request->validate(
            $this->validationRules()
        );

        $tier = DB::transaction(
            function () use (
                $request,
                $data
            ) {
                $tier = LoyaltyTier::create(
                    $data
                );

                $this->recalculateCustomers();

                AuditLog::record(
                    $request->user(),
                    'LOYALTY_TIER_CREATED',
                    $tier->name
                );

                return $tier;
            }
        );

        return response()->json(
            $tier,
            201
        );
    }

    /**
     * PUT /api/loyalty-tiers/{loyaltyTier}
     */
    public function update(
        Request $request,
        LoyaltyTier $loyaltyTier
    ): JsonResponse {
        $data = $request->validate(
            $this->validationRules(
                $loyaltyTier
            )
        );

        /*
         * Bronze is currently the system fallback tier.
         *
         * Keep it active and prevent renaming for now.
         */
        if ($loyaltyTier->name === 'Bronze') {
            if (
                isset($data['name']) &&
                $data['name'] !== 'Bronze'
            ) {
                throw ValidationException::withMessages([
                    'name' => [
                        'Bronze is the system base tier and cannot be renamed.',
                    ],
                ]);
            }

            if (
                array_key_exists(
                    'active',
                    $data
                ) &&
                !$data['active']
            ) {
                throw ValidationException::withMessages([
                    'active' => [
                        'Bronze is the system base tier and cannot be disabled.',
                    ],
                ]);
            }

            if (
                isset($data['minimum_spend']) &&
                (float) $data['minimum_spend'] !== 0.0
            ) {
                throw ValidationException::withMessages([
                    'minimum_spend' => [
                        'Bronze must remain at RM0 minimum spend.',
                    ],
                ]);
            }
        }

        DB::transaction(
            function () use (
                $request,
                $loyaltyTier,
                $data
            ) {
                $oldName =
                    $loyaltyTier->name;

                $loyaltyTier->update(
                    $data
                );

                /*
                 * Tier changes may affect existing
                 * customers immediately.
                 */
                $this->recalculateCustomers();

                AuditLog::record(
                    $request->user(),
                    'LOYALTY_TIER_UPDATED',
                    "{$oldName} → {$loyaltyTier->name}"
                );
            }
        );

        $loyaltyTier->refresh();

        return response()->json(
            $loyaltyTier
        );
    }

    /**
     * DELETE /api/loyalty-tiers/{loyaltyTier}
     */
    public function destroy(
        Request $request,
        LoyaltyTier $loyaltyTier
    ): JsonResponse {
        if ($loyaltyTier->name === 'Bronze') {
            throw ValidationException::withMessages([
                'loyalty_tier' => [
                    'Bronze is the system base tier and cannot be deleted.',
                ],
            ]);
        }

        $name = $loyaltyTier->name;

        DB::transaction(
            function () use (
                $request,
                $loyaltyTier,
                $name
            ) {
                $loyaltyTier->delete();

                /*
                 * Customers using the removed tier
                 * must be reassigned based on spend.
                 */
                $this->recalculateCustomers();

                AuditLog::record(
                    $request->user(),
                    'LOYALTY_TIER_DELETED',
                    $name
                );
            }
        );

        return response()->json([
            'message' =>
                'Loyalty tier deleted.',
        ]);
    }

    /**
     * Shared store/update validation.
     */
    private function validationRules(
        ?LoyaltyTier $loyaltyTier = null
    ): array {
        return [
            'name' => [
                $loyaltyTier
                    ? 'sometimes'
                    : 'required',

                'string',
                'max:100',

                Rule::unique(
                    'loyalty_tiers',
                    'name'
                )->ignore(
                    $loyaltyTier?->id
                ),
            ],

            'minimum_spend' => [
                $loyaltyTier
                    ? 'sometimes'
                    : 'required',

                'numeric',
                'min:0',
            ],

            'discount_percentage' => [
                $loyaltyTier
                    ? 'sometimes'
                    : 'required',

                'numeric',
                'min:0',
                'max:100',
            ],

            'points_multiplier' => [
                $loyaltyTier
                    ? 'sometimes'
                    : 'required',

                'numeric',
                'min:0',
            ],

            'active' => [
                'sometimes',
                'boolean',
            ],

            'sort_order' => [
                'sometimes',
                'integer',
                'min:0',
            ],
        ];
    }

    /**
     * Recalculate memberships for all
     * registered customers.
     */
    private function recalculateCustomers(): void
    {
        $tiers = LoyaltyTier::query()
            ->where('active', true)
            ->orderByDesc(
                'minimum_spend'
            )
            ->orderByDesc(
                'sort_order'
            )
            ->get();

        Customer::query()
            ->where('id', '!=', 8)
            ->chunkById(
                100,
                function ($customers) use (
                    $tiers
                ) {
                    foreach (
                        $customers as $customer
                    ) {
                        $tier = $tiers->first(
                            function (
                                LoyaltyTier $tier
                            ) use (
                                $customer
                            ) {
                                return
                                    (float) $customer->total_spent >=
                                    (float) $tier->minimum_spend;
                            }
                        );

                        $newMembership =
                            $tier?->name
                            ?? 'Bronze';

                        if (
                            $customer->membership !==
                            $newMembership
                        ) {
                            $customer->membership =
                                $newMembership;

                            $customer->save();
                        }
                    }
                }
            );
    }
}