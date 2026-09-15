<?php

namespace Database\Seeders;

use App\Models\Addon;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class WellnessCafeMenuV2Seeder extends Seeder
{
    public function run(): void
    {
        /*
        |--------------------------------------------------------------------------
        | Clear existing menu/catalog data
        |--------------------------------------------------------------------------
        |
        | This seeder is intended to rebuild the development menu from scratch.
        | Do NOT run this against production order data.
        |
        */

        Schema::disableForeignKeyConstraints();

        DB::table('product_variant_values')->truncate();
        DB::table('product_addons')->truncate();
        DB::table('product_variants')->truncate();
        DB::table('product_option_values')->truncate();
        DB::table('product_option_groups')->truncate();
        DB::table('addons')->truncate();
        DB::table('products')->truncate();
        DB::table('categories')->truncate();

        Schema::enableForeignKeyConstraints();

        /*
        |--------------------------------------------------------------------------
        | Categories
        |--------------------------------------------------------------------------
        */

        $coffee = Category::create([
            'name' => 'Brew-tiful Coffee',
            'icon' => '☕',
            'sort_order' => 1,
        ]);

        $whisked = Category::create([
            'name' => 'Whisked Me Away',
            'icon' => '🥛',
            'sort_order' => 2,
        ]);

        $mojito = Category::create([
            'name' => 'The Mojito Mood',
            'icon' => '🍋',
            'sort_order' => 3,
        ]);

        $tea = Category::create([
            'name' => 'Calming Tea Series',
            'icon' => '🍵',
            'sort_order' => 4,
        ]);

        /*
        |--------------------------------------------------------------------------
        | Global Add-ons — "Boost It Up!"
        |--------------------------------------------------------------------------
        */

        $outsideMilk = Addon::create([
            'name' => 'Change Milk to Outside',
            'price' => 3.00,
            'available' => true,
            'sort_order' => 1,
        ]);

        $extraShot = Addon::create([
            'name' => 'Extra Shot',
            'price' => 2.00,
            'available' => true,
            'sort_order' => 2,
        ]);

        $caramelSyrup = Addon::create([
            'name' => 'Caramel Syrup',
            'price' => 1.00,
            'available' => true,
            'sort_order' => 3,
        ]);

        $hazelnutSyrup = Addon::create([
            'name' => 'Hazelnut Syrup',
            'price' => 1.00,
            'available' => true,
            'sort_order' => 4,
        ]);

        $vanillaSyrup = Addon::create([
            'name' => 'Vanilla Syrup',
            'price' => 1.00,
            'available' => true,
            'sort_order' => 5,
        ]);

        $sugar = Addon::create([
            'name' => 'Sugar',
            'price' => 0.50,
            'available' => true,
            'sort_order' => 6,
        ]);

        /*
        |--------------------------------------------------------------------------
        | Brew-tiful Coffee
        |--------------------------------------------------------------------------
        */

        $coffeeAddons = [
            $outsideMilk->id,
            $extraShot->id,
            $caramelSyrup->id,
            $hazelnutSyrup->id,
            $vanillaSyrup->id,
            $sugar->id,
        ];

        $this->createSMIcedProduct(
            $coffee,
            'Americano',
            4.50,
            5.50,
            6.00,
            $coffeeAddons
        );

        $this->createSMIcedProduct(
            $coffee,
            'Latte',
            5.50,
            7.50,
            8.00,
            $coffeeAddons
        );

        $this->createSMIcedProduct(
            $coffee,
            'Cappuccino',
            5.50,
            7.50,
            8.00,
            $coffeeAddons
        );

        $this->createSMIcedProduct(
            $coffee,
            'Spanish Latte',
            7.50,
            9.50,
            10.00,
            $coffeeAddons
        );

        $this->createSMIcedProduct(
            $coffee,
            'Mocha',
            7.50,
            9.50,
            10.00,
            $coffeeAddons
        );

        $this->createSMIcedProduct(
            $coffee,
            'Hazelnut Latte',
            7.50,
            9.50,
            10.00,
            $coffeeAddons
        );

        $this->createSMIcedProduct(
            $coffee,
            'Salted Caramel Latte',
            7.50,
            9.50,
            10.00,
            $coffeeAddons
        );

        $this->createSMIcedProduct(
            $coffee,
            'Vanilla Latte',
            7.50,
            9.50,
            10.00,
            $coffeeAddons
        );

        /*
        |--------------------------------------------------------------------------
        | Whisked Me Away
        |--------------------------------------------------------------------------
        */

        $milkAddons = [
            $outsideMilk->id,
            $caramelSyrup->id,
            $hazelnutSyrup->id,
            $vanillaSyrup->id,
            $sugar->id,
        ];

        $this->createSMIcedProduct(
            $whisked,
            'Chocolate',
            5.50,
            7.50,
            8.00,
            $milkAddons
        );

        /*
         * Menu shows Chocolate Strawberry only as Iced RM10.
         */
        $this->createIcedProduct(
            $whisked,
            'Chocolate Strawberry',
            10.00,
            $milkAddons
        );

        $this->createSMIcedProduct(
            $whisked,
            'Matcha',
            7.00,
            9.00,
            10.00,
            $milkAddons
        );

        /*
         * Menu shows Matcha Strawberry only as Iced RM12.
         */
        $this->createIcedProduct(
            $whisked,
            'Matcha Strawberry',
            12.00,
            $milkAddons
        );

        /*
        |--------------------------------------------------------------------------
        | The Mojito Mood
        |--------------------------------------------------------------------------
        */

        $this->createSimpleProduct(
            $mojito,
            'Blue Mojito',
            6.00
        );

        $this->createSimpleProduct(
            $mojito,
            'Strawberry Mojito',
            6.00
        );

        $this->createSimpleProduct(
            $mojito,
            'Apple Mojito',
            6.00
        );

        $this->createSimpleProduct(
            $mojito,
            'Strawberry Lemonade',
            5.00
        );

        $this->createSimpleProduct(
            $mojito,
            'Lemonade',
            4.00
        );

        /*
        |--------------------------------------------------------------------------
        | Calming Tea Series
        |--------------------------------------------------------------------------
        */

        $teaAddons = [
            $sugar->id,
        ];

        $this->createSMIcedProduct(
            $tea,
            'Earl Grey',
            4.00,
            5.50,
            6.00,
            $teaAddons
        );

        $this->createSMIcedProduct(
            $tea,
            'Peach Tea',
            4.00,
            5.50,
            6.00,
            $teaAddons
        );

        $this->createSMIcedProduct(
            $tea,
            'Jasmine Tea',
            4.00,
            5.50,
            6.00,
            $teaAddons
        );

        /*
         * Menu only shows Iced RM9.
         */
        $this->createIcedProduct(
            $tea,
            'Oolong Milk Peach Tea',
            9.00,
            $teaAddons
        );

        $this->createSMIcedProduct(
            $tea,
            'Teh BOH',
            2.00,
            3.50,
            4.00,
            $teaAddons
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Product Helpers
    |--------------------------------------------------------------------------
    */

    private function createSMIcedProduct(
        Category $category,
        string $name,
        float $smallPrice,
        float $mediumPrice,
        float $icedPrice,
        array $addonIds = []
    ): Product {
        $product = $this->createBaseConfigurableProduct(
            $category,
            $name
        );

        /*
         * We deliberately model the menu's S / M / Iced choices
         * as one option group because these are the actual
         * purchasable choices printed on the cafe menu.
         */
        $group = $product->optionGroups()->create([
            'name' => 'Choice',
            'required' => true,
            'multiple' => false,
            'sort_order' => 1,
        ]);

        $small = $group->values()->create([
            'name' => 'Small',
            'available' => true,
            'sort_order' => 1,
        ]);

        $medium = $group->values()->create([
            'name' => 'Medium',
            'available' => true,
            'sort_order' => 2,
        ]);

        $iced = $group->values()->create([
            'name' => 'Iced',
            'available' => true,
            'sort_order' => 3,
        ]);

        $this->createVariant(
            $product,
            'Small',
            $smallPrice,
            [$small->id],
            1
        );

        $this->createVariant(
            $product,
            'Medium',
            $mediumPrice,
            [$medium->id],
            2
        );

        $this->createVariant(
            $product,
            'Iced',
            $icedPrice,
            [$iced->id],
            3
        );

        $product->addons()->sync($addonIds);

        return $product;
    }

    private function createIcedProduct(
        Category $category,
        string $name,
        float $price,
        array $addonIds = []
    ): Product {
        $product = $this->createBaseConfigurableProduct(
            $category,
            $name
        );

        $group = $product->optionGroups()->create([
            'name' => 'Choice',
            'required' => true,
            'multiple' => false,
            'sort_order' => 1,
        ]);

        $iced = $group->values()->create([
            'name' => 'Iced',
            'available' => true,
            'sort_order' => 1,
        ]);

        $this->createVariant(
            $product,
            'Iced',
            $price,
            [$iced->id],
            1
        );

        $product->addons()->sync($addonIds);

        return $product;
    }

    private function createSimpleProduct(
        Category $category,
        string $name,
        float $price
    ): Product {
        return Product::create([
            'category_id' => $category->id,
            'name' => $name,
            'size' => null,
            'price' => $price,
            'cost' => 0,
            'available' => true,
            'visible' => true,
            'product_type' => 'simple',
            'recipe' => [],
        ]);
    }

    private function createBaseConfigurableProduct(
        Category $category,
        string $name
    ): Product {
        return Product::create([
            'category_id' => $category->id,
            'name' => $name,
            'size' => null,

            /*
             * Configurable product pricing comes from variants.
             */
            'price' => 0,

            'cost' => 0,
            'available' => true,
            'visible' => true,
            'product_type' => 'configurable',
            'recipe' => [],
        ]);
    }

    private function createVariant(
        Product $product,
        string $name,
        float $price,
        array $optionValueIds,
        int $sortOrder
    ): void {
        $variant = $product->variants()->create([
            'name' => $name,
            'price' => $price,
            'available' => true,
            'sort_order' => $sortOrder,
        ]);

        $variant->optionValues()->sync(
            $optionValueIds
        );
    }
}