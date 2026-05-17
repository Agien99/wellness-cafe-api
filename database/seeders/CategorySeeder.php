<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $cats = [
            ['id' => 1, 'name' => 'Brew-tiful Coffee',  'icon' => '☕', 'color' => '#a16207', 'sort_order' => 1],
            ['id' => 2, 'name' => 'Whisked Me Away',    'icon' => '🍫', 'color' => '#7c3aed', 'sort_order' => 2],
            ['id' => 3, 'name' => 'The Mojito Mood',    'icon' => '🍃', 'color' => '#10b981', 'sort_order' => 3],
            ['id' => 4, 'name' => 'Calming Tea Series', 'icon' => '🍵', 'color' => '#0ea5e9', 'sort_order' => 4],
            ['id' => 5, 'name' => 'Specialty (NEW)',    'icon' => '✨', 'color' => '#ec4899', 'sort_order' => 5],
            ['id' => 6, 'name' => 'Boost It Up',        'icon' => '🚀', 'color' => '#f59e0b', 'sort_order' => 6],
        ];

        foreach ($cats as $c) {
            Category::updateOrCreate(['id' => $c['id']], $c);
        }
    }
}
