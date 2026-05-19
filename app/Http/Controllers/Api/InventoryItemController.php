<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\InventoryItem;
use App\Models\StockMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryItemController extends Controller
{
    /** GET /api/inventory  (?q=search&low=1) */
    public function index(Request $request): JsonResponse
    {
        $q = InventoryItem::query()->with('supplier')->orderBy('name');
        if ($s = $request->query('q')) {
            $q->where('name', 'like', "%{$s}%");
        }
        if ($request->boolean('low')) {
            $q->whereColumn('stock', '<=', 'reorder_level');
        }
        return response()->json($q->get());
    }

    /** GET /api/inventory/{item} */
    public function show(InventoryItem $item): JsonResponse
    {
        return response()->json($item->load('supplier', 'stockMovements'));
    }

    /** POST /api/inventory */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'          => ['required', 'string', 'max:255'],
            'unit'          => ['required', 'string', 'max:16'],
            'stock'         => ['required', 'numeric', 'min:0'],
            'reorder_level' => ['required', 'numeric', 'min:0'],
            'cost_per_unit' => ['required', 'numeric', 'min:0'],
            'supplier_id'   => ['nullable', 'integer', 'exists:suppliers,id'],
        ]);
        $item = InventoryItem::create($data);
        AuditLog::record($request->user(), 'INVENTORY_CREATED', $item->name);
        return response()->json($item, 201);
    }

    /** PUT /api/inventory/{item} */
    public function update(Request $request, InventoryItem $item): JsonResponse
    {
        $data = $request->validate([
            'name'          => ['sometimes', 'required', 'string', 'max:255'],
            'unit'          => ['sometimes', 'required', 'string', 'max:16'],
            'reorder_level' => ['sometimes', 'numeric', 'min:0'],
            'cost_per_unit' => ['sometimes', 'numeric', 'min:0'],
            'supplier_id'   => ['nullable', 'integer', 'exists:suppliers,id'],
        ]);
        $item->update($data);
        AuditLog::record($request->user(), 'INVENTORY_UPDATED', $item->name);
        return response()->json($item);
    }

    /** DELETE /api/inventory/{item} */
    public function destroy(Request $request, InventoryItem $item): JsonResponse
    {
        $name = $item->name;
        $item->delete();
        AuditLog::record($request->user(), 'INVENTORY_DELETED', $name);
        return response()->json(['message' => 'Deleted.']);
    }

    /**
     * POST /api/inventory/{item}/adjust
     * Body: { type: in|out|set, qty, reason }
     */
    public function adjust(Request $request, InventoryItem $item): JsonResponse
    {
        $data = $request->validate([
            'type'   => ['required', 'in:in,out,set'],
            'qty'    => ['required', 'numeric', 'min:0'],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $old = (float) $item->stock;
        $item->stock = match ($data['type']) {
            'in'  => round($old + (float) $data['qty'], 2),
            'out' => round($old - (float) $data['qty'], 2),
            'set' => round((float) $data['qty'], 2),
        };
        $item->save();

        StockMovement::create([
            'inventory_item_id' => $item->id,
            'type'              => $item->stock >= $old ? 'in' : 'out',
            'qty'               => abs(round($item->stock - $old, 2)),
            'reason'            => $data['reason'],
        ]);

        AuditLog::record($request->user(), 'STOCK_ADJUSTMENT',
            "{$item->name}: {$old} → {$item->stock} {$item->unit} ({$data['reason']})"
        );

        return response()->json($item->fresh());
    }

    /** GET /api/inventory/movements?limit=50 */
    public function movements(Request $request): JsonResponse
    {
        $limit = min(500, (int) $request->query('limit', 50));
        $moves = StockMovement::with('inventoryItem')
            ->latest('created_at')
            ->limit($limit)
            ->get();
        return response()->json($moves);
    }
}
