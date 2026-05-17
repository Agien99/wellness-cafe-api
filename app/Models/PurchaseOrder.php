<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseOrder extends Model
{
    protected $fillable = [
        'po_no', 'supplier_id', 'total', 'status',
        'expected_date', 'received_at',
    ];

    protected $casts = [
        'total'         => 'decimal:2',
        'expected_date' => 'date',
        'received_at'   => 'datetime',
    ];

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public static function nextPoNo(): string
    {
        $last = static::max('id') ?? 0;
        return 'PO' . str_pad((string) (20260000 + $last + 1), 8, '0', STR_PAD_LEFT);
    }
}
