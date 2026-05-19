<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds soft-delete capability to tables that the admin can delete from.
 * Records remain in the DB (auditable) but are hidden from normal queries.
 */
return new class extends Migration
{
    private array $tables = [
        'categories',
        'products',
        'customers',
        'suppliers',
        'inventory_items',
        'promotions',
        'users',
    ];

    public function up(): void
    {
        foreach ($this->tables as $t) {
            Schema::table($t, function (Blueprint $table) {
                $table->softDeletes();
            });
        }
    }

    public function down(): void
    {
        foreach ($this->tables as $t) {
            Schema::table($t, function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }
    }
};
