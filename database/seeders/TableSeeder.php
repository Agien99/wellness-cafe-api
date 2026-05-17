<?php

namespace Database\Seeders;

use App\Models\Table;
use Illuminate\Database\Seeder;

class TableSeeder extends Seeder
{
    public function run(): void
    {
        $tables = [
            ['id' => 1, 'name' => 'T1', 'capacity' => 2],
            ['id' => 2, 'name' => 'T2', 'capacity' => 2],
            ['id' => 3, 'name' => 'T3', 'capacity' => 4],
            ['id' => 4, 'name' => 'T4', 'capacity' => 4],
            ['id' => 5, 'name' => 'T5', 'capacity' => 4],
            ['id' => 6, 'name' => 'T6', 'capacity' => 6],
            ['id' => 7, 'name' => 'T7', 'capacity' => 6],
            ['id' => 8, 'name' => 'T8', 'capacity' => 8],
        ];

        foreach ($tables as $t) {
            Table::updateOrCreate(['id' => $t['id']], array_merge($t, ['status' => 'available']));
        }
    }
}
