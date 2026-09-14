<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            UserSeeder::class,
            SupplierSeeder::class,
            InventoryItemSeeder::class,
            CustomerSeeder::class,
            TableSeeder::class,
            PromotionSeeder::class,
            LoyaltyTierSeeder::class,
            WellnessCafeMenuV2Seeder::class,
        ]);
    }
}
