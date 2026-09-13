<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\InventoryItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\PromotionUsage;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use App\Models\LoyaltyTier;

/**
 * OrderService
 * ------------
 * Central business logic for:
 * - order creation
 * - discounts
 * - Promotion V2 validation/redemption
 * - payment
 * - inventory
 * - loyalty
 * - refunds
 * - audit logging
 */
class OrderService
{
    public function __construct(
        private readonly float $taxRate = 0.06
    ) {}

    /**
     * Create a new order.
     *
     * $payload:
     * items        [{product_id, qty}, ...]
     * customer_id int|null
     * channel     pos|qr|online
     * table_id    int|null
     * promo_code  string|null
     * payment     {method: cash|card|ewallet|qr}|null
     * notes       string|null
     * cashier     User|null
     */
    public function create(array $payload): Order
    {
        $items = $payload['items'] ?? [];

        if (count($items) === 0) {
            throw ValidationException::withMessages([
                'items' => [
                    'Order must contain at least one item.',
                ],
            ]);
        }

        $customer = Customer::find(
            $payload['customer_id'] ?? 8
        ) ?? Customer::find(8);

        if (!$customer) {
            throw ValidationException::withMessages([
                'customer' => [
                    'Walk-in customer record is missing.',
                ],
            ]);
        }

        $channel = $payload['channel'] ?? 'pos';
        $cashier = $payload['cashier'] ?? null;
        $payment = $payload['payment'] ?? null;

        $promoCode = isset($payload['promo_code'])
            ? strtoupper(trim($payload['promo_code']))
            : null;

        if ($promoCode === '') {
            $promoCode = null;
        }

        /*
         * Resolve products before transaction.
         */
        $resolved = [];
        $subtotal = 0;

        foreach ($items as $line) {
            $productId = $line['product_id'] ?? null;

            $product = Product::find($productId);

            if (!$product) {
                throw ValidationException::withMessages([
                    'items' => [
                        "Product #{$productId} not found.",
                    ],
                ]);
            }

            if (!$product->available) {
                throw ValidationException::withMessages([
                    'items' => [
                        "Product '{$product->name}' is unavailable.",
                    ],
                ]);
            }

            $qty = max(
                1,
                (int) ($line['qty'] ?? 1)
            );

            $resolved[] = [
                'product' => $product,
                'qty' => $qty,
                'price' => (float) $product->price,
            ];

            $subtotal +=
                (float) $product->price * $qty;
        }

        $subtotal = round($subtotal, 2);

        /*
         * Membership discount remains existing behaviour
         * until Dynamic Loyalty is implemented.
         */
        $memberDiscount = round(
            $subtotal * $customer->membership_discount,
            2
        );

        $order = DB::transaction(function () use (
            $payload,
            $resolved,
            $customer,
            $channel,
            $cashier,
            $payment,
            $promoCode,
            $subtotal,
            $memberDiscount
        ) {
            $promotion = null;
            $promoDiscount = 0;

            /*
             * Promotion V2:
             *
             * Lock promotion row so multiple simultaneous
             * paid orders cannot easily exceed usage limits.
             */
            if ($promoCode) {
                $promotion = Promotion::query()
                    ->where('code', $promoCode)
                    ->lockForUpdate()
                    ->first();

                if (!$promotion) {
                    throw ValidationException::withMessages([
                        'promo_code' => [
                            'Invalid promotion code.',
                        ],
                    ]);
                }

                $result = $promotion->validateForOrder(
                    $subtotal,
                    $this->promotionCustomerId($customer),
                    $channel
                );

                if (!$result['valid']) {
                    throw ValidationException::withMessages([
                        'promo_code' => [
                            $result['message'],
                        ],
                    ]);
                }

                $promoDiscount = round(
                    (float) $result['discount'],
                    2
                );
            }

            /*
            * Promotion stackability.
            *
            * Stackable promotion:
            *   membership discount + promotion discount
            *
            * Non-stackable promotion:
            *   use whichever discount gives the customer
            *   the greater saving.
            */
            if ($promotion && !$promotion->stackable) {
                $totalDiscount = max(
                    $memberDiscount,
                    $promoDiscount
                );
            } else {
                $totalDiscount =
                    $memberDiscount + $promoDiscount;
            }

            $totalDiscount = round(
                $totalDiscount,
                2
            );

            /*
             * Never allow total discount above subtotal.
             */
            $totalDiscount = min(
                $totalDiscount,
                $subtotal
            );

            $taxBase = max(
                0,
                $subtotal - $totalDiscount
            );

            $tax = round(
                $taxBase * $this->taxRate,
                2
            );

            $total = round(
                $taxBase + $tax,
                2
            );

            $order = Order::create([
                'order_no' => Order::nextOrderNo(),

                'customer_id' => $customer->id,
                'customer_name' => $customer->name,

                'channel' => $channel,

                'table_id' =>
                    $payload['table_id'] ?? null,

                'subtotal' => $subtotal,

                'member_discount' =>
                    $memberDiscount,

                'promo_discount' =>
                    $promoDiscount,

                'discount' =>
                    $totalDiscount,

                'tax' => $tax,
                'total' => $total,

                'status' =>
                    $payment
                        ? 'completed'
                        : 'pending_payment',

                'kitchen_status' => 'pending',

                'promo_code' =>
                    $promotion?->code,

                'promotion_id' =>
                    $promotion?->id,

                'notes' =>
                    $payload['notes'] ?? null,

                'cashier_id' =>
                    $cashier?->id,
            ]);

            foreach ($resolved as $line) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' =>
                        $line['product']->id,
                    'name' =>
                        $line['product']->name,
                    'price' =>
                        $line['price'],
                    'qty' =>
                        $line['qty'],
                ]);
            }

            /*
             * Immediate payment.
             */
            if ($payment) {
                Payment::create([
                    'order_id' => $order->id,
                    'amount' => $total,

                    'method' =>
                        $payment['method'] ?? 'cash',

                    'status' => 'paid',

                    'reference' =>
                        'PAY' .
                        str_pad(
                            (string) (
                                20260000 + $order->id
                            ),
                            8,
                            '0',
                            STR_PAD_LEFT
                        ),

                    'paid_at' => now(),
                ]);

                /*
                 * Promotion is consumed ONLY after
                 * successful payment.
                 */
                if (
                    $promotion &&
                    $promoDiscount > 0
                ) {
                    $this->recordPromotionUsage(
                        $promotion,
                        $order,
                        $customer
                    );
                }
            }

            /*
             * Existing inventory behaviour retained.
             */
            foreach ($resolved as $line) {
                $this->deductInventory(
                    $line['product'],
                    $line['qty'],
                    $order->order_no
                );
            }

            /*
             * Existing loyalty logic retained temporarily.
             */
            if (
                $customer->id !== 8 &&
                $payment
            ) {
                $this->awardLoyalty(
                    $customer,
                    $total,
                    $cashier
                );
            }

            AuditLog::record(
                $cashier,
                'ORDER_CREATED',
                "{$order->order_no} RM" .
                number_format($total, 2) .
                ' via ' .
                ($payment['method'] ?? 'pending')
            );

            if ($payment) {
                AuditLog::record(
                    $cashier,
                    'PAYMENT_RECEIVED',
                    strtoupper(
                        $payment['method'] ?? 'cash'
                    ) .
                    ' RM' .
                    number_format($total, 2) .
                    " for {$order->order_no}"
                );
            }

            if (
                $promotion &&
                $promoDiscount > 0
            ) {
                AuditLog::record(
                    $cashier,
                    'PROMO_APPLIED',
                    "{$promotion->code} RM" .
                    number_format(
                        $promoDiscount,
                        2
                    ) .
                    " on {$order->order_no}"
                );
            }

            return $order;
        });

        return $order->load([
            'items',
            'payment',
            'customer',
            'table',
            'cashier',
            'promotion',
        ]);
    }

    /**
     * Take payment for a pending order.
     */
    public function takePayment(
        Order $order,
        string $method,
        ?User $cashier = null
    ): Order {
        if ($order->status !== 'pending_payment') {
            throw ValidationException::withMessages([
                'order' => [
                    "Order {$order->order_no} is not pending payment " .
                    "(current status: {$order->status}).",
                ],
            ]);
        }

        return DB::transaction(function () use (
            $order,
            $method,
            $cashier
        ) {
            /*
             * Lock the order so two cashiers cannot
             * process the same pending order simultaneously.
             */
            $lockedOrder = Order::query()
                ->whereKey($order->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (
                $lockedOrder->status !==
                'pending_payment'
            ) {
                throw ValidationException::withMessages([
                    'order' => [
                        "Order {$lockedOrder->order_no} " .
                        'has already been paid or processed.',
                    ],
                ]);
            }

            $promotion = null;

            /*
             * Revalidate promotion at payment time.
             *
             * Pending orders have NOT consumed a promotion
             * yet, so limits may have changed while waiting.
             */
            if (
                $lockedOrder->promotion_id &&
                (float) $lockedOrder->promo_discount > 0
            ) {
                $promotion = Promotion::query()
                    ->whereKey(
                        $lockedOrder->promotion_id
                    )
                    ->lockForUpdate()
                    ->first();

                if (!$promotion) {
                    throw ValidationException::withMessages([
                        'promo_code' => [
                            'Promotion is no longer available.',
                        ],
                    ]);
                }

                $result =
                    $promotion->validateForOrder(
                        (float) $lockedOrder->subtotal,
                        $this->promotionCustomerId(
                            $lockedOrder->customer
                        ),
                        $lockedOrder->channel
                    );

                if (!$result['valid']) {
                    throw ValidationException::withMessages([
                        'promo_code' => [
                            'Promotion can no longer be redeemed: ' .
                            $result['message'],
                        ],
                    ]);
                }

                /*
                 * We preserve the discount snapshot calculated
                 * when the customer placed the order.
                 *
                 * We DO NOT recalculate the order price here.
                 */
            }

            Payment::create([
                'order_id' =>
                    $lockedOrder->id,

                'amount' =>
                    $lockedOrder->total,

                'method' =>
                    $method,

                'status' =>
                    'paid',

                'reference' =>
                    'PAY' .
                    str_pad(
                        (string) (
                            20260000 +
                            $lockedOrder->id
                        ),
                        8,
                        '0',
                        STR_PAD_LEFT
                    ),

                'paid_at' =>
                    now(),
            ]);

            $lockedOrder->status = 'completed';
            $lockedOrder->cashier_id =
                $cashier?->id;

            $lockedOrder->save();

            /*
             * Promotion becomes officially used now.
             */
            if ($promotion) {
                $this->recordPromotionUsage(
                    $promotion,
                    $lockedOrder,
                    $lockedOrder->customer
                );

                AuditLog::record(
                    $cashier,
                    'PROMO_REDEEMED',
                    "{$promotion->code} on " .
                    $lockedOrder->order_no
                );
            }

            /*
             * Loyalty awarded after successful payment.
             */
            if (
                $lockedOrder->customer_id &&
                $lockedOrder->customer_id !== 8
            ) {
                $customer =
                    $lockedOrder->customer;

                if ($customer) {
                    $this->awardLoyalty(
                        $customer,
                        (float) $lockedOrder->total,
                        $cashier
                    );
                }
            }

            AuditLog::record(
                $cashier,
                'PAYMENT_RECEIVED',
                strtoupper($method) .
                ' RM' .
                number_format(
                    (float) $lockedOrder->total,
                    2
                ) .
                " for {$lockedOrder->order_no} " .
                '(was pending)'
            );

            return $lockedOrder->load([
                'items',
                'payment',
                'customer',
                'table',
                'cashier',
                'promotion',
            ]);
        });
    }

    /**
     * Record successful promotion redemption.
     */
    private function recordPromotionUsage(
        Promotion $promotion,
        Order $order,
        ?Customer $customer
    ): void {
        /*
         * Prevent duplicate usage for the same order.
         */
        if (
            PromotionUsage::where(
                'promotion_id',
                $promotion->id
            )
                ->where(
                    'order_id',
                    $order->id
                )
                ->exists()
        ) {
            return;
        }

        PromotionUsage::create([
            'promotion_id' =>
                $promotion->id,

            'order_id' =>
                $order->id,

            /*
             * Walk-in customer is anonymous for
             * redemption tracking purposes.
             */
            'customer_id' =>
                $this->promotionCustomerId(
                    $customer
                ),

            'promotion_code' =>
                $promotion->code,

            'discount_type' =>
                $promotion->type,

            'discount_value' =>
                $promotion->value,

            'discount_amount' =>
                $order->promo_discount,

            'order_subtotal' =>
                $order->subtotal,

            'used_at' =>
                now(),
        ]);
    }

    /**
     * Convert special Walk-in Customer into null
     * for promotion usage/eligibility.
     */
    private function promotionCustomerId(
        ?Customer $customer
    ): ?int {
        if (!$customer || $customer->id === 8) {
            return null;
        }

        return $customer->id;
    }

    /**
     * Existing loyalty logic extracted into helper.
     *
     * This will be replaced later by Dynamic Loyalty.
     */
    private function awardLoyalty(
        Customer $customer,
        float $total,
        ?User $cashier
    ): void {
        $earned = (int) floor(
            $total *
            $customer->point_multiplier
        );

        $customer->points =
            (int) $customer->points +
            $earned;

        $customer->total_spent = round(
            (float) $customer->total_spent +
            $total,
            2
        );

        $newTier = $this->resolveTier(
            (float) $customer->total_spent
        );

        if (
            $newTier !==
            $customer->membership
        ) {
            $oldTier =
                $customer->membership;

            $customer->membership =
                $newTier;

            AuditLog::record(
                $cashier,
                'LOYALTY_UPGRADE',
                "{$customer->name}: " .
                "{$oldTier} → {$newTier}"
            );
        }

        $customer->save();
    }

    /**
     * Deduct inventory based on product recipe.
     */
    private function deductInventory(
        Product $product,
        int $qty,
        string $orderNo
    ): void {
        $recipe = $product->recipe ?? [];

        foreach ($recipe as $r) {
            $inv = InventoryItem::find(
                $r['ingredient_id'] ?? null
            );

            if (!$inv) {
                continue;
            }

            $usage =
                (float) $r['qty'] * $qty;

            $inv->stock = round(
                (float) $inv->stock -
                $usage,
                2
            );

            $inv->save();

            StockMovement::create([
                'inventory_item_id' =>
                    $inv->id,

                'type' =>
                    'out',

                'qty' =>
                    $usage,

                'reason' =>
                    "Order {$orderNo} - " .
                    $product->name,
            ]);
        }
    }

    /**
     * Temporary hardcoded membership tier logic.
     *
     * Will be removed during Dynamic Loyalty phase.
     */
    private function resolveTier(
        float $totalSpent
    ): string {
        $tier = LoyaltyTier::query()
            ->where('active', true)
            ->where(
                'minimum_spend',
                '<=',
                $totalSpent
            )
            ->orderByDesc('minimum_spend')
            ->orderByDesc('sort_order')
            ->first();

        return $tier?->name ?? 'Bronze';
    }

    /**
     * Restore inventory + reverse loyalty.
     */
    public function reverse(
        Order $order,
        ?User $byUser = null
    ): void {
        DB::transaction(function () use (
            $order,
            $byUser
        ) {
            foreach ($order->items as $item) {
                $product = $item->product;

                if (
                    !$product ||
                    !$product->recipe
                ) {
                    continue;
                }

                foreach (
                    $product->recipe as $r
                ) {
                    $inv = InventoryItem::find(
                        $r['ingredient_id']
                            ?? null
                    );

                    if (!$inv) {
                        continue;
                    }

                    $restore =
                        (float) $r['qty'] *
                        $item->qty;

                    $inv->stock = round(
                        (float) $inv->stock +
                        $restore,
                        2
                    );

                    $inv->save();

                    StockMovement::create([
                        'inventory_item_id' =>
                            $inv->id,

                        'type' =>
                            'in',

                        'qty' =>
                            $restore,

                        'reason' =>
                            "Refund " .
                            "{$order->order_no} - " .
                            $item->name,
                    ]);
                }
            }

            /*
             * Existing loyalty refund logic retained
             * for now.
             *
             * We already identified that this should
             * later use an earned-points snapshot.
             */
            $customer = $order->customer;

            if (
                $customer &&
                $customer->id !== 8
            ) {
                $reverse = (int) floor(
                    (float) $order->total *
                    $customer->point_multiplier
                );

                $customer->points = max(
                    0,
                    (int) $customer->points -
                    $reverse
                );

                $customer->total_spent = max(
                    0,
                    round(
                        (float) $customer->total_spent -
                        (float) $order->total,
                        2
                    )
                );

                $customer->save();
            }

            /*
             * Promotion usage intentionally remains consumed
             * after refund.
             *
             * This prevents:
             * use promo -> refund -> reuse promo abuse.
             */
            $order->status = 'refunded';
            $order->save();

            AuditLog::record(
                $byUser,
                'ORDER_REVERSED',
                "{$order->order_no} refund processed"
            );
        });
    }
}