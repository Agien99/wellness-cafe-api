<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductOptionValue extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_option_group_id',
        'name',
        'available',
        'sort_order',
    ];

    protected $casts = [
        'available' => 'boolean',
    ];

    public function group()
    {
        return $this->belongsTo(
            ProductOptionGroup::class,
            'product_option_group_id'
        );
    }

    public function variants()
    {
        return $this->belongsToMany(
            ProductVariant::class,
            'product_variant_values'
        );
    }
}