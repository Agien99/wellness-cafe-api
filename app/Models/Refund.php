<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Refund extends Model
{
    protected $fillable = [
        'refund_no', 'order_id', 'amount', 'reason',
        'method', 'status', 'user_id',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function nextRefundNo(): string
    {
        $last = static::max('id') ?? 0;
        return 'RF' . str_pad((string) (20260000 + $last + 1), 8, '0', STR_PAD_LEFT);
    }
}
