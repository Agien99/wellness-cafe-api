<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\Table;
use App\Services\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * PublicController — handles unauthenticated requests for the customer
 * QR-ordering experience. Anyone with the cafe's URL can browse the menu
 * and place an order; payment is collected at the counter (status =
 * pending_payment until the cashier confirms it via the POS).
 */
class PublicController extends Controller
{
    public function __construct(private readonly OrderService $orders) {}

    /** GET /api/public/menu */
    public function menu(): JsonResponse
    {
        return response()->json([
            'cafe' => [
                'name'    => 'Wellness Cafe',
                'tagline' => 'Relax . Reflect . Recharge',
                'address' => 'Ground Floor, Block 7, FPM, UPSI',
                'currency'=> 'RM',
                'tax_rate'=> 0.06,
            ],
            'categories' => Category::orderBy('sort_order')->get(),
            'products'   => Product::where('available', true)->orderBy('category_id')->orderBy('id')->get(),
        ]);
    }

    /** GET /api/public/tables */
    public function tables(): JsonResponse
    {
        return response()->json(Table::orderBy('id')->get());
    }

    /**
     * POST /api/public/orders — guest order from QR / customer phone
     * Body: {
     *   items: [{product_id, qty}],
     *   table_id: int|null,    // null = takeaway
     *   customer_name: string|null,
     *   notes: string|null
     * }
     */
    public function createOrder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'items'              => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.qty'        => ['required', 'integer', 'min:1'],
            'table_id'           => ['nullable', 'integer', 'exists:tables,id'],
            'customer_name'      => ['nullable', 'string', 'max:128'],
            'notes'              => ['nullable', 'string', 'max:500'],
        ]);

        // QR orders always:
        //  - channel = qr
        //  - customer = walk-in (id 8)
        //  - no cashier
        //  - no payment yet (cashier completes payment at counter)
        $order = $this->orders->create([
            'items'       => $data['items'],
            'customer_id' => 8,
            'channel'     => 'qr',
            'table_id'    => $data['table_id'] ?? null,
            'notes'       => $data['notes'] ?? null,
            'cashier'     => null,
            'payment'     => null, // will be confirmed at counter
        ]);

        // Override customer_name for QR order if provided
        if (!empty($data['customer_name'])) {
            $order->customer_name = $data['customer_name'];
            $order->save();
        }

        return response()->json($order->load('items', 'table'), 201);
    }
}
