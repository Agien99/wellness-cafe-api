<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('membership')
                ->default('Bronze')
                ->change();
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->enum('membership', [
                'None',
                'Bronze',
                'Silver',
                'Gold',
                'Platinum',
            ])
                ->default('Bronze')
                ->change();
        });
    }
};