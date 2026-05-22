<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Table extends Model
{
    use SoftDeletes;

    protected $fillable = ['name', 'capacity', 'status'];

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
