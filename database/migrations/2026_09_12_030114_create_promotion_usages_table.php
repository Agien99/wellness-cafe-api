<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotion_usages', function (Blueprint $table) {
            $table->id();

            $table->foreignId('promotion_id')
                ->constrained('promotions')
                ->restrictOnDelete();

            $table->foreignId('order_id')
                ->constrained('orders')
                ->restrictOnDelete();

            /*
             * Nullable because anonymous / walk-in orders currently
             * have no real identifiable registered customer.
             *
             * Walk-in customer ID 8 should NOT be inserted here as
             * a customer identity for per-customer limit checking.
             */
            $table->foreignId('customer_id')
                ->nullable()
                ->constrained('customers')
                ->nullOnDelete();

            /*
             * Snapshot what actually happened.
             *
             * This is important because the promotion may later
             * be edited by the cafe owner.
             */
            $table->string('promotion_code', 64);

            $table->enum('discount_type', [
                'percent',
                'fixed',
            ]);

            $table->decimal('discount_value', 10, 2);

            $table->decimal('discount_amount', 10, 2);

            $table->decimal('order_subtotal', 10, 2);

            $table->timestamp('used_at');

            $table->timestamps();

            /*
             * A promotion can only be consumed once by one order.
             */
            $table->unique(
                ['promotion_id', 'order_id'],
                'promotion_order_unique'
            );

            /*
             * Speeds up per-customer usage counting.
             */
            $table->index(
                ['promotion_id', 'customer_id'],
                'promotion_customer_index'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotion_usages');
    }
};