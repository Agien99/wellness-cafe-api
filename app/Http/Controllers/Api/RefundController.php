<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Refund;
use App\Services\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RefundController extends Controller
{
    public function __construct(private readonly OrderService $orders) {}

    /** GET /api/refunds */
    public function index(): JsonResponse
    {
        return response()->json(
            Refund::with('order', 'user')->latest('created_at')->get()
        );
    }

    /** GET /api/refunds/{refund} */
    public function show(Refund $refund): JsonResponse
    {
        return response()->json($refund->load('order.items', 'user'));
    }

    /**
     * POST /api/refunds
     * Body: { order_id, reason, method? }
     * Reverses inventory + loyalty + marks order refunded.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_id' => ['required', 'integer', 'exists:orders,id'],
            'reason'   => ['required', 'string', 'max:500'],
            'method'   => ['nullable', 'in:original,cash,credit'],
        ]);

        $order = Order::with('items.product', 'customer')->findOrFail($data['order_id']);

        if ($order->status === 'refunded') {
            throw ValidationException::withMessages([
                'order_id' => ['Order is already refunded.'],
            ]);
        }

        $user = $request->user();

        $refund = DB::transaction(function () use ($order, $data, $user) {
            $refund = Refund::create([
                'refund_no' => Refund::nextRefundNo(),
                'order_id'  => $order->id,
                'amount'    => $order->total,
                'reason'    => $data['reason'],
                'method'    => $data['method'] ?? 'original',
                'status'    => 'approved',
                'user_id'   => $user?->id,
            ]);

            // Restores inventory + reverses loyalty + flips order.status to 'refunded'
            $this->orders->reverse($order, $user);

            AuditLog::record($user, 'REFUND_APPROVED',
                "{$order->order_no} RM" . number_format((float) $order->total, 2) . " ({$data['reason']})"
            );

            return $refund;
        });

        return response()->json($refund->load('order'), 201);
    }
}
