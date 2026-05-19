<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class InventoryItem extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name', 'unit', 'stock', 'reorder_level', 'cost_per_unit', 'supplier_id',
    ];

    protected $casts = [
        'stock'         => 'decimal:2',
        'reorder_level' => 'decimal:2',
        'cost_per_unit' => 'decimal:2',
    ];

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function purchaseOrderItems(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    /** Helper: is stock at or below reorder level? */
    public function getIsLowStockAttribute(): bool
    {
        return (float) $this->stock <= (float) $this->reorder_level;
    }
}
