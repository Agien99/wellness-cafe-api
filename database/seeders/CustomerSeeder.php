<?php

namespace Database\Seeders;

use App\Models\Customer;
use Illuminate\Database\Seeder;

class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        $customers = [
            ['id' => 1, 'name' => 'Nurul Aina',       'phone' => '0192223331', 'email' => 'aina@upsi.edu.my',    'membership' => 'Gold',     'points' => 850,  'total_spent' => 425.50, 'joined_at' => '2026-02-10'],
            ['id' => 2, 'name' => 'Ahmad Faris',      'phone' => '0192223332', 'email' => 'faris@upsi.edu.my',   'membership' => 'Silver',   'points' => 320,  'total_spent' => 178.90, 'joined_at' => '2026-03-05'],
            ['id' => 3, 'name' => 'Siti Nurhaliza',   'phone' => '0192223333', 'email' => 'siti@upsi.edu.my',    'membership' => 'Platinum', 'points' => 1820, 'total_spent' => 912.30, 'joined_at' => '2026-01-15'],
            ['id' => 4, 'name' => 'Kevin Lim',        'phone' => '0192223334', 'email' => 'kevin@upsi.edu.my',   'membership' => 'Silver',   'points' => 240,  'total_spent' => 142.60, 'joined_at' => '2026-04-01'],
            ['id' => 5, 'name' => 'Priya Devi',       'phone' => '0192223335', 'email' => 'priya@upsi.edu.my',   'membership' => 'Gold',     'points' => 640,  'total_spent' => 318.40, 'joined_at' => '2026-02-22'],
            ['id' => 6, 'name' => 'Tan Wei Ming',     'phone' => '0192223336', 'email' => 'weiming@upsi.edu.my', 'membership' => 'Bronze',   'points' => 90,   'total_spent' => 58.00,  'joined_at' => '2026-04-18'],
            ['id' => 7, 'name' => 'Farah Husna',      'phone' => '0192223337', 'email' => 'farah@upsi.edu.my',   'membership' => 'Gold',     'points' => 720,  'total_spent' => 362.10, 'joined_at' => '2026-02-28'],
            ['id' => 8, 'name' => 'Walk-in Customer', 'phone' => null,         'email' => null,                  'membership' => 'None',     'points' => 0,    'total_spent' => 0,      'joined_at' => '2026-01-01'],
        ];

        foreach ($customers as $c) {
            Customer::updateOrCreate(['id' => $c['id']], $c);
        }
    }
}
