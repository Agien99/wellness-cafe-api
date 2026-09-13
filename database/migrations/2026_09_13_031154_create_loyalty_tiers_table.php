<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loyalty_tiers', function (Blueprint $table) {
            $table->id();

            $table->string('name')->unique();

            $table->decimal(
                'minimum_spend',
                12,
                2
            )->default(0);

            $table->decimal(
                'discount_percentage',
                5,
                2
            )->default(0);

            $table->decimal(
                'points_multiplier',
                5,
                2
            )->default(1);

            $table->boolean(
                'active'
            )->default(true);

            $table->unsignedInteger(
                'sort_order'
            )->default(0);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'loyalty_tiers'
        );
    }
};