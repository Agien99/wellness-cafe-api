<?php

namespace Database\Seeders;

use App\Models\Supplier;
use Illuminate\Database\Seeder;

class SupplierSeeder extends Seeder
{
    public function run(): void
    {
        $suppliers = [
            ['id' => 1, 'name' => 'BeanBoss Coffee Roasters',  'category' => 'Coffee Beans',     'contact' => 'Mr. Tan',      'phone' => '0123334441', 'email' => 'wholesale@beanboss.my',   'address' => 'Kuala Lumpur'],
            ['id' => 2, 'name' => 'DairyFresh Sdn Bhd',        'category' => 'Dairy',            'contact' => 'Puan Salmah',  'phone' => '0123334442', 'email' => 'orders@dairyfresh.my',    'address' => 'Petaling Jaya, Selangor'],
            ['id' => 3, 'name' => 'Sweet Syrup Distributors',  'category' => 'Syrups & Sauces',  'contact' => 'Encik Faizal', 'phone' => '0123334443', 'email' => 'sales@sweetsyrup.my',     'address' => 'Shah Alam, Selangor'],
            ['id' => 4, 'name' => 'Tropical Fruit Wholesale',  'category' => 'Fruits & Purees',  'contact' => 'Mr. Chen',     'phone' => '0123334444', 'email' => 'info@tropicalfw.my',      'address' => 'Klang, Selangor'],
            ['id' => 5, 'name' => 'MatchaWorld Premium',       'category' => 'Tea Specialty',    'contact' => 'Mr. Yamato',   'phone' => '0123334445', 'email' => 'sales@matchaworld.my',    'address' => 'Penang'],
            ['id' => 6, 'name' => 'FreshHerbs Garden',         'category' => 'Herbs',            'contact' => 'Puan Maimun',  'phone' => '0123334446', 'email' => 'orders@freshherbs.my',    'address' => 'Cameron Highlands'],
            ['id' => 7, 'name' => 'Tea & Herbs House',         'category' => 'Tea Bags',         'contact' => 'Puan Rohani',  'phone' => '0123334447', 'email' => 'info@teaherbs.my',        'address' => 'Penang'],
            ['id' => 8, 'name' => 'PantryPro Sdn Bhd',         'category' => 'Pantry / Tea',     'contact' => 'Encik Yusof',  'phone' => '0123334448', 'email' => 'sales@pantrypro.my',      'address' => 'Subang, Selangor'],
            ['id' => 9, 'name' => 'Packaging Plus',            'category' => 'Packaging',        'contact' => 'Ms. Lim',      'phone' => '0123334449', 'email' => 'orders@packagingplus.my', 'address' => 'Ipoh, Perak'],
        ];

        foreach ($suppliers as $s) {
            Supplier::updateOrCreate(['id' => $s['id']], $s);
        }
    }
}
