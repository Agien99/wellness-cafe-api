<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\LoyaltyTier;
use App\Models\User;
use Database\Seeders\LoyaltyTierSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoyaltyTierCrudTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(
            LoyaltyTierSeeder::class
        );

        $this->user = User::factory()->create([
            'username' => 'loyalty_test_admin',
            'active' => true,
        ]);

        $this->actingAs(
            $this->user,
            'sanctum'
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

    public function test_can_list_loyalty_tiers(): void
    {
        $response = $this->getJson(
            '/api/loyalty-tiers'
        );

        $response
            ->assertOk()
            ->assertJsonCount(4);

        $response->assertJsonFragment([
            'name' => 'Bronze',
        ]);

        $response->assertJsonFragment([
            'name' => 'Platinum',
        ]);
    }

    public function test_can_create_loyalty_tier(): void
    {
        $response = $this->postJson(
            '/api/loyalty-tiers',
            [
                'name' => 'VIP',
                'minimum_spend' => 1500,
                'discount_percentage' => 15,
                'points_multiplier' => 2.5,
                'active' => true,
                'sort_order' => 5,
            ]
        );

        $response
            ->assertCreated()
            ->assertJsonFragment([
                'name' => 'VIP',
            ]);

        $this->assertDatabaseHas(
            'loyalty_tiers',
            [
                'name' => 'VIP',
                'minimum_spend' => '1500.00',
                'discount_percentage' => '15.00',
                'points_multiplier' => '2.50',
            ]
        );
    }

    public function test_can_update_loyalty_tier(): void
    {
        $silver = LoyaltyTier::where(
            'name',
            'Silver'
        )->firstOrFail();

        $response = $this->putJson(
            "/api/loyalty-tiers/{$silver->id}",
            [
                'discount_percentage' => 7,
                'points_multiplier' => 1.4,
            ]
        );

        $response
            ->assertOk()
            ->assertJsonFragment([
                'name' => 'Silver',
            ]);

        $this->assertDatabaseHas(
            'loyalty_tiers',
            [
                'id' => $silver->id,
                'discount_percentage' => '7.00',
                'points_multiplier' => '1.40',
            ]
        );
    }

    public function test_can_delete_non_base_loyalty_tier(): void
    {
        $gold = LoyaltyTier::where(
            'name',
            'Gold'
        )->firstOrFail();

        $response = $this->deleteJson(
            "/api/loyalty-tiers/{$gold->id}"
        );

        $response
            ->assertOk()
            ->assertJson([
                'message' =>
                    'Loyalty tier deleted.',
            ]);

        $this->assertDatabaseMissing(
            'loyalty_tiers',
            [
                'id' => $gold->id,
            ]
        );
    }

    public function test_duplicate_tier_name_is_rejected(): void
    {
        $response = $this->postJson(
            '/api/loyalty-tiers',
            [
                'name' => 'Gold',
                'minimum_spend' => 1200,
                'discount_percentage' => 15,
                'points_multiplier' => 2,
                'active' => true,
                'sort_order' => 5,
            ]
        );

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'name',
            ]);
    }

    public function test_bronze_cannot_be_renamed(): void
    {
        $bronze = LoyaltyTier::where(
            'name',
            'Bronze'
        )->firstOrFail();

        $response = $this->putJson(
            "/api/loyalty-tiers/{$bronze->id}",
            [
                'name' => 'Starter',
            ]
        );

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'name',
            ]);

        $this->assertDatabaseHas(
            'loyalty_tiers',
            [
                'id' => $bronze->id,
                'name' => 'Bronze',
            ]
        );
    }

    public function test_bronze_cannot_be_disabled(): void
    {
        $bronze = LoyaltyTier::where(
            'name',
            'Bronze'
        )->firstOrFail();

        $response = $this->putJson(
            "/api/loyalty-tiers/{$bronze->id}",
            [
                'active' => false,
            ]
        );

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'active',
            ]);

        $bronze->refresh();

        $this->assertTrue(
            $bronze->active
        );
    }

    public function test_bronze_cannot_be_deleted(): void
    {
        $bronze = LoyaltyTier::where(
            'name',
            'Bronze'
        )->firstOrFail();

        $response = $this->deleteJson(
            "/api/loyalty-tiers/{$bronze->id}"
        );

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'loyalty_tier',
            ]);

        $this->assertDatabaseHas(
            'loyalty_tiers',
            [
                'id' => $bronze->id,
                'name' => 'Bronze',
            ]
        );
    }

    public function test_threshold_change_recalculates_existing_customers(): void
    {
        $customer = $this->createCustomer([
            'membership' => 'Silver',
            'total_spent' => 150,
        ]);

        $silver = LoyaltyTier::where(
            'name',
            'Silver'
        )->firstOrFail();

        /*
         * Silver originally starts at RM100.
         *
         * Raising it to RM200 should cause
         * this RM150 customer to return
         * to Bronze.
         */
        $response = $this->putJson(
            "/api/loyalty-tiers/{$silver->id}",
            [
                'minimum_spend' => 200,
            ]
        );

        $response->assertOk();

        $customer->refresh();

        $this->assertSame(
            'Bronze',
            $customer->membership
        );
    }
}