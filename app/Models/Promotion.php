<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Promotion extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'code', 'name', 'type', 'value', 'min_order', 'valid_till', 'active',
    ];

    protected $casts = [
        'value'     => 'decimal:2',
        'min_order' => 'decimal:2',
        'valid_till'=> 'date',
        'active'    => 'boolean',
    ];

    /** Calculate discount on a given subtotal; returns 0 if not applicable */
    public function discountFor(float $subtotal): float
    {
        if (!$this->active) return 0;
        if ($this->valid_till && $this->valid_till->isPast()) return 0;
        if ($subtotal < (float) $this->min_order) return 0;

        if ($this->type === 'percent') {
            return round($subtotal * (float) $this->value / 100, 2);
        }
        return (float) $this->value;
    }
}
