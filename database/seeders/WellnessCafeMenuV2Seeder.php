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

        $oatsideMilk = Addon::create([
            'name' => 'Change Milk to Oatside',
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
            $oatsideMilk->id,
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
            $oatsideMilk->id,
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

        /*
        |--------------------------------------------------------------------------
        | Production Product Images
        |--------------------------------------------------------------------------
        |
        | Product image files are stored separately on the persistent public
        | storage volume. Restore their database paths after rebuilding the menu.
        |
        */

        $productImages = [
            'Americano' => 'products/XIDnept1UB80XS7kaHD6yHgZ0CaF9fT7uCsqVqFN.png',
            'Latte' => 'products/GIkWJCB2VaMqIsJr0jJhIYts0E36GotVgQO5mGZ7.png',
            'Cappuccino' => 'products/QUZMCsK8rusoHOYdY5v47NTjHghckyvEI0Vr7LM8.png',
            'Spanish Latte' => 'products/oovsM0Ea4Tib2AnoaQ25gl92X37vAuUWNPStysfQ.png',
            'Mocha' => 'products/VphnQlZUEytGF1mPZQo6KVrbpUBKas50rYOugk9y.png',
            'Hazelnut Latte' => 'products/RY5gFeKYa7fWWH4Ks0koa36gFIk9P7gPMbhjZ5pd.png',
            'Salted Caramel Latte' => 'products/YiPsucd9fNLmcZv798JzDN3wSthrMt6oI6dKDFl8.png',
            'Vanilla Latte' => 'products/wPDSCCEkDxYwrcBfyabSiSgqOuOHEF8o3cVLgOci.png',

            'Chocolate' => 'products/oRq1anXodwnf99CvAgYvG3cBniryrAl9CS5JM70F.png',
            'Chocolate Strawberry' => 'products/FIfypoCM8S51JM6RD4znQ5U9LYV3oR9SXzQbHE1D.png',
            'Matcha' => 'products/k9P9TGjPnLznGhZPJVnH00kPq1CnoRurJDFoP89V.png',
            'Matcha Strawberry' => 'products/onkhSbNZWcUcrxPtpNDn46SojLt3dIxtOpy0g92E.png',

            'Blue Mojito' => 'products/2yT6WjrDIzbPxMnSHUcQFMLU94iL7hPBxMGGYHNL.png',
            'Strawberry Mojito' => 'products/O8vWVLkYo96Jf1wHwj5cpbqIB8kSsNMEyn9wYLJ2.png',
            'Apple Mojito' => 'products/SfxZzNqIEGP8qxesa4k2xmedQbJPVGNyHtNzEpnf.png',
            'Strawberry Lemonade' => 'products/I1rakERMOC3CeTAJXUfjwTrqLLKS0lkDE5SN0lEC.png',
            'Lemonade' => 'products/7kIGdbnTb8r8czsjGDNIF0eHuckuGV5XQUneDyaT.png',

            'Earl Grey' => 'products/F3W8tf6GawcHA5SmYrwAvEg42tgEgjH8dplpqHFd.png',
            'Peach Tea' => 'products/GL98F87iO1efjdKjG2jEewL6aQWqFo9rW0TkaLD9.png',
            'Jasmine Tea' => 'products/brHKd4IynkP8v1zhE4dKkg742JeeiEn88bZWrYLQ.png',
            'Oolong Milk Peach Tea' => 'products/dQwDzml8xPnMuZuxcQggvktBAnmyrU2HXe8weB5r.png',
            'Teh BOH' => 'products/SFi6yOLR9R8ciLUHi7GJqtKoQuJD0jCRq6ejr9Zf.png',
        ];

        foreach ($productImages as $name => $imagePath) {
            Product::where('name', $name)->update([
                'image_path' => $imagePath,
            ]);
        }
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