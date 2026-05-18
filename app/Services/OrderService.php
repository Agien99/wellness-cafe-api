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
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * OrderService
 * ------------
 * Central business logic for creating an order end-to-end:
 *   - validate items
 *   - calculate subtotal, member discount, promo discount, tax, total
 *   - persist Order + OrderItems + Payment in a single transaction
 *   - deduct inventory via product recipe + log stock movements
 *   - award loyalty points (with tier multiplier) and auto-upgrade membership
 *   - write audit log entries
 */
class OrderService
{
    public function __construct(
        private readonly float $taxRate = 0.06   // 6% SST
    ) {}

    /**
     * Create a new order.
     *
     * $payload structure:
     *   items:        [{product_id, qty}, ...]   (required, >=1)
     *   customer_id:  int|null     defaults to walk-in (id=8)
     *   channel:      pos|qr|online
     *   table_id:     int|null
     *   promo_code:   string|null
     *   payment:      { method: cash|card|ewallet|qr }   (optional, default cash; for QR orders may be null = pending_payment)
     *   notes:        string|null
     *   cashier:      User|null    the staff user creating the order
     */
    public function create(array $payload): Order
    {
        $items = $payload['items'] ?? [];
        if (count($items) === 0) {
            throw ValidationException::withMessages(['items' => ['Order must contain at least one item.']]);
        }

        $customer = Customer::find($payload['customer_id'] ?? 8) ?? Customer::find(8);
        $channel  = $payload['channel'] ?? 'pos';
        $cashier  = $payload['cashier'] ?? null;
        $payment  = $payload['payment'] ?? null;
        $promoCode = $payload['promo_code'] ?? null;

        // Resolve products and build line items
        $resolved = [];
        $subtotal = 0;
        foreach ($items as $line) {
            $product = Product::find($line['product_id'] ?? null);
            if (!$product) {
                throw ValidationException::withMessages(['items' => ["Product #{$line['product_id']} not found."]]);
            }
            if (!$product->available) {
                throw ValidationException::withMessages(['items' => ["Product '{$product->name}' is unavailable."]]);
            }
            $qty = max(1, (int) ($line['qty'] ?? 1));
            $resolved[] = [
                'product' => $product,
                'qty'     => $qty,
                'price'   => (float) $product->price,
            ];
            $subtotal += (float) $product->price * $qty;
        }

        // Discounts
        $memberDisc = round($subtotal * $customer->membership_discount, 2);
        $promoDisc = 0;
        if ($promoCode) {
            $promo = Promotion::where('code', strtoupper($promoCode))->first();
            if ($promo) {
                $promoDisc = $promo->discountFor($subtotal);
            }
        }
        $totalDiscount = round($memberDisc + $promoDisc, 2);
        $taxBase = max(0, $subtotal - $totalDiscount);
        $tax = round($taxBase * $this->taxRate, 2);
        $total = round($taxBase + $tax, 2);

        // Persist atomically
        $order = DB::transaction(function () use (
            $payload, $resolved, $customer, $channel, $cashier, $payment,
            $promoCode, $subtotal, $totalDiscount, $tax, $total
        ) {
            $order = Order::create([
                'order_no'       => Order::nextOrderNo(),
                'customer_id'    => $customer->id,
                'customer_name'  => $customer->name,
                'channel'        => $channel,
                'table_id'       => $payload['table_id'] ?? null,
                'subtotal'       => round($subtotal, 2),
                'discount'       => $totalDiscount,
                'tax'            => $tax,
                'total'          => $total,
                'status'         => $payment ? 'completed' : 'pending_payment',
                'kitchen_status' => 'pending',
                'promo_code'     => $promoCode,
                'notes'          => $payload['notes'] ?? null,
                'cashier_id'     => $cashier?->id,
            ]);

            foreach ($resolved as $line) {
                OrderItem::create([
                    'order_id'   => $order->id,
                    'product_id' => $line['product']->id,
                    'name'       => $line['product']->name,
                    'price'      => $line['price'],
                    'qty'        => $line['qty'],
                ]);
            }

            // Payment (optional — QR orders may pay at counter later)
            if ($payment) {
                Payment::create([
                    'order_id'  => $order->id,
                    'amount'    => $total,
                    'method'    => $payment['method'] ?? 'cash',
                    'status'    => 'paid',
                    'reference' => 'PAY' . str_pad((string)(20260000 + $order->id), 8, '0', STR_PAD_LEFT),
                    'paid_at'   => now(),
                ]);
            }

            // Inventory deduction
            foreach ($resolved as $line) {
                $this->deductInventory($line['product'], $line['qty'], $order->order_no);
            }

            // Loyalty points + tier upgrade (skip for walk-in)
            if ($customer->id !== 8 && $payment) {
                $earned = (int) floor($total * $customer->point_multiplier);
                $customer->points = (int) $customer->points + $earned;
                $customer->total_spent = round((float) $customer->total_spent + $total, 2);

                $newTier = $this->resolveTier((float) $customer->total_spent);
                if ($newTier !== $customer->membership) {
                    $oldTier = $customer->membership;
                    $customer->membership = $newTier;
                    AuditLog::record($cashier, 'LOYALTY_UPGRADE', "{$customer->name}: {$oldTier} → {$newTier}");
                }
                $customer->save();
            }

            // Audit
            AuditLog::record($cashier, 'ORDER_CREATED',
                "{$order->order_no} RM" . number_format($total, 2) . " via " . ($payment['method'] ?? 'pending')
            );
            if ($payment) {
                AuditLog::record($cashier, 'PAYMENT_RECEIVED',
                    strtoupper($payment['method'] ?? 'cash') . ' RM' . number_format($total, 2) . " for {$order->order_no}"
                );
            }

            return $order;
        });

        return $order->load(['items', 'payment', 'customer', 'table', 'cashier']);
    }

    /**
     * Deduct inventory based on a product's recipe.
     * Negative stock allowed (kitchen may oversell during rush; manager reconciles).
     */
    private function deductInventory(Product $product, int $qty, string $orderNo): void
    {
        $recipe = $product->recipe ?? [];
        foreach ($recipe as $r) {
            $inv = InventoryItem::find($r['ingredient_id'] ?? null);
            if (!$inv) continue;
            $usage = (float) $r['qty'] * $qty;
            $inv->stock = round((float) $inv->stock - $usage, 2);
            $inv->save();

            StockMovement::create([
                'inventory_item_id' => $inv->id,
                'type'              => 'out',
                'qty'               => $usage,
                'reason'            => "Order {$orderNo} - {$product->name}",
            ]);
        }
    }

    /**
     * Determine appropriate membership tier based on lifetime spend.
     */
    private function resolveTier(float $totalSpent): string
    {
        if ($totalSpent >= 800) return 'Platinum';
        if ($totalSpent >= 300) return 'Gold';
        if ($totalSpent >= 100) return 'Silver';
        return 'Bronze';
    }

    /**
     * Restore inventory + reverse loyalty points (used by refund flow).
     */
    public function reverse(Order $order, ?User $byUser = null): void
    {
        DB::transaction(function () use ($order, $byUser) {
            // Restore inventory
            foreach ($order->items as $item) {
                $product = $item->product;
                if (!$product || !$product->recipe) continue;
                foreach ($product->recipe as $r) {
                    $inv = InventoryItem::find($r['ingredient_id'] ?? null);
                    if (!$inv) continue;
                    $restore = (float) $r['qty'] * $item->qty;
                    $inv->stock = round((float) $inv->stock + $restore, 2);
                    $inv->save();

                    StockMovement::create([
                        'inventory_item_id' => $inv->id,
                        'type'              => 'in',
                        'qty'               => $restore,
                        'reason'            => "Refund {$order->order_no} - {$item->name}",
                    ]);
                }
            }

            // Reverse loyalty
            $customer = $order->customer;
            if ($customer && $customer->id !== 8) {
                $reverse = (int) floor((float) $order->total * $customer->point_multiplier);
                $customer->points = max(0, (int) $customer->points - $reverse);
                $customer->total_spent = max(0, round((float) $customer->total_spent - (float) $order->total, 2));
                $customer->save();
            }

            $order->status = 'refunded';
            $order->save();

            AuditLog::record($byUser, 'ORDER_REVERSED', "{$order->order_no} refund processed");
        });
    }
}
