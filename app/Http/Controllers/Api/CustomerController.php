<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    /** GET /api/customers */
    public function index(Request $request): JsonResponse
    {
        $q = $request->query('q');
        $query = Customer::query()->orderBy('name');
        if ($q) {
            $query->where(function ($s) use ($q) {
                $s->where('name', 'like', "%{$q}%")
                  ->orWhere('phone', 'like', "%{$q}%")
                  ->orWhere('email', 'like', "%{$q}%");
            });
        }
        return response()->json($query->get());
    }

    /** GET /api/customers/{id} */
    public function show(Customer $customer): JsonResponse
    {
        return response()->json($customer);
    }

    /** POST /api/customers */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'       => ['required', 'string', 'max:255'],
            'phone'      => ['nullable', 'string', 'max:32'],
            'email'      => ['nullable', 'email', 'max:255'],
            'membership' => ['nullable', 'in:None,Bronze,Silver,Gold,Platinum'],
        ]);
        $data['membership'] = $data['membership'] ?? 'Bronze';
        $data['joined_at'] = now()->toDateString();
        $customer = Customer::create($data);

        AuditLog::record($request->user(), 'CUSTOMER_CREATED', $customer->name);
        return response()->json($customer, 201);
    }

    /** PUT /api/customers/{id} */
    public function update(Request $request, Customer $customer): JsonResponse
    {
        $data = $request->validate([
            'name'       => ['sometimes', 'required', 'string', 'max:255'],
            'phone'      => ['nullable', 'string', 'max:32'],
            'email'      => ['nullable', 'email', 'max:255'],
            'membership' => ['nullable', 'in:None,Bronze,Silver,Gold,Platinum'],
            'points'     => ['nullable', 'integer', 'min:0'],
        ]);
        $customer->update($data);
        AuditLog::record($request->user(), 'CUSTOMER_UPDATED', $customer->name);
        return response()->json($customer);
    }

    /** DELETE /api/customers/{id} */
    public function destroy(Request $request, Customer $customer): JsonResponse
    {
        if ($customer->id === 8) {
            return response()->json(['message' => 'Walk-in customer cannot be deleted.'], 422);
        }
        $name = $customer->name;
        $customer->delete();
        AuditLog::record($request->user(), 'CUSTOMER_DELETED', $name);
        return response()->json(['message' => 'Deleted.']);
    }
}
