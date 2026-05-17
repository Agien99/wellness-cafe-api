<?php

namespace Database\Seeders;

use App\Models\Product;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        // Real Wellness Cafe menu (Ground Floor, Block 7, FPM, UPSI)
        // Each row: id, name, category_id, price, cost, image, size, recipe[]
        $products = [
            // ===== Brew-tiful Coffee =====
            [1,  'Americano (S)',            1, 4.50,  1.20, '☕', 'S',    [['ingredient_id'=>1,'qty'=>1]]],
            [2,  'Americano (M)',            1, 5.50,  1.40, '☕', 'M',    [['ingredient_id'=>1,'qty'=>1]]],
            [3,  'Americano (Iced)',         1, 6.00,  1.60, '🧊', 'Iced', [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>20,'qty'=>1]]],
            [4,  'Latte (S)',                1, 5.50,  1.60, '☕', 'S',    [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.15]]],
            [5,  'Latte (M)',                1, 7.50,  2.20, '☕', 'M',    [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.20]]],
            [6,  'Latte (Iced)',             1, 8.00,  2.40, '🧊', 'Iced', [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.20],['ingredient_id'=>20,'qty'=>1]]],
            [7,  'Cappuccino (S)',           1, 5.50,  1.60, '☕', 'S',    [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.15]]],
            [8,  'Cappuccino (M)',           1, 7.50,  2.20, '☕', 'M',    [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.20]]],
            [9,  'Cappuccino (Iced)',        1, 8.00,  2.40, '🧊', 'Iced', [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.20],['ingredient_id'=>20,'qty'=>1]]],
            [10, 'Spanish Latte (S)',        1, 7.50,  2.30, '☕', 'S',    [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.15],['ingredient_id'=>3,'qty'=>0.03]]],
            [11, 'Spanish Latte (M)',        1, 9.50,  2.90, '☕', 'M',    [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.20],['ingredient_id'=>3,'qty'=>0.04]]],
            [12, 'Spanish Latte (Iced)',     1, 10.00, 3.10, '🧊', 'Iced', [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.20],['ingredient_id'=>3,'qty'=>0.04],['ingredient_id'=>20,'qty'=>1]]],
            [13, 'Mocha (S)',                1, 7.50,  2.40, '☕', 'S',    [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.15],['ingredient_id'=>4,'qty'=>0.03]]],
            [14, 'Mocha (M)',                1, 9.50,  3.00, '☕', 'M',    [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.20],['ingredient_id'=>4,'qty'=>0.04]]],
            [15, 'Mocha (Iced)',             1, 10.00, 3.20, '🧊', 'Iced', [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.20],['ingredient_id'=>4,'qty'=>0.04],['ingredient_id'=>20,'qty'=>1]]],
            [16, 'Hazelnut Latte (S)',       1, 7.50,  2.30, '☕', 'S',    [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.15],['ingredient_id'=>5,'qty'=>0.02]]],
            [17, 'Hazelnut Latte (M)',       1, 9.50,  2.90, '☕', 'M',    [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.20],['ingredient_id'=>5,'qty'=>0.03]]],
            [18, 'Hazelnut Latte (Iced)',    1, 10.00, 3.10, '🧊', 'Iced', [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.20],['ingredient_id'=>5,'qty'=>0.03],['ingredient_id'=>20,'qty'=>1]]],
            [19, 'Salted Caramel Latte (S)', 1, 7.50,  2.30, '☕', 'S',    [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.15],['ingredient_id'=>6,'qty'=>0.02]]],
            [20, 'Salted Caramel Latte (M)', 1, 9.50,  2.90, '☕', 'M',    [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.20],['ingredient_id'=>6,'qty'=>0.03]]],
            [21, 'Salted Caramel Latte (Iced)',1,10.00,3.10, '🧊', 'Iced', [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.20],['ingredient_id'=>6,'qty'=>0.03],['ingredient_id'=>20,'qty'=>1]]],
            [22, 'Vanilla Latte (S)',        1, 7.50,  2.30, '☕', 'S',    [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.15],['ingredient_id'=>7,'qty'=>0.02]]],
            [23, 'Vanilla Latte (M)',        1, 9.50,  2.90, '☕', 'M',    [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.20],['ingredient_id'=>7,'qty'=>0.03]]],
            [24, 'Vanilla Latte (Iced)',     1, 10.00, 3.10, '🧊', 'Iced', [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>2,'qty'=>0.20],['ingredient_id'=>7,'qty'=>0.03],['ingredient_id'=>20,'qty'=>1]]],

            // ===== Whisked Me Away =====
            [25, 'Chocolate (S)',                  2, 5.50,  1.80, '🍫', 'S',    [['ingredient_id'=>4,'qty'=>0.04],['ingredient_id'=>2,'qty'=>0.20]]],
            [26, 'Chocolate (M)',                  2, 7.50,  2.30, '🍫', 'M',    [['ingredient_id'=>4,'qty'=>0.05],['ingredient_id'=>2,'qty'=>0.25]]],
            [27, 'Chocolate (Iced)',               2, 8.00,  2.50, '🧊', 'Iced', [['ingredient_id'=>4,'qty'=>0.05],['ingredient_id'=>2,'qty'=>0.25],['ingredient_id'=>20,'qty'=>1]]],
            [28, 'Chocolate Strawberry (Iced)',    2, 10.00, 3.50, '🍓', 'Iced', [['ingredient_id'=>4,'qty'=>0.05],['ingredient_id'=>2,'qty'=>0.25],['ingredient_id'=>8,'qty'=>0.03],['ingredient_id'=>20,'qty'=>1]]],
            [29, 'Matcha (S)',                     2, 7.00,  2.20, '🍵', 'S',    [['ingredient_id'=>9,'qty'=>0.005],['ingredient_id'=>2,'qty'=>0.20]]],
            [30, 'Matcha (M)',                     2, 9.00,  2.80, '🍵', 'M',    [['ingredient_id'=>9,'qty'=>0.007],['ingredient_id'=>2,'qty'=>0.25]]],
            [31, 'Matcha (Iced)',                  2, 10.00, 3.00, '🧊', 'Iced', [['ingredient_id'=>9,'qty'=>0.007],['ingredient_id'=>2,'qty'=>0.25],['ingredient_id'=>20,'qty'=>1]]],
            [32, 'Matcha Strawberry (Iced)',       2, 12.00, 4.00, '🍓', 'Iced', [['ingredient_id'=>9,'qty'=>0.007],['ingredient_id'=>2,'qty'=>0.25],['ingredient_id'=>8,'qty'=>0.03],['ingredient_id'=>20,'qty'=>1]]],

            // ===== The Mojito Mood =====
            [33, 'Blue Mojito',          3, 6.00, 1.80, '🍹', 'Iced', [['ingredient_id'=>10,'qty'=>0.03],['ingredient_id'=>11,'qty'=>5],['ingredient_id'=>20,'qty'=>1]]],
            [34, 'Strawberry Mojito',    3, 6.00, 1.80, '🍹', 'Iced', [['ingredient_id'=>8,'qty'=>0.03],['ingredient_id'=>11,'qty'=>5],['ingredient_id'=>20,'qty'=>1]]],
            [35, 'Apple Mojito',         3, 6.00, 1.80, '🍏', 'Iced', [['ingredient_id'=>12,'qty'=>0.03],['ingredient_id'=>11,'qty'=>5],['ingredient_id'=>20,'qty'=>1]]],
            [36, 'Strawberry Lemonade',  3, 5.00, 1.50, '🍋', 'Iced', [['ingredient_id'=>8,'qty'=>0.03],['ingredient_id'=>13,'qty'=>1],['ingredient_id'=>20,'qty'=>1]]],
            [37, 'Lemonade',             3, 4.00, 1.20, '🍋', 'Iced', [['ingredient_id'=>13,'qty'=>1],['ingredient_id'=>20,'qty'=>1]]],

            // ===== Calming Tea Series =====
            [38, 'Earl Grey (S)',                3, 4.00, 1.00, '🍵', 'S',    [['ingredient_id'=>14,'qty'=>1]]],
            [39, 'Earl Grey (M)',                4, 5.50, 1.30, '🍵', 'M',    [['ingredient_id'=>14,'qty'=>1]]],
            [40, 'Earl Grey (Iced)',             4, 6.00, 1.50, '🧊', 'Iced', [['ingredient_id'=>14,'qty'=>1],['ingredient_id'=>20,'qty'=>1]]],
            [41, 'Peach Tea (S)',                4, 4.00, 1.00, '🍑', 'S',    [['ingredient_id'=>15,'qty'=>1]]],
            [42, 'Peach Tea (M)',                4, 5.50, 1.30, '🍑', 'M',    [['ingredient_id'=>15,'qty'=>1]]],
            [43, 'Peach Tea (Iced)',             4, 6.00, 1.50, '🧊', 'Iced', [['ingredient_id'=>15,'qty'=>1],['ingredient_id'=>20,'qty'=>1]]],
            [44, 'Jasmine Tea (S)',              4, 4.00, 1.00, '🌸', 'S',    [['ingredient_id'=>16,'qty'=>1]]],
            [45, 'Jasmine Tea (M)',              4, 5.50, 1.30, '🌸', 'M',    [['ingredient_id'=>16,'qty'=>1]]],
            [46, 'Jasmine Tea (Iced)',           4, 6.00, 1.50, '🧊', 'Iced', [['ingredient_id'=>16,'qty'=>1],['ingredient_id'=>20,'qty'=>1]]],
            [47, 'Oolong Milk Peach Tea (Iced)', 4, 9.00, 2.80, '🧊', 'Iced', [['ingredient_id'=>17,'qty'=>1],['ingredient_id'=>15,'qty'=>1],['ingredient_id'=>2,'qty'=>0.20],['ingredient_id'=>20,'qty'=>1]]],
            [48, 'Teh BOH (S)',                  4, 2.00, 0.60, '🍵', 'S',    [['ingredient_id'=>18,'qty'=>1]]],
            [49, 'Teh BOH (M)',                  4, 3.50, 0.90, '🍵', 'M',    [['ingredient_id'=>18,'qty'=>1]]],
            [50, 'Teh BOH (Iced)',               4, 4.00, 1.10, '🧊', 'Iced', [['ingredient_id'=>18,'qty'=>1],['ingredient_id'=>20,'qty'=>1]]],

            // ===== Specialty (NEW) =====
            [51, 'Americano Strawberry ✨NEW',    5, 7.00,  2.20, '🍓', 'Iced', [['ingredient_id'=>1,'qty'=>1],['ingredient_id'=>8,'qty'=>0.03],['ingredient_id'=>20,'qty'=>1]]],
            [52, 'Mango Matcha ✨NEW',            5, 12.00, 4.00, '🥭', 'Iced', [['ingredient_id'=>9,'qty'=>0.007],['ingredient_id'=>19,'qty'=>0.05],['ingredient_id'=>2,'qty'=>0.20],['ingredient_id'=>20,'qty'=>1]]],
            [53, 'Chocolate Matcha ✨NEW',        5, 12.00, 4.20, '🍫', 'Iced', [['ingredient_id'=>9,'qty'=>0.007],['ingredient_id'=>4,'qty'=>0.04],['ingredient_id'=>2,'qty'=>0.20],['ingredient_id'=>20,'qty'=>1]]],

            // ===== Boost It Up (Add-ons) =====
            [54, 'Change Milk to Oatside', 6, 3.00, 1.50, '🥛', '-', [['ingredient_id'=>21,'qty'=>0.20]]],
            [55, 'Extra Shot',             6, 2.00, 0.70, '☕', '-', [['ingredient_id'=>1,'qty'=>1]]],
            [56, 'Caramel Syrup',          6, 1.00, 0.20, '🍯', '-', [['ingredient_id'=>6,'qty'=>0.02]]],
            [57, 'Hazelnut Syrup',         6, 1.00, 0.20, '🥜', '-', [['ingredient_id'=>5,'qty'=>0.02]]],
            [58, 'Vanilla Syrup',          6, 1.00, 0.20, '🌼', '-', [['ingredient_id'=>7,'qty'=>0.02]]],
            [59, 'Sugar',                  6, 0.50, 0.05, '🍚', '-', [['ingredient_id'=>22,'qty'=>0.01]]],
        ];

        foreach ($products as $p) {
            Product::updateOrCreate(['id' => $p[0]], [
                'id'          => $p[0],
                'name'        => $p[1],
                'category_id' => $p[2],
                'price'       => $p[3],
                'cost'        => $p[4],
                'image'       => $p[5],
                'size'        => $p[6],
                'recipe'      => $p[7],
                'available'   => true,
            ]);
        }
    }
}
