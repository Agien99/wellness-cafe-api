<?php

namespace Database\Seeders;

use App\Models\LoyaltyTier;
use Illuminate\Database\Seeder;

class LoyaltyTierSeeder extends Seeder
{
    public function run(): void
    {
        $tiers = [
            [
                'name' => 'Bronze',
                'minimum_spend' => 0,
                'discount_percentage' => 0,
                'points_multiplier' => 1.0,
                'active' => true,
                'sort_order' => 1,
            ],
            [
                'name' => 'Silver',
                'minimum_spend' => 100,
                'discount_percentage' => 5,
                'points_multiplier' => 1.2,
                'active' => true,
                'sort_order' => 2,
            ],
            [
                'name' => 'Gold',
                'minimum_spend' => 300,
                'discount_percentage' => 8,
                'points_multiplier' => 1.5,
                'active' => true,
                'sort_order' => 3,
            ],
            [
                'name' => 'Platinum',
                'minimum_spend' => 800,
                'discount_percentage' => 12,
                'points_multiplier' => 2.0,
                'active' => true,
                'sort_order' => 4,
            ],
        ];

        foreach ($tiers as $tier) {
            LoyaltyTier::updateOrCreate(
                ['name' => $tier['name']],
                $tier
            );
        }
    }
}