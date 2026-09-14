<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('product_variant_values', function (Blueprint $table) {
            $table->id();

            $table->foreignId('product_variant_id')
                ->constrained('product_variants')
                ->cascadeOnDelete();

            $table->foreignId('product_option_value_id')
                ->constrained('product_option_values')
                ->cascadeOnDelete();

            $table->timestamps();

            $table->unique(
                [
                    'product_variant_id',
                    'product_option_value_id',
                ],
                'pv_values_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_variant_values');
    }
};
