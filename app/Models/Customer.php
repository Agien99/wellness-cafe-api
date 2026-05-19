<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name', 'phone', 'email',
        'membership', 'points', 'total_spent', 'joined_at',
    ];

    protected $casts = [
        'points'      => 'integer',
        'total_spent' => 'decimal:2',
        'joined_at'   => 'date',
    ];

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /** Membership multiplier for loyalty points */
    public function getPointMultiplierAttribute(): float
    {
        return match ($this->membership) {
            'Platinum' => 2.0,
            'Gold'     => 1.5,
            'Silver'   => 1.2,
            default    => 1.0,
        };
    }

    /** Discount percentage for the customer's membership tier */
    public function getMembershipDiscountAttribute(): float
    {
        return match ($this->membership) {
            'Platinum' => 0.12,
            'Gold'     => 0.08,
            'Silver'   => 0.05,
            default    => 0.0,
        };
    }
}
