<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Promotion extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'code',
        'name',
        'description',
        'type',
        'value',
        'max_discount',
        'min_order',
        'valid_till',
        'starts_at',
        'ends_at',
        'usage_limit',
        'usage_limit_per_customer',
        'stackable',
        'customer_scope',
        'allowed_channels',
        'active',
    ];

    protected $casts = [
        'value'                    => 'decimal:2',
        'max_discount'             => 'decimal:2',
        'min_order'                => 'decimal:2',
        'valid_till'               => 'date',
        'starts_at'                => 'datetime',
        'ends_at'                  => 'datetime',
        'usage_limit'              => 'integer',
        'usage_limit_per_customer' => 'integer',
        'stackable'                => 'boolean',
        'allowed_channels'         => 'array',
        'active'                   => 'boolean',
    ];

    public function usages(): HasMany
    {
        return $this->hasMany(PromotionUsage::class);
    }

    /**
     * Current number of successful redemptions.
     */
    public function usageCount(): int
    {
        return $this->usages()->count();
    }

    /**
     * Number of times this promotion has been used by one customer.
     */
    public function usageCountForCustomer(?int $customerId): int
    {
        if (!$customerId) {
            return 0;
        }

        return $this->usages()
            ->where('customer_id', $customerId)
            ->count();
    }

    /**
     * Determine whether the campaign is currently available.
     */
    public function isCurrentlyActive(): bool
    {
        if (!$this->active) {
            return false;
        }

        $now = now();

        if ($this->starts_at && $now->lt($this->starts_at)) {
            return false;
        }

        if ($this->ends_at && $now->gt($this->ends_at)) {
            return false;
        }

        return true;
    }

    /**
     * Check whether this promotion is allowed for an order channel.
     */
    public function allowsChannel(?string $channel): bool
    {
        if (empty($this->allowed_channels)) {
            return true;
        }

        if (!$channel) {
            return false;
        }

        return in_array(
            $channel,
            $this->allowed_channels,
            true
        );
    }

    /**
     * Check whether this promotion is allowed for the customer.
     *
     * Walk-in customer ID 8 is treated as an anonymous customer.
     */
    public function allowsCustomer(?int $customerId): bool
    {
        if ($this->customer_scope === 'all') {
            return true;
        }

        if ($this->customer_scope === 'registered') {
            return $customerId !== null && $customerId !== 8;
        }

        return false;
    }

    /**
     * Calculate the monetary discount.
     *
     * Assumes validation has already been performed.
     */
    public function calculateDiscount(float $subtotal): float
    {
        if ($this->type === 'percent') {
            $discount = round(
                $subtotal * ((float) $this->value / 100),
                2
            );

            if ($this->max_discount !== null) {
                $discount = min(
                    $discount,
                    (float) $this->max_discount
                );
            }

            return min($discount, $subtotal);
        }

        if ($this->type === 'fixed') {
            return min(
                (float) $this->value,
                $subtotal
            );
        }

        return 0;
    }

    /**
     * Validate this promotion against an order.
     *
     * Returns a consistent result instead of throwing an exception.
     */
    public function validateForOrder(
        float $subtotal,
        ?int $customerId = null,
        ?string $channel = null
    ): array {
        if (!$this->active) {
            return $this->invalid('Promotion is inactive.');
        }

        $now = now();

        if ($this->starts_at && $now->lt($this->starts_at)) {
            return $this->invalid(
                'Promotion has not started yet.'
            );
        }

        if ($this->ends_at && $now->gt($this->ends_at)) {
            return $this->invalid(
                'Promotion has expired.'
            );
        }

        if ($subtotal < (float) $this->min_order) {
            return $this->invalid(
                'Minimum order of RM' .
                number_format((float) $this->min_order, 2) .
                ' is required.'
            );
        }

        if (!$this->allowsChannel($channel)) {
            return $this->invalid(
                'Promotion is not available for this order channel.'
            );
        }

        if (!$this->allowsCustomer($customerId)) {
            return $this->invalid(
                'Promotion is only available to registered customers.'
            );
        }

        if (
            $this->usage_limit !== null &&
            $this->usageCount() >= $this->usage_limit
        ) {
            return $this->invalid(
                'Promotion usage limit has been reached.'
            );
        }

        if (
            $this->usage_limit_per_customer !== null &&
            $customerId !== null &&
            $customerId !== 8 &&
            $this->usageCountForCustomer($customerId)
                >= $this->usage_limit_per_customer
        ) {
            return $this->invalid(
                'You have already reached the usage limit for this promotion.'
            );
        }

        /*
         * A per-customer usage limit cannot safely be enforced
         * for an anonymous / walk-in customer.
         */
        if (
            $this->usage_limit_per_customer !== null &&
            ($customerId === null || $customerId === 8)
        ) {
            return $this->invalid(
                'This promotion requires a registered customer.'
            );
        }

        $discount = $this->calculateDiscount($subtotal);

        if ($discount <= 0) {
            return $this->invalid(
                'Promotion does not provide a valid discount.'
            );
        }

        return [
            'valid'    => true,
            'message'  => 'Promotion applied.',
            'discount' => $discount,
        ];
    }

    private function invalid(string $message): array
    {
        return [
            'valid'    => false,
            'message'  => $message,
            'discount' => 0,
        ];
    }
}