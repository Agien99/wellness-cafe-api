<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            ALTER TABLE customers
            MODIFY membership VARCHAR(255)
            NOT NULL DEFAULT 'Bronze'
        ");
    }

    public function down(): void
    {
        DB::statement("
            ALTER TABLE customers
            MODIFY membership ENUM(
                'None',
                'Bronze',
                'Silver',
                'Gold',
                'Platinum'
            )
            NOT NULL DEFAULT 'Bronze'
        ");
    }
};