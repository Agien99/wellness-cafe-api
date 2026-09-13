<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoyaltyTier extends Model
{
    protected $fillable = [
        'name',
        'minimum_spend',
        'discount_percentage',
        'points_multiplier',
        'active',
        'sort_order',
    ];

    protected $casts = [
        'minimum_spend' => 'decimal:2',
        'discount_percentage' => 'decimal:2',
        'points_multiplier' => 'decimal:2',
        'active' => 'boolean',
        'sort_order' => 'integer',
    ];
}