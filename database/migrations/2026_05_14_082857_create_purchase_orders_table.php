<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->string('po_no', 32)->unique();
            $table->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $table->decimal('total', 12, 2)->default(0);
            $table->enum('status', ['pending','received','cancelled'])->default('pending');
            $table->date('expected_date')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_orders');
    }
};
