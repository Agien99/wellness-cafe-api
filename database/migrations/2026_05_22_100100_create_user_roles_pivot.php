<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds a `user_roles` pivot so one staff member can hold multiple roles
 * simultaneously (e.g. cashier + kitchen at a small cafe).
 *
 * Existing `users.role_id` is kept as the "primary" role (the label shown
 * in the UI). Each existing user's primary role is backfilled into the
 * pivot so permission checks keep working from day one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['user_id', 'role_id']);
        });

        // Backfill: each existing user gets their current primary role copied in.
        $users = DB::table('users')->whereNotNull('role_id')->get(['id', 'role_id']);
        $now = now();
        foreach ($users as $u) {
            DB::table('user_roles')->insertOrIgnore([
                'user_id'    => $u->id,
                'role_id'    => $u->role_id,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_roles');
    }
};
