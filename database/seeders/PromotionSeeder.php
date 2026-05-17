<?php

namespace Database\Seeders;

use App\Models\Promotion;
use Illuminate\Database\Seeder;

class PromotionSeeder extends Seeder
{
    public function run(): void
    {
        $promos = [
            ['id' => 1, 'code' => 'WELCOME10',  'name' => 'Welcome Promo 10%',    'type' => 'percent', 'value' => 10, 'min_order' => 15, 'valid_till' => '2026-12-31', 'active' => true],
            ['id' => 2, 'code' => 'STUDENT5',   'name' => 'UPSI Student Discount','type' => 'percent', 'value' => 5,  'min_order' => 0,  'valid_till' => '2026-12-31', 'active' => true],
            ['id' => 3, 'code' => 'HAPPYHOUR',  'name' => 'Happy Hour RM2 Off',   'type' => 'fixed',   'value' => 2,  'min_order' => 10, 'valid_till' => '2026-06-30', 'active' => true],
            ['id' => 4, 'code' => 'WELLNESS20', 'name' => 'Anniversary 20%',      'type' => 'percent', 'value' => 20, 'min_order' => 25, 'valid_till' => '2026-05-31', 'active' => true],
        ];

        foreach ($promos as $p) {
            Promotion::updateOrCreate(['id' => $p['id']], $p);
        }
    }
}
