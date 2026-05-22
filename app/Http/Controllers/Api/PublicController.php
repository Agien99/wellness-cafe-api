<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\Table;
use App\Services\DuitNowQRService;
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

    /**
     * GET /api/public/orders/{orderNo}/status — read-only status check used
     * by the customer's phone to poll progress of their order after placing it.
     * Returns a minimal payload (no internal IDs, no audit info).
     */
    public function orderStatus(string $orderNo): JsonResponse
    {
        $order = Order::with(['items', 'table'])
            ->where('order_no', $orderNo)
            ->first();

        if (!$order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        // Derive a single high-level "stage" the UI displays:
        //   waiting_payment → preparing → ready → completed
        $stage = match (true) {
            $order->status === 'pending_payment'        => 'waiting_payment',
            $order->status === 'refunded'               => 'refunded',
            $order->status === 'cancelled'              => 'cancelled',
            $order->kitchen_status === 'completed'      => 'completed',
            $order->kitchen_status === 'ready'          => 'ready',
            $order->kitchen_status === 'preparing'      => 'preparing',
            default                                     => 'preparing', // paid + pending = waiting on kitchen
        };

        return response()->json([
            'order_no'       => $order->order_no,
            'stage'          => $stage,
            'status'         => $order->status,
            'kitchen_status' => $order->kitchen_status,
            'customer_name'  => $order->customer_name,
            'table'          => $order->table?->name,
            'total'          => (float) $order->total,
            'items'          => $order->items->map(fn ($i) => [
                'name' => $i->name,
                'qty'  => (int) $i->qty,
            ]),
            'placed_at'      => $order->created_at?->toIso8601String(),
        ]);
    }

    /**
     * GET /api/public/orders/{orderNo}/duitnow-qr
     * Public sibling of the staff-side endpoint — returns the DuitNow QR
     * payload so the customer's own phone can display it on the status page.
     * Customer screenshots the QR and uploads it to their banking app's
     * "Pay via QR → Upload from Gallery" flow.
     *
     * Only valid while the order is in pending_payment state.
     */
    public function orderDuitnowQr(string $orderNo, DuitNowQRService $qr): JsonResponse
    {
        if (!config('duitnow.enabled', true)) {
            return response()->json(['message' => 'DuitNow QR is disabled on this server.'], 422);
        }
        $order = Order::where('order_no', $orderNo)->first();
        if (!$order) {
            return response()->json(['message' => 'Order not found'], 404);
        }
        if ($order->status !== 'pending_payment') {
            return response()->json(['message' => 'Order is not awaiting payment.'], 422);
        }
        return response()->json([
            'order_no'      => $order->order_no,
            'amount'        => (float) $order->total,
            'currency'      => 'MYR',
            'merchant_name' => config('duitnow.merchant_name'),
            'payload'       => $qr->payloadFor($order),
        ]);
    }
}
