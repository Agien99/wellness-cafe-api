<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\DuitNowQRService;
use App\Services\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function __construct(private readonly OrderService $orders) {}

    /**
     * GET /api/orders
     * Query: ?q=&channel=&status=&kitchen_status=&date_from=&date_to=&per_page=
     */
    public function index(Request $request): JsonResponse
    {
        $q = Order::query()
            ->with(['items', 'payment', 'customer', 'table'])
            ->latest('created_at');

        if ($s = $request->query('q')) {
            $q->where(fn ($qb) => $qb->where('order_no', 'like', "%{$s}%")
                                    ->orWhere('customer_name', 'like', "%{$s}%"));
        }
        if ($v = $request->query('channel'))        $q->where('channel', $v);
        if ($v = $request->query('status'))         $q->where('status', $v);
        if ($v = $request->query('kitchen_status')) $q->where('kitchen_status', $v);
        if ($v = $request->query('date_from'))      $q->whereDate('created_at', '>=', $v);
        if ($v = $request->query('date_to'))        $q->whereDate('created_at', '<=', $v);

        $perPage = min(200, (int) $request->query('per_page', 50));
        return response()->json($q->paginate($perPage));
    }

    /** GET /api/orders/{id} */
    public function show(Order $order): JsonResponse
    {
        return response()->json(
            $order->load(['items.product', 'payment', 'customer', 'table', 'cashier', 'refunds'])
        );
    }

    /**
     * POST /api/orders
     * Body: {
     *   items: [{product_id, qty}],
     *   customer_id, channel, table_id, promo_code, notes,
     *   payment: { method }
     * }
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'items'                => ['required', 'array', 'min:1'],
            'items.*.product_id'   => ['required', 'integer', 'exists:products,id'],
            'items.*.qty'          => ['required', 'integer', 'min:1'],
            'customer_id'          => ['nullable', 'integer', 'exists:customers,id'],
            'channel'              => ['nullable', 'in:pos,qr,online'],
            'table_id'             => ['nullable', 'integer', 'exists:tables,id'],
            'promo_code'           => ['nullable', 'string'],
            'notes'                => ['nullable', 'string'],
            'payment'              => ['nullable', 'array'],
            'payment.method'       => ['required_with:payment', 'in:cash,card,ewallet,qr'],
        ]);

        $data['cashier'] = $request->user();
        $order = $this->orders->create($data);

        return response()->json($order, 201);
    }

    /**
     * POST /api/orders/{order}/payment
     * Confirms payment at the counter for a pending_payment order
     * (typically QR orders that didn't pay during ordering).
     * Body: { method: cash|card|ewallet|qr }
     */
    public function takePayment(Request $request, Order $order): JsonResponse
    {
        $data = $request->validate([
            'method' => ['required', 'in:cash,card,ewallet,qr'],
        ]);

        $this->orders->takePayment($order, $data['method'], $request->user());

        return response()->json(
            $order->fresh()->load(['items', 'payment', 'customer', 'table', 'cashier'])
        );
    }

    /**
     * GET /api/orders/{order}/duitnow-qr
     * Returns the EMV-format DuitNow QR payload for this order, plus the
     * data the cashier UI needs (amount, order_no) to display the QR to
     * the customer. Only valid while the order is pending_payment.
     */
    public function duitnowQr(Order $order, DuitNowQRService $qr): JsonResponse
    {
        if (!config('duitnow.enabled', true)) {
            return response()->json(['message' => 'DuitNow QR is disabled on this server.'], 422);
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
