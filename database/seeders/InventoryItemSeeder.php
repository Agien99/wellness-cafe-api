<?php

namespace Database\Seeders;

use App\Models\InventoryItem;
use Illuminate\Database\Seeder;

class InventoryItemSeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            ['id' => 1,  'name' => 'Espresso Shot',           'unit' => 'shot',  'stock' => 320, 'reorder_level' => 100, 'cost_per_unit' => 0.90,   'supplier_id' => 1],
            ['id' => 2,  'name' => 'Fresh Milk',              'unit' => 'L',     'stock' => 28,  'reorder_level' => 10,  'cost_per_unit' => 7.50,   'supplier_id' => 2],
            ['id' => 3,  'name' => 'Sweetened Condensed Milk','unit' => 'L',     'stock' => 6,   'reorder_level' => 2,   'cost_per_unit' => 18.00,  'supplier_id' => 2],
            ['id' => 4,  'name' => 'Chocolate Sauce',         'unit' => 'L',     'stock' => 4,   'reorder_level' => 2,   'cost_per_unit' => 26.00,  'supplier_id' => 3],
            ['id' => 5,  'name' => 'Hazelnut Syrup',          'unit' => 'L',     'stock' => 3,   'reorder_level' => 1,   'cost_per_unit' => 32.00,  'supplier_id' => 3],
            ['id' => 6,  'name' => 'Caramel Syrup',           'unit' => 'L',     'stock' => 3,   'reorder_level' => 1,   'cost_per_unit' => 30.00,  'supplier_id' => 3],
            ['id' => 7,  'name' => 'Vanilla Syrup',           'unit' => 'L',     'stock' => 3,   'reorder_level' => 1,   'cost_per_unit' => 28.00,  'supplier_id' => 3],
            ['id' => 8,  'name' => 'Strawberry Puree',        'unit' => 'L',     'stock' => 4,   'reorder_level' => 1,   'cost_per_unit' => 36.00,  'supplier_id' => 4],
            ['id' => 9,  'name' => 'Matcha Powder',           'unit' => 'kg',    'stock' => 1.2, 'reorder_level' => 0.5, 'cost_per_unit' => 180.00, 'supplier_id' => 5],
            ['id' => 10, 'name' => 'Blue Curacao Syrup',      'unit' => 'L',     'stock' => 2,   'reorder_level' => 1,   'cost_per_unit' => 28.00,  'supplier_id' => 3],
            ['id' => 11, 'name' => 'Mint Leaves',             'unit' => 'leaf',  'stock' => 400, 'reorder_level' => 150, 'cost_per_unit' => 0.05,   'supplier_id' => 6],
            ['id' => 12, 'name' => 'Apple Syrup',             'unit' => 'L',     'stock' => 2,   'reorder_level' => 1,   'cost_per_unit' => 26.00,  'supplier_id' => 3],
            ['id' => 13, 'name' => 'Lemon',                   'unit' => 'pcs',   'stock' => 50,  'reorder_level' => 20,  'cost_per_unit' => 1.20,   'supplier_id' => 4],
            ['id' => 14, 'name' => 'Earl Grey Tea Bag',       'unit' => 'pcs',   'stock' => 90,  'reorder_level' => 30,  'cost_per_unit' => 0.80,   'supplier_id' => 7],
            ['id' => 15, 'name' => 'Peach Tea Bag',           'unit' => 'pcs',   'stock' => 85,  'reorder_level' => 30,  'cost_per_unit' => 0.85,   'supplier_id' => 7],
            ['id' => 16, 'name' => 'Jasmine Tea Bag',         'unit' => 'pcs',   'stock' => 80,  'reorder_level' => 30,  'cost_per_unit' => 0.80,   'supplier_id' => 7],
            ['id' => 17, 'name' => 'Oolong Tea Bag',          'unit' => 'pcs',   'stock' => 50,  'reorder_level' => 20,  'cost_per_unit' => 1.20,   'supplier_id' => 7],
            ['id' => 18, 'name' => 'Teh BOH Tea Bag',         'unit' => 'pcs',   'stock' => 120, 'reorder_level' => 50,  'cost_per_unit' => 0.30,   'supplier_id' => 8],
            ['id' => 19, 'name' => 'Mango Puree',             'unit' => 'L',     'stock' => 3,   'reorder_level' => 1,   'cost_per_unit' => 38.00,  'supplier_id' => 4],
            ['id' => 20, 'name' => 'Ice',                     'unit' => 'cup',   'stock' => 500, 'reorder_level' => 200, 'cost_per_unit' => 0.10,   'supplier_id' => 9],
            ['id' => 21, 'name' => 'Oat Milk (Oatside)',      'unit' => 'L',     'stock' => 5,   'reorder_level' => 2,   'cost_per_unit' => 22.00,  'supplier_id' => 2],
            ['id' => 22, 'name' => 'Sugar',                   'unit' => 'kg',    'stock' => 8,   'reorder_level' => 3,   'cost_per_unit' => 4.50,   'supplier_id' => 8],
            ['id' => 23, 'name' => 'Whipped Cream',           'unit' => 'L',     'stock' => 2,   'reorder_level' => 1,   'cost_per_unit' => 22.00,  'supplier_id' => 2],
            ['id' => 24, 'name' => 'Paper Cup (S)',           'unit' => 'pcs',   'stock' => 250, 'reorder_level' => 100, 'cost_per_unit' => 0.18,   'supplier_id' => 9],
            ['id' => 25, 'name' => 'Paper Cup (M)',           'unit' => 'pcs',   'stock' => 200, 'reorder_level' => 100, 'cost_per_unit' => 0.22,   'supplier_id' => 9],
            ['id' => 26, 'name' => 'Plastic Cup (Iced)',      'unit' => 'pcs',   'stock' => 300, 'reorder_level' => 100, 'cost_per_unit' => 0.25,   'supplier_id' => 9],
        ];

        foreach ($items as $i) {
            InventoryItem::updateOrCreate(['id' => $i['id']], $i);
        }
    }
}
