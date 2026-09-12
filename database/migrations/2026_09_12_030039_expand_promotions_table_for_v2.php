<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            // Description shown to staff/customer
            $table->text('description')
                ->nullable()
                ->after('name');

            // Campaign period
            $table->dateTime('starts_at')
                ->nullable()
                ->after('min_order');

            $table->dateTime('ends_at')
                ->nullable()
                ->after('starts_at');

            // Protect cafe from very large percentage discounts.
            // null = no maximum cap.
            $table->decimal('max_discount', 10, 2)
                ->nullable()
                ->after('value');

            // null = unlimited total redemption
            $table->unsignedInteger('usage_limit')
                ->nullable()
                ->after('ends_at');

            // null = unlimited usage per customer
            $table->unsignedInteger('usage_limit_per_customer')
                ->nullable()
                ->after('usage_limit');

            // Initially we will still enforce one promo per order,
            // but this leaves room for controlled stacking later.
            $table->boolean('stackable')
                ->default(false)
                ->after('usage_limit_per_customer');

            // Who can use the campaign.
            //
            // all        = anyone
            // registered = registered customers only
            //
            // membership-tier targeting will be added when the
            // dynamic membership tier system is introduced.
            $table->string('customer_scope', 32)
                ->default('all')
                ->after('stackable');

            // Which order channels may use it.
            // null = all channels.
            //
            // Example:
            // ["pos", "qr"]
            $table->json('allowed_channels')
                ->nullable()
                ->after('customer_scope');
        });

        /*
         * Preserve existing promotion expiry dates.
         *
         * Existing promotions currently use valid_till.
         * We copy those values into the new ends_at column so
         * existing campaigns continue to behave correctly.
         */
        DB::table('promotions')
            ->whereNotNull('valid_till')
            ->get()
            ->each(function ($promotion) {
                DB::table('promotions')
                    ->where('id', $promotion->id)
                    ->update([
                        'ends_at' => $promotion->valid_till . ' 23:59:59',
                    ]);
            });
    }

    public function down(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->dropColumn([
                'description',
                'starts_at',
                'ends_at',
                'max_discount',
                'usage_limit',
                'usage_limit_per_customer',
                'stackable',
                'customer_scope',
                'allowed_channels',
            ]);
        });
    }
};