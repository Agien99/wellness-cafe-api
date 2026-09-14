<?php

namespace Tests\Feature;

use App\Models\Addon;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\OrderService;
use Database\Seeders\LoyaltyTierSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ProductV2OrderTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(LoyaltyTierSeeder::class);
    }

    private function createCustomer(): Customer
    {
        return Customer::create([
            'name' => 'Product V2 Customer',
            'phone' => '0129999999',
            'email' => 'productv2@example.com',
            'membership' => 'Bronze',
            'points' => 0,
            'total_spent' => 0,
            'joined_at' => now()->toDateString(),
        ]);
    }

    private function createCategory(): Category
    {
        return Category::create([
            'name' => 'Product V2 Test',
            'icon' => null,
            'color' => null,
            'sort_order' => 1,
        ]);
    }

    private function createSimpleProduct(
        float $price = 5.00
    ): Product {
        $category = $this->createCategory();

        return Product::create([
            'category_id' => $category->id,
            'name' => 'Cheesecake',
            'size' => null,
            'price' => $price,
            'cost' => 1,
            'available' => true,
            'visible' => true,
            'product_type' => 'simple',
            'recipe' => [],
        ]);
    }

    private function createConfigurableProduct(
        string $name = 'Coffee',
        float $variantPrice = 7.00,
        bool $variantAvailable = true
    ): array {
        $category = $this->createCategory();

        $product = Product::create([
            'category_id' => $category->id,
            'name' => $name,
            'size' => null,
            'price' => 0,
            'cost' => 1,
            'available' => true,
            'visible' => true,
            'product_type' => 'configurable',
            'recipe' => [],
        ]);

        $sizeGroup = $product->optionGroups()->create([
            'name' => 'Size',
            'required' => true,
            'multiple' => false,
            'sort_order' => 1,
        ]);

        $large = $sizeGroup->values()->create([
            'name' => 'Large',
            'available' => true,
            'sort_order' => 1,
        ]);

        $temperatureGroup =
            $product->optionGroups()->create([
                'name' => 'Temperature',
                'required' => true,
                'multiple' => false,
                'sort_order' => 2,
            ]);

        $cold = $temperatureGroup->values()->create([
            'name' => 'Cold',
            'available' => true,
            'sort_order' => 1,
        ]);

        $variant = $product->variants()->create([
            'name' => 'Large + Cold',
            'price' => $variantPrice,
            'available' => $variantAvailable,
            'sort_order' => 1,
        ]);

        $variant->optionValues()->sync([
            $large->id,
            $cold->id,
        ]);

        return [
            $product,
            $variant,
        ];
    }

    private function service(): OrderService
    {
        return app(OrderService::class);
    }

    public function test_simple_product_still_works(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createSimpleProduct(7.50);

        $order = $this->service()->create([
            'customer_id' => $customer->id,
            'channel' => 'qr',
            'items' => [
                [
                    'product_id' => $product->id,
                    'qty' => 1,
                ],
            ],
        ]);

        $this->assertSame(
            7.50,
            (float) $order->subtotal
        );

        $this->assertSame(
            7.50,
            (float) $order->items->first()->price
        );

        $this->assertNull(
            $order->items->first()->product_variant_id
        );
    }

    public function test_configurable_product_requires_variant(): void
    {
        $customer = $this->createCustomer();

        [$product] =
            $this->createConfigurableProduct();

        $this->expectException(
            ValidationException::class
        );

        $this->service()->create([
            'customer_id' => $customer->id,
            'channel' => 'qr',
            'items' => [
                [
                    'product_id' => $product->id,
                    'qty' => 1,
                ],
            ],
        ]);
    }

    public function test_variant_must_belong_to_product(): void
    {
        $customer = $this->createCustomer();

        [$coffee] =
            $this->createConfigurableProduct(
                'Coffee'
            );

        [, $teaVariant] =
            $this->createConfigurableProduct(
                'Tea'
            );

        $this->expectException(
            ValidationException::class
        );

        $this->service()->create([
            'customer_id' => $customer->id,
            'channel' => 'qr',
            'items' => [
                [
                    'product_id' => $coffee->id,
                    'product_variant_id' =>
                        $teaVariant->id,
                    'qty' => 1,
                ],
            ],
        ]);
    }

    public function test_unavailable_variant_is_rejected(): void
    {
        $customer = $this->createCustomer();

        [$product, $variant] =
            $this->createConfigurableProduct(
                'Coffee',
                7.00,
                false
            );

        $this->expectException(
            ValidationException::class
        );

        $this->service()->create([
            'customer_id' => $customer->id,
            'channel' => 'qr',
            'items' => [
                [
                    'product_id' => $product->id,
                    'product_variant_id' =>
                        $variant->id,
                    'qty' => 1,
                ],
            ],
        ]);
    }

    public function test_valid_addons_are_added_to_price(): void
    {
        $customer = $this->createCustomer();

        [$product, $variant] =
            $this->createConfigurableProduct(
                'Coffee',
                7.00
            );

        $extraShot = Addon::create([
            'name' => 'Extra Shot',
            'price' => 1.50,
            'available' => true,
            'sort_order' => 1,
        ]);

        $oatMilk = Addon::create([
            'name' => 'Oat Milk',
            'price' => 2.00,
            'available' => true,
            'sort_order' => 2,
        ]);

        $product->addons()->sync([
            $extraShot->id,
            $oatMilk->id,
        ]);

        $order = $this->service()->create([
            'customer_id' => $customer->id,
            'channel' => 'qr',
            'items' => [
                [
                    'product_id' => $product->id,
                    'product_variant_id' =>
                        $variant->id,
                    'addon_ids' => [
                        $extraShot->id,
                        $oatMilk->id,
                    ],
                    'qty' => 1,
                ],
            ],
        ]);

        $item = $order->items->first();

        $this->assertSame(
            10.50,
            (float) $item->price
        );

        $this->assertSame(
            10.50,
            (float) $order->subtotal
        );

        $this->assertSame(
            'Large + Cold',
            $item->variant_name
        );

        $this->assertCount(
            2,
            $item->addons
        );
    }

    public function test_unassigned_addon_is_rejected(): void
    {
        $customer = $this->createCustomer();

        [$product, $variant] =
            $this->createConfigurableProduct();

        $addon = Addon::create([
            'name' => 'Secret Addon',
            'price' => 1.00,
            'available' => true,
            'sort_order' => 1,
        ]);

        $this->expectException(
            ValidationException::class
        );

        $this->service()->create([
            'customer_id' => $customer->id,
            'channel' => 'qr',
            'items' => [
                [
                    'product_id' => $product->id,
                    'product_variant_id' =>
                        $variant->id,
                    'addon_ids' => [
                        $addon->id,
                    ],
                    'qty' => 1,
                ],
            ],
        ]);
    }

    public function test_unavailable_addon_is_rejected(): void
    {
        $customer = $this->createCustomer();

        [$product, $variant] =
            $this->createConfigurableProduct();

        $addon = Addon::create([
            'name' => 'Oat Milk',
            'price' => 2.00,
            'available' => false,
            'sort_order' => 1,
        ]);

        $product->addons()->sync([
            $addon->id,
        ]);

        $this->expectException(
            ValidationException::class
        );

        $this->service()->create([
            'customer_id' => $customer->id,
            'channel' => 'qr',
            'items' => [
                [
                    'product_id' => $product->id,
                    'product_variant_id' =>
                        $variant->id,
                    'addon_ids' => [
                        $addon->id,
                    ],
                    'qty' => 1,
                ],
            ],
        ]);
    }

    public function test_quantity_uses_final_unit_price(): void
    {
        $customer = $this->createCustomer();

        [$product, $variant] =
            $this->createConfigurableProduct(
                'Coffee',
                7.00
            );

        $extraShot = Addon::create([
            'name' => 'Extra Shot',
            'price' => 1.50,
            'available' => true,
            'sort_order' => 1,
        ]);

        $oatMilk = Addon::create([
            'name' => 'Oat Milk',
            'price' => 2.00,
            'available' => true,
            'sort_order' => 2,
        ]);

        $product->addons()->sync([
            $extraShot->id,
            $oatMilk->id,
        ]);

        $order = $this->service()->create([
            'customer_id' => $customer->id,
            'channel' => 'qr',
            'items' => [
                [
                    'product_id' => $product->id,
                    'product_variant_id' =>
                        $variant->id,
                    'addon_ids' => [
                        $extraShot->id,
                        $oatMilk->id,
                    ],
                    'qty' => 2,
                ],
            ],
        ]);

        $item = $order->items->first();

        $this->assertSame(
            10.50,
            (float) $item->price
        );

        $this->assertSame(
            2,
            (int) $item->qty
        );

        $this->assertSame(
            21.00,
            (float) $order->subtotal
        );
    }
}