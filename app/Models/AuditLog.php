<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    protected $fillable = [
        'user_id', 'username', 'action', 'details',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Convenience: log an action quickly */
    public static function record(?User $user, string $action, ?string $details = null): void
    {
        static::create([
            'user_id'  => $user?->id,
            'username' => $user?->username ?? 'system',
            'action'   => $action,
            'details'  => $details,
        ]);
    }
}
