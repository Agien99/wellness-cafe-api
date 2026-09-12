<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PromotionUsage extends Model
{
    protected $fillable = [
        'promotion_id',
        'order_id',
        'customer_id',
        'promotion_code',
        'discount_type',
        'discount_value',
        'discount_amount',
        'order_subtotal',
        'used_at',
    ];

    protected $casts = [
        'discount_value'  => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'order_subtotal'  => 'decimal:2',
        'used_at'         => 'datetime',
    ];

    public function promotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}