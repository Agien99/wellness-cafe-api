<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['id' => 1, 'name' => 'Super Admin', 'permissions' => ['*']],
            ['id' => 2, 'name' => 'Manager',     'permissions' => ['dashboard','pos','kds','menu','inventory','purchase','customer','promo','refund','reports','audit']],
            ['id' => 3, 'name' => 'Cashier',     'permissions' => ['dashboard','pos','customer']],
            ['id' => 4, 'name' => 'Kitchen',     'permissions' => ['kds']],
            ['id' => 5, 'name' => 'Inventory',   'permissions' => ['dashboard','inventory','purchase']],
        ];

        foreach ($roles as $r) {
            Role::updateOrCreate(['id' => $r['id']], $r);
        }
    }
}
