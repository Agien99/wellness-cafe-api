<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\PromotionUsage;
use App\Services\OrderService;
use Database\Seeders\LoyaltyTierSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class PromotionV2Test extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(LoyaltyTierSeeder::class);
    }

    private function createCustomer(
        string $name = 'Test Customer'
    ): Customer {
        return Customer::create([
            'name' => $name,
            'phone' => '0123456789',
            'email' => strtolower(
                str_replace(' ', '.', $name)
            ) . '@example.com',
            'membership' => 'Bronze',
            'points' => 0,
            'total_spent' => 0,
            'joined_at' => now()->toDateString(),
        ]);
    }

    private function createProduct(
        float $price = 50
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
            'cost' => 10,
            'available' => true,
            'recipe' => [],
        ]);
    }

    private function createPromotion(
        array $overrides = []
    ): Promotion {
        return Promotion::create(array_merge([
            'code' => 'TEST10',
            'name' => 'Test Promotion',
            'description' => 'Promotion V2 test',
            'type' => 'percent',
            'value' => 10,
            'max_discount' => null,
            'min_order' => 0,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
            'usage_limit' => null,
            'usage_limit_per_customer' => null,
            'stackable' => false,
            'customer_scope' => 'all',
            'allowed_channels' => null,
            'active' => true,
        ], $overrides));
    }

    public function test_percentage_promotion_calculates_discount(): void
    {
        $promotion = $this->createPromotion([
            'value' => 10,
        ]);

        $result = $promotion->validateForOrder(
            50,
            null,
            'pos'
        );

        $this->assertTrue($result['valid']);

        $this->assertSame(
            5.0,
            (float) $result['discount']
        );
    }

    public function test_percentage_promotion_respects_max_discount(): void
    {
        $promotion = $this->createPromotion([
            'value' => 20,
            'max_discount' => 10,
        ]);

        $result = $promotion->validateForOrder(
            100,
            null,
            'pos'
        );

        $this->assertTrue($result['valid']);

        $this->assertSame(
            10.0,
            (float) $result['discount']
        );
    }

    public function test_fixed_discount_never_exceeds_subtotal(): void
    {
        $promotion = $this->createPromotion([
            'type' => 'fixed',
            'value' => 100,
        ]);

        $result = $promotion->validateForOrder(
            30,
            null,
            'pos'
        );

        $this->assertTrue($result['valid']);

        $this->assertSame(
            30.0,
            (float) $result['discount']
        );
    }

    public function test_minimum_order_is_enforced(): void
    {
        $promotion = $this->createPromotion([
            'min_order' => 100,
        ]);

        $result = $promotion->validateForOrder(
            50,
            null,
            'pos'
        );

        $this->assertFalse($result['valid']);

        $this->assertSame(
            0,
            $result['discount']
        );
    }

    public function test_scheduled_promotion_cannot_be_used_early(): void
    {
        $promotion = $this->createPromotion([
            'starts_at' => now()->addDay(),
            'ends_at' => now()->addDays(2),
        ]);

        $result = $promotion->validateForOrder(
            50,
            null,
            'pos'
        );

        $this->assertFalse($result['valid']);
    }

    public function test_expired_promotion_cannot_be_used(): void
    {
        $promotion = $this->createPromotion([
            'starts_at' => now()->subDays(2),
            'ends_at' => now()->subDay(),
        ]);

        $result = $promotion->validateForOrder(
            50,
            null,
            'pos'
        );

        $this->assertFalse($result['valid']);
    }

    public function test_channel_restriction_is_enforced(): void
    {
        $promotion = $this->createPromotion([
            'allowed_channels' => [
                'qr',
            ],
        ]);

        $result = $promotion->validateForOrder(
            50,
            null,
            'pos'
        );

        $this->assertFalse($result['valid']);

        $result = $promotion->validateForOrder(
            50,
            null,
            'qr'
        );

        $this->assertTrue($result['valid']);
    }

    public function test_registered_customer_promotion_rejects_anonymous_customer(): void
    {
        $promotion = $this->createPromotion([
            'customer_scope' => 'registered',
        ]);

        $result = $promotion->validateForOrder(
            50,
            null,
            'pos'
        );

        $this->assertFalse($result['valid']);

        $customer = $this->createCustomer();

        $result = $promotion->validateForOrder(
            50,
            $customer->id,
            'pos'
        );

        $this->assertTrue($result['valid']);
    }

    public function test_per_customer_limit_is_enforced(): void
    {
        $customer = $this->createCustomer();

        $product = $this->createProduct();

        $promotion = $this->createPromotion([
            'usage_limit_per_customer' => 1,
            'customer_scope' => 'registered',
        ]);

        $service = app(OrderService::class);

        $order = $service->create([
            'items' => [
                [
                    'product_id' => $product->id,
                    'qty' => 1,
                ],
            ],
            'customer_id' => $customer->id,
            'channel' => 'pos',
            'promo_code' => $promotion->code,
            'payment' => [
                'method' => 'cash',
            ],
        ]);

        $this->assertDatabaseHas(
            'promotion_usages',
            [
                'promotion_id' => $promotion->id,
                'order_id' => $order->id,
                'customer_id' => $customer->id,
            ]
        );

        $this->expectException(
            ValidationException::class
        );

        $service->create([
            'items' => [
                [
                    'product_id' => $product->id,
                    'qty' => 1,
                ],
            ],
            'customer_id' => $customer->id,
            'channel' => 'pos',
            'promo_code' => $promotion->code,
            'payment' => [
                'method' => 'cash',
            ],
        ]);
    }

    public function test_global_usage_limit_is_enforced(): void
    {
        $customer1 = $this->createCustomer(
            'Customer One'
        );

        $customer2 = $this->createCustomer(
            'Customer Two'
        );

        $product = $this->createProduct();

        $promotion = $this->createPromotion([
            'usage_limit' => 1,
        ]);

        $service = app(OrderService::class);

        $service->create([
            'items' => [
                [
                    'product_id' => $product->id,
                    'qty' => 1,
                ],
            ],
            'customer_id' => $customer1->id,
            'channel' => 'pos',
            'promo_code' => $promotion->code,
            'payment' => [
                'method' => 'cash',
            ],
        ]);

        $this->expectException(
            ValidationException::class
        );

        $service->create([
            'items' => [
                [
                    'product_id' => $product->id,
                    'qty' => 1,
                ],
            ],
            'customer_id' => $customer2->id,
            'channel' => 'pos',
            'promo_code' => $promotion->code,
            'payment' => [
                'method' => 'cash',
            ],
        ]);
    }

    public function test_paid_order_records_promotion_usage(): void
    {
        $customer = $this->createCustomer();

        $product = $this->createProduct(
            50
        );

        $promotion = $this->createPromotion([
            'value' => 10,
        ]);

        $service = app(OrderService::class);

        $order = $service->create([
            'items' => [
                [
                    'product_id' => $product->id,
                    'qty' => 1,
                ],
            ],
            'customer_id' => $customer->id,
            'channel' => 'pos',
            'promo_code' => $promotion->code,
            'payment' => [
                'method' => 'cash',
            ],
        ]);

        $order->refresh();

        $this->assertSame(
            5.0,
            (float) $order->promo_discount
        );

        $this->assertSame(
            $promotion->id,
            $order->promotion_id
        );

        $this->assertDatabaseHas(
            'promotion_usages',
            [
                'promotion_id' =>
                    $promotion->id,

                'order_id' =>
                    $order->id,

                'customer_id' =>
                    $customer->id,

                'promotion_code' =>
                    'TEST10',

                'discount_amount' =>
                    '5.00',
            ]
        );
    }

    public function test_pending_order_does_not_consume_promotion_until_payment(): void
    {
        $customer = $this->createCustomer();

        $product = $this->createProduct();

        $promotion = $this->createPromotion();

        $service = app(OrderService::class);

        $order = $service->create([
            'items' => [
                [
                    'product_id' =>
                        $product->id,

                    'qty' => 1,
                ],
            ],

            'customer_id' =>
                $customer->id,

            'channel' =>
                'qr',

            'promo_code' =>
                $promotion->code,

            'payment' =>
                null,
        ]);

        $this->assertSame(
            'pending_payment',
            $order->status
        );

        $this->assertSame(
            0,
            PromotionUsage::count()
        );

        $service->takePayment(
            $order,
            'qr',
            null
        );

        $this->assertSame(
            1,
            PromotionUsage::count()
        );

        $this->assertDatabaseHas(
            'promotion_usages',
            [
                'promotion_id' =>
                    $promotion->id,

                'order_id' =>
                    $order->id,
            ]
        );
    }

    public function test_stackable_promotion_combines_with_membership_discount(): void

    {
        $customer = $this->createCustomer();

        $customer->update([
            'membership' => 'Gold',
        ]);

        $product = $this->createProduct(100);

        $promotion = $this->createPromotion([
            'value' => 10,
            'stackable' => true,
        ]);

        $service = app(OrderService::class);

        $order = $service->create([
            'items' => [
                [
                    'product_id' => $product->id,
                    'qty' => 1,
                ],
            ],
            'customer_id' => $customer->id,
            'channel' => 'pos',
            'promo_code' => $promotion->code,
            'payment' => [
                'method' => 'cash',
            ],
        ]);

        $this->assertSame(
            8.0,
            (float) $order->member_discount
        );

        $this->assertSame(
            10.0,
            (float) $order->promo_discount
        );

        $this->assertSame(
            18.0,
            (float) $order->discount
        );
    }

    public function test_non_stackable_promotion_uses_promo_when_promo_is_better(): void
    {
        $customer = $this->createCustomer();

        $customer->update([
            'membership' => 'Gold',
        ]);

        $product = $this->createProduct(100);

        $promotion = $this->createPromotion([
            'value' => 10,
            'stackable' => false,
        ]);

        $service = app(OrderService::class);

        $order = $service->create([
            'items' => [
                [
                    'product_id' => $product->id,
                    'qty' => 1,
                ],
            ],
            'customer_id' => $customer->id,
            'channel' => 'pos',
            'promo_code' => $promotion->code,
            'payment' => [
                'method' => 'cash',
            ],
        ]);

        $this->assertSame(
            8.0,
            (float) $order->member_discount
        );

        $this->assertSame(
            10.0,
            (float) $order->promo_discount
        );

        $this->assertSame(
            10.0,
            (float) $order->discount
        );
    }

    public function test_non_stackable_promotion_uses_membership_when_membership_is_better(): void
    {
        $customer = $this->createCustomer();

        $customer->update([
            'membership' => 'Platinum',
        ]);

        $product = $this->createProduct(100);

        $promotion = $this->createPromotion([
            'value' => 10,
            'stackable' => false,
        ]);

        $service = app(OrderService::class);

        $order = $service->create([
            'items' => [
                [
                    'product_id' => $product->id,
                    'qty' => 1,
                ],
            ],
            'customer_id' => $customer->id,
            'channel' => 'pos',
            'promo_code' => $promotion->code,
            'payment' => [
                'method' => 'cash',
            ],
        ]);

        $this->assertSame(
            12.0,
            (float) $order->member_discount
        );

        $this->assertSame(
            10.0,
            (float) $order->promo_discount
        );

        $this->assertSame(
            12.0,
            (float) $order->discount
        );
    }

    public function test_non_stackable_promotion_works_normally_without_membership_discount(): void
    {
        $walkIn = new Customer();

        $walkIn->id = 8;
        $walkIn->name = 'Walk-in Customer';
        $walkIn->phone = null;
        $walkIn->email = null;
        $walkIn->membership = 'None';
        $walkIn->points = 0;
        $walkIn->total_spent = 0;
        $walkIn->joined_at = now()->toDateString();

        $walkIn->save();

        $product = $this->createProduct(100);

        $promotion = $this->createPromotion([
            'value' => 10,
            'stackable' => false,
        ]);

        $service = app(OrderService::class);

        $order = $service->create([
            'items' => [
                [
                    'product_id' => $product->id,
                    'qty' => 1,
                ],
            ],
            'channel' => 'pos',
            'promo_code' => $promotion->code,
            'payment' => [
                'method' => 'cash',
            ],
        ]);

        $this->assertSame(
            0.0,
            (float) $order->member_discount
        );

        $this->assertSame(
            10.0,
            (float) $order->promo_discount
        );

        $this->assertSame(
            10.0,
            (float) $order->discount
        );
    }
}