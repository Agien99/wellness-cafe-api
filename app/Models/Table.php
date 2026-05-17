<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Table extends Model
{
    protected $fillable = ['name', 'capacity', 'status'];

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
