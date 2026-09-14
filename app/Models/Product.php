<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class Product extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'category_id',
        'name',
        'size',
        'price',
        'cost',
        'image',
        'image_path',
        'available',
        'visible',
        'product_type',
        'recipe',
    ];

    protected $casts = [
        'price'       => 'decimal:2',
        'cost'        => 'decimal:2',
        'available'   => 'boolean',
        'visible'     => 'boolean',
        'recipe'      => 'array',
    ];

    protected $appends = ['image_url'];

    public function getImageUrlAttribute(): ?string
    {
        if (!$this->image_path) {
            return null;
        }

        return Storage::disk('public')->url($this->image_path);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function optionGroups(): HasMany
    {
        return $this->hasMany(ProductOptionGroup::class)
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class)
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function addons(): BelongsToMany
    {
        return $this->belongsToMany(
            Addon::class,
            'product_addons'
        );
    }
}