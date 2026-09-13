<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Customer;
use App\Models\LoyaltyTier;
use App\Models\Product;
use App\Services\OrderService;
use Database\Seeders\LoyaltyTierSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DynamicLoyaltyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(
            LoyaltyTierSeeder::class
        );
    }

    private function createCustomer(
        array $overrides = []
    ): Customer {
        return Customer::create(
            array_merge([
                'name' => 'Test Customer',
                'phone' => '0123456789',
                'email' => 'customer@example.com',
                'membership' => 'Bronze',
                'points' => 0,
                'total_spent' => 0,
                'joined_at' =>
                    now()->toDateString(),
            ], $overrides)
        );
    }

    private function createProduct(
        float $price
    ): Product {
        $category = Category::create([
            'name' => 'Test Category',
            'icon' => null,
            'color' => null,
            'sort_order' => 1,
        ]);

        return Product::create([
            'category_id' => $category->id,
            'name' => 'Test Product',
            'size' => null,
            'price' => $price,
            'cost' => 5,
            'available' => true,
            'recipe' => [],
        ]);
    }

    private function createPaidOrder(
        Customer $customer,
        Product $product
    ) {
        return app(OrderService::class)
            ->create([
                'items' => [
                    [
                        'product_id' =>
                            $product->id,
                        'qty' => 1,
                    ],
                ],
                'customer_id' =>
                    $customer->id,
                'channel' => 'pos',
                'payment' => [
                    'method' => 'cash',
                ],
            ]);
    }

    public function test_customer_uses_dynamic_tier_discount(): void
    {
        $gold = LoyaltyTier::where(
            'name',
            'Gold'
        )->firstOrFail();

        $gold->update([
            'discount_percentage' => 15,
        ]);

        $customer =
            $this->createCustomer([
                'membership' => 'Gold',
            ]);

        $this->assertSame(
            0.15,
            $customer->membership_discount
        );
    }

    public function test_customer_uses_dynamic_points_multiplier(): void
    {
        $silver = LoyaltyTier::where(
            'name',
            'Silver'
        )->firstOrFail();

        $silver->update([
            'points_multiplier' => 2.5,
        ]);

        $customer =
            $this->createCustomer([
                'membership' => 'Silver',
            ]);

        $this->assertSame(
            2.5,
            $customer->point_multiplier
        );
    }

    public function test_paid_order_automatically_upgrades_customer(): void
    {
        $customer =
            $this->createCustomer();

        $product =
            $this->createProduct(100);

        $this->createPaidOrder(
            $customer,
            $product
        );

        $customer->refresh();

        $this->assertSame(
            'Silver',
            $customer->membership
        );

        $this->assertSame(
            106.0,
            (float) $customer->total_spent
        );
    }

    public function test_custom_tier_is_used_automatically(): void
    {
        LoyaltyTier::create([
            'name' => 'VIP',
            'minimum_spend' => 200,
            'discount_percentage' => 10,
            'points_multiplier' => 1.8,
            'active' => true,
            'sort_order' => 5,
        ]);

        $customer =
            $this->createCustomer([
                'membership' => 'Silver',
                'total_spent' => 190,
            ]);

        $product =
            $this->createProduct(10);

        $this->createPaidOrder(
            $customer,
            $product
        );

        $customer->refresh();

        $this->assertSame(
            'VIP',
            $customer->membership
        );
    }

    public function test_inactive_tier_is_skipped(): void
    {
        LoyaltyTier::where(
            'name',
            'Gold'
        )->update([
            'active' => false,
        ]);

        $customer =
            $this->createCustomer([
                'membership' => 'Silver',
                'total_spent' => 250,
            ]);

        $product =
            $this->createProduct(60);

        $this->createPaidOrder(
            $customer,
            $product
        );

        $customer->refresh();

        $this->assertSame(
            'Silver',
            $customer->membership
        );

        $this->assertGreaterThan(
            300,
            (float) $customer->total_spent
        );
    }

    public function test_refund_downgrades_customer_tier(): void
    {
        $customer =
            $this->createCustomer([
                'membership' => 'Silver',
                'total_spent' => 250,
                'points' => 100,
            ]);

        $product =
            $this->createProduct(50);

        $service =
            app(OrderService::class);

        $order =
            $this->createPaidOrder(
                $customer,
                $product
            );

        $customer->refresh();
        $order->refresh();

        $this->assertSame(
            'Gold',
            $customer->membership
        );

        $this->assertGreaterThan(
            0,
            $order->loyalty_points_earned
        );

        $service->reverse(
            $order
        );

        $customer->refresh();

        $this->assertSame(
            'Silver',
            $customer->membership
        );

        $this->assertSame(
            250.0,
            (float) $customer->total_spent
        );
    }

    public function test_refund_reverses_exact_points_snapshot(): void
    {
        $customer =
            $this->createCustomer([
                'membership' => 'Silver',
                'points' => 100,
            ]);

        $product =
            $this->createProduct(50);

        $service =
            app(OrderService::class);

        $order =
            $this->createPaidOrder(
                $customer,
                $product
            );

        $customer->refresh();
        $order->refresh();

        $earned =
            $order->loyalty_points_earned;

        $pointsAfterPurchase =
            $customer->points;

        /*
         * Change multiplier AFTER purchase.
         * Refund must still reverse the original
         * earned-points snapshot.
         */
        LoyaltyTier::where(
            'name',
            $customer->membership
        )->update([
            'points_multiplier' => 9,
        ]);

        $service->reverse(
            $order
        );

        $customer->refresh();

        $this->assertSame(
            $pointsAfterPurchase - $earned,
            $customer->points
        );
    }

    public function test_walk_in_customer_has_no_loyalty_benefits(): void
    {
        $walkIn = new Customer();

        $walkIn->id = 8;
        $walkIn->name =
            'Walk-in Customer';
        $walkIn->membership = 'None';
        $walkIn->points = 0;
        $walkIn->total_spent = 0;
        $walkIn->joined_at =
            now()->toDateString();

        $walkIn->save();

        $this->assertSame(
            0.0,
            $walkIn->membership_discount
        );

        $this->assertSame(
            1.0,
            $walkIn->point_multiplier
        );

        $product =
            $this->createProduct(100);

        $this->createPaidOrder(
            $walkIn,
            $product
        );

        $walkIn->refresh();

        $this->assertSame(
            0,
            $walkIn->points
        );

        $this->assertSame(
            0.0,
            (float) $walkIn->total_spent
        );

        $this->assertSame(
            'None',
            $walkIn->membership
        );
    }
}