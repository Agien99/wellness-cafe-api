<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            ['username' => 'admin',   'password' => 'admin123',   'name' => 'System Administrator', 'role_id' => 1, 'email' => 'admin@wellnesscafe.upsi.edu.my',   'phone' => '0123456789'],
            ['username' => 'manager', 'password' => 'manager123', 'name' => 'Aisha Rahman',         'role_id' => 2, 'email' => 'manager@wellnesscafe.upsi.edu.my', 'phone' => '0123456790'],
            ['username' => 'cashier', 'password' => 'cashier123', 'name' => 'Hafiz Zulkifli',       'role_id' => 3, 'email' => 'cashier@wellnesscafe.upsi.edu.my', 'phone' => '0123456791'],
            ['username' => 'kitchen', 'password' => 'kitchen123', 'name' => 'Barista Liyana',       'role_id' => 4, 'email' => 'kitchen@wellnesscafe.upsi.edu.my', 'phone' => '0123456792'],
            ['username' => 'stock',   'password' => 'stock123',   'name' => 'Daniel Tan',           'role_id' => 5, 'email' => 'stock@wellnesscafe.upsi.edu.my',   'phone' => '0123456793'],
        ];

        foreach ($users as $u) {
            User::updateOrCreate(
                ['username' => $u['username']],
                array_merge($u, [
                    'password' => Hash::make($u['password']),
                    'active'   => true,
                ])
            );
        }
    }
}
