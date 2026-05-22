<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class KitchenController extends Controller
{
    /**
     * GET /api/kitchen/orders
     * Returns active orders (pending, preparing, ready) for the KDS.
     * Excludes orders still awaiting payment — kitchen only sees orders
     * after the cashier confirms payment at the counter.
     */
    public function index(): JsonResponse
    {
        $orders = Order::with(['items', 'table', 'customer'])
            ->whereIn('kitchen_status', ['pending', 'preparing', 'ready'])
            ->where('status', '!=', 'pending_payment')
            ->orderBy('created_at')
            ->get();

        $summary = [
            'pending'   => $orders->where('kitchen_status', 'pending')->count(),
            'preparing' => $orders->where('kitchen_status', 'preparing')->count(),
            'ready'     => $orders->where('kitchen_status', 'ready')->count(),
        ];

        return response()->json([
            'orders'  => $orders,
            'summary' => $summary,
        ]);
    }

    /**
     * PATCH /api/kitchen/orders/{order}/status
     * Body: { status: pending|preparing|ready|completed }
     */
    public function updateStatus(Request $request, Order $order): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:pending,preparing,ready,completed'],
        ]);

        $allowed = [
            'pending'   => ['preparing'],
            'preparing' => ['ready'],
            'ready'     => ['completed'],
        ];
        $currentAllowed = $allowed[$order->kitchen_status] ?? [];
        if (!in_array($data['status'], $currentAllowed, true)) {
            throw ValidationException::withMessages([
                'status' => ["Cannot move from '{$order->kitchen_status}' to '{$data['status']}'."],
            ]);
        }

        $order->kitchen_status = $data['status'];
        $order->save();

        AuditLog::record($request->user(), 'KITCHEN_STATUS',
            "{$order->order_no} → " . strtoupper($data['status'])
        );

        return response()->json($order->fresh(['items', 'table']));
    }
}
