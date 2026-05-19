<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\InventoryItem;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\StockMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseOrderController extends Controller
{
    /** GET /api/purchase-orders */
    public function index(): JsonResponse
    {
        return response()->json(
            PurchaseOrder::with('supplier', 'items.inventoryItem')
                ->latest('created_at')->get()
        );
    }

    /** GET /api/purchase-orders/{po} */
    public function show(PurchaseOrder $purchaseOrder): JsonResponse
    {
        return response()->json($purchaseOrder->load('supplier', 'items.inventoryItem'));
    }

    /**
     * POST /api/purchase-orders
     * Body: {
     *   supplier_id, expected_date,
     *   items: [{ inventory_item_id, qty, cost }]
     * }
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'supplier_id'              => ['required', 'integer', 'exists:suppliers,id'],
            'expected_date'            => ['nullable', 'date'],
            'items'                    => ['required', 'array', 'min:1'],
            'items.*.inventory_item_id'=> ['required', 'integer', 'exists:inventory_items,id'],
            'items.*.qty'              => ['required', 'numeric', 'min:0.01'],
            'items.*.cost'             => ['required', 'numeric', 'min:0'],
        ]);

        $total = collect($data['items'])->sum(fn ($i) => (float) $i['qty'] * (float) $i['cost']);

        $po = DB::transaction(function () use ($data, $total) {
            $po = PurchaseOrder::create([
                'po_no'         => PurchaseOrder::nextPoNo(),
                'supplier_id'   => $data['supplier_id'],
                'total'         => round($total, 2),
                'status'        => 'pending',
                'expected_date' => $data['expected_date'] ?? null,
            ]);
            foreach ($data['items'] as $line) {
                PurchaseOrderItem::create([
                    'purchase_order_id' => $po->id,
                    'inventory_item_id' => $line['inventory_item_id'],
                    'qty'               => $line['qty'],
                    'cost'              => $line['cost'],
                ]);
            }
            return $po;
        });

        AuditLog::record($request->user(), 'PURCHASE_ORDER_CREATED',
            "{$po->po_no} total RM" . number_format($total, 2)
        );

        return response()->json($po->load('supplier', 'items.inventoryItem'), 201);
    }

    /**
     * POST /api/purchase-orders/{po}/receive
     * Marks the PO as received and increments inventory for each line.
     */
    public function receive(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        if ($purchaseOrder->status === 'received') {
            return response()->json(['message' => 'Already received.'], 422);
        }

        DB::transaction(function () use ($purchaseOrder) {
            foreach ($purchaseOrder->items as $line) {
                $inv = $line->inventoryItem;
                if (!$inv) continue;
                $inv->stock = round((float) $inv->stock + (float) $line->qty, 2);
                $inv->save();

                StockMovement::create([
                    'inventory_item_id' => $inv->id,
                    'type'              => 'in',
                    'qty'               => $line->qty,
                    'reason'            => "Received from {$purchaseOrder->po_no}",
                ]);
            }

            $purchaseOrder->status = 'received';
            $purchaseOrder->received_at = now();
            $purchaseOrder->save();
        });

        AuditLog::record($request->user(), 'PURCHASE_RECEIVED',
            "{$purchaseOrder->po_no} received and stock updated"
        );

        return response()->json($purchaseOrder->fresh()->load('supplier', 'items.inventoryItem'));
    }
}
