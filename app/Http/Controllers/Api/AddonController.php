<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Addon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AddonController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            Addon::query()
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                'unique:addons,name',
            ],

            'price' => [
                'required',
                'numeric',
                'min:0',
            ],

            'available' => [
                'nullable',
                'boolean',
            ],

            'sort_order' => [
                'nullable',
                'integer',
                'min:0',
            ],
        ]);

        $addon = Addon::create([
            'name' => $data['name'],
            'price' => $data['price'],
            'available' => $data['available'] ?? true,
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        return response()->json($addon, 201);
    }

    public function show(Addon $addon): JsonResponse
    {
        return response()->json(
            $addon->load('products')
        );
    }

    public function update(
        Request $request,
        Addon $addon
    ): JsonResponse {
        $data = $request->validate([
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('addons', 'name')
                    ->ignore($addon->id),
            ],

            'price' => [
                'sometimes',
                'required',
                'numeric',
                'min:0',
            ],

            'available' => [
                'nullable',
                'boolean',
            ],

            'sort_order' => [
                'nullable',
                'integer',
                'min:0',
            ],
        ]);

        $addon->update($data);

        return response()->json(
            $addon->fresh()
        );
    }

    public function destroy(Addon $addon): JsonResponse
    {
        $addon->delete();

        return response()->json([
            'message' => 'Add-on deleted.',
        ]);
    }
}