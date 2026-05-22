<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens, SoftDeletes;

    protected $fillable = [
        'name', 'username', 'email', 'phone',
        'role_id', 'password', 'active',
    ];

    protected $hidden = [
        'password', 'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'active'   => 'boolean',
        ];
    }

    /** Primary role — used for the display label ("Cashier", "Manager"). */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /** All roles a user holds. Permissions are the merged set across these. */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'user_roles')->withTimestamps();
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'cashier_id');
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class);
    }

    /**
     * Merged list of permission keys this user has via *any* of their roles.
     * Returns ['*'] if any role grants super-admin access.
     */
    public function permissions(): array
    {
        $roles = $this->relationLoaded('roles') ? $this->roles : $this->roles()->get();
        $merged = [];
        foreach ($roles as $r) {
            foreach (($r->permissions ?? []) as $p) $merged[$p] = true;
        }
        // Fallback to primary role if pivot is empty (shouldn't happen after backfill)
        if (empty($merged) && $this->role) {
            foreach (($this->role->permissions ?? []) as $p) $merged[$p] = true;
        }
        return array_keys($merged);
    }

    /** Convenience: check if user has a permission key. */
    public function hasPermission(string $key): bool
    {
        $perms = $this->permissions();
        return in_array('*', $perms, true) || in_array($key, $perms, true);
    }
}
