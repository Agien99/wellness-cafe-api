<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'phone',
        'email',
        'membership',
        'points',
        'total_spent',
        'joined_at',
    ];

    protected $casts = [
        'points' => 'integer',
        'total_spent' => 'decimal:2',
        'joined_at' => 'date',
    ];

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /*
     * Customer membership is currently stored
     * using the loyalty tier name.
     *
     * Example:
     * customers.membership = "Gold"
     * loyalty_tiers.name   = "Gold"
     */
    public function loyaltyTier(): BelongsTo
    {
        return $this->belongsTo(
            LoyaltyTier::class,
            'membership',
            'name'
        );
    }

    /**
     * Multiplier used when awarding loyalty points.
     */
    public function getPointMultiplierAttribute(): float
    {
        if ($this->id === 8) {
            return 1.0;
        }

        $tier = $this->loyaltyTier;

        if (!$tier || !$tier->active) {
            return 1.0;
        }

        return (float) $tier->points_multiplier;
    }

    /**
     * Membership discount represented as decimal.
     *
     * Example:
     * DB value 8.00 = 8%
     * Returned value = 0.08
     */
    public function getMembershipDiscountAttribute(): float
    {
        if ($this->id === 8) {
            return 0.0;
        }

        $tier = $this->loyaltyTier;

        if (!$tier || !$tier->active) {
            return 0.0;
        }

        return (float) $tier->discount_percentage / 100;
    }
}