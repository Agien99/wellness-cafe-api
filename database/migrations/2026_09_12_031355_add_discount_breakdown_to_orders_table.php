<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('member_discount', 12, 2)
                ->default(0)
                ->after('subtotal');

            $table->decimal('promo_discount', 12, 2)
                ->default(0)
                ->after('member_discount');

            $table->foreignId('promotion_id')
                ->nullable()
                ->after('promo_code')
                ->constrained('promotions')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('promotion_id');

            $table->dropColumn([
                'member_discount',
                'promo_discount',
            ]);
        });
    }
};