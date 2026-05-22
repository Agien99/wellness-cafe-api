<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\InventoryItem;
use App\Models\StockMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

    /**
     * POST /api/inventory/stocktake
     * Body: {
     *   note: string|null,
     *   counts: [ { inventory_item_id, physical_count } ]
     * }
     *
     * Reconciles the system stock for each listed item against the
     * physically-counted quantity. For each item where physical differs
     * from system, the stock is updated and a StockMovement record is
     * written (type = in/out depending on the direction). A single audit
     * log entry summarises the whole stocktake batch.
     */
    public function stocktake(Request $request): JsonResponse
    {
        $data = $request->validate([
            'note'                       => ['nullable', 'string', 'max:255'],
            'counts'                     => ['required', 'array', 'min:1'],
            'counts.*.inventory_item_id' => ['required', 'integer', 'exists:inventory_items,id'],
            'counts.*.physical_count'    => ['required', 'numeric', 'min:0'],
        ]);

        $reasonBase = 'Stocktake' . (!empty($data['note']) ? ' — ' . $data['note'] : '');
        $changes = [];

        DB::transaction(function () use ($data, $reasonBase, &$changes) {
            foreach ($data['counts'] as $row) {
                /** @var InventoryItem $item */
                $item = InventoryItem::find($row['inventory_item_id']);
                if (!$item) continue;

                $system   = round((float) $item->stock, 2);
                $physical = round((float) $row['physical_count'], 2);
                $diff     = round($physical - $system, 2);
                if (abs($diff) < 0.001) continue; // no variance, skip

                $item->stock = $physical;
                $item->save();

                StockMovement::create([
                    'inventory_item_id' => $item->id,
                    'type'              => $diff > 0 ? 'in' : 'out',
                    'qty'               => abs($diff),
                    'reason'            => $reasonBase,
                ]);

                $changes[] = [
                    'item'     => $item->name,
                    'system'   => $system,
                    'physical' => $physical,
                    'variance' => $diff,
                    'unit'     => $item->unit,
                ];
            }
        });

        if (!empty($changes)) {
            $summary = count($changes) . ' item(s) adjusted; ' .
                       'net variance ' . round(array_sum(array_column($changes, 'variance')), 2);
            AuditLog::record($request->user(), 'STOCKTAKE', $summary . ($data['note'] ? " — {$data['note']}" : ''));
        }

        return response()->json([
            'ok'         => true,
            'adjusted'   => count($changes),
            'changes'    => $changes,
        ]);
    }
}
