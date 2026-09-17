<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['username' => 'wellness'],
            [
                'name' => 'Wellness Centre',
                'email' => 'wellness@wellnesscafe.upsi.edu.my',
                'phone' => null,
                'password' => Hash::make('Wellnesscentre@1'),
                'role_id' => 1,
                'active' => true,
            ]
        );
    }
}