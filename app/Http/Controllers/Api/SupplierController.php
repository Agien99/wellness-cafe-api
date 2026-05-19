<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Supplier::orderBy('name')->get());
    }

    public function show(Supplier $supplier): JsonResponse
    {
        return response()->json($supplier->load('inventoryItems'));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:255'],
            'contact'  => ['nullable', 'string', 'max:255'],
            'phone'    => ['nullable', 'string', 'max:32'],
            'email'    => ['nullable', 'email', 'max:255'],
            'address'  => ['nullable', 'string', 'max:500'],
        ]);
        $supplier = Supplier::create($data);
        AuditLog::record($request->user(), 'SUPPLIER_CREATED', $supplier->name);
        return response()->json($supplier, 201);
    }

    public function update(Request $request, Supplier $supplier): JsonResponse
    {
        $data = $request->validate([
            'name'     => ['sometimes', 'required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:255'],
            'contact'  => ['nullable', 'string', 'max:255'],
            'phone'    => ['nullable', 'string', 'max:32'],
            'email'    => ['nullable', 'email', 'max:255'],
            'address'  => ['nullable', 'string', 'max:500'],
        ]);
        $supplier->update($data);
        AuditLog::record($request->user(), 'SUPPLIER_UPDATED', $supplier->name);
        return response()->json($supplier);
    }

    public function destroy(Request $request, Supplier $supplier): JsonResponse
    {
        $name = $supplier->name;
        $supplier->delete();
        AuditLog::record($request->user(), 'SUPPLIER_DELETED', $name);
        return response()->json(['message' => 'Deleted.']);
    }
}
