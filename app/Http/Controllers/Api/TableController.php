<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Table;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * TableController — full CRUD for dining tables.
 * Used by the cafe owner to add/edit/remove tables from the QR ordering UI.
 * "Delete" is a soft-delete so existing orders that reference a removed table
 * keep working.
 */
class TableController extends Controller
{
    /** GET /api/tables */
    public function index(): JsonResponse
    {
        return response()->json(Table::orderBy('id')->get());
    }

    /** POST /api/tables */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => ['required', 'string', 'max:16', 'unique:tables,name'],
            'capacity' => ['required', 'integer', 'min:1', 'max:50'],
            'status'   => ['nullable', 'in:available,occupied,reserved'],
        ]);
        $data['status'] = $data['status'] ?? 'available';

        $table = Table::create($data);

        AuditLog::record($request->user(), 'TABLE_CREATED',
            "Table {$table->name} (capacity {$table->capacity}) created");

        return response()->json($table, 201);
    }

    /** GET /api/tables/{table} */
    public function show(Table $table): JsonResponse
    {
        return response()->json($table);
    }

    /** PUT /api/tables/{table} */
    public function update(Request $request, Table $table): JsonResponse
    {
        $data = $request->validate([
            'name'     => ['required', 'string', 'max:16', 'unique:tables,name,' . $table->id],
            'capacity' => ['required', 'integer', 'min:1', 'max:50'],
            'status'   => ['nullable', 'in:available,occupied,reserved'],
        ]);

        $table->update($data);

        AuditLog::record($request->user(), 'TABLE_UPDATED', "Table {$table->name} updated");

        return response()->json($table->fresh());
    }

    /** DELETE /api/tables/{table} — soft delete */
    public function destroy(Request $request, Table $table): JsonResponse
    {
        $name = $table->name;
        $table->delete();

        AuditLog::record($request->user(), 'TABLE_DELETED', "Table {$name} removed");

        return response()->json(['ok' => true]);
    }
}
