<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_no', 32)->unique();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->string('customer_name')->nullable();
            $table->enum('channel', ['pos','qr','online'])->default('pos');
            $table->foreignId('table_id')->nullable()->constrained('tables')->nullOnDelete();
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('tax', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);
            $table->enum('status', ['pending_payment','completed','refunded','cancelled'])->default('completed');
            $table->enum('kitchen_status', ['pending','preparing','ready','completed'])->default('pending');
            $table->string('promo_code')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('cashier_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index('created_at');
            $table->index(['status','kitchen_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
