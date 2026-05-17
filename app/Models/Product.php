<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $fillable = [
        'category_id', 'name', 'size', 'price', 'cost',
        'image', 'available', 'recipe',
    ];

    protected $casts = [
        'price'     => 'decimal:2',
        'cost'      => 'decimal:2',
        'available' => 'boolean',
        'recipe'    => 'array', // [{ingredient_id, qty}, ...]
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }
}
