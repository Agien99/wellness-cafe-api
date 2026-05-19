<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    /** GET /api/categories  — full list (read-only via MenuController, this is CRUD-aware) */
    public function index(): JsonResponse
    {
        return response()->json(Category::orderBy('sort_order')->orderBy('id')->get());
    }

    /** GET /api/categories/{category} */
    public function show(Category $category): JsonResponse
    {
        return response()->json($category);
    }

    /** POST /api/categories */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'       => ['required', 'string', 'max:255'],
            'icon'       => ['nullable', 'string', 'max:8'],
            'color'      => ['nullable', 'string', 'max:16'],
            'sort_order' => ['nullable', 'integer'],
        ]);
        $data['sort_order'] = $data['sort_order'] ?? (Category::max('sort_order') + 1);
        $cat = Category::create($data);
        AuditLog::record($request->user(), 'CATEGORY_CREATED', $cat->name);
        return response()->json($cat, 201);
    }

    /** PUT /api/categories/{category} */
    public function update(Request $request, Category $category): JsonResponse
    {
        $data = $request->validate([
            'name'       => ['sometimes', 'required', 'string', 'max:255'],
            'icon'       => ['nullable', 'string', 'max:8'],
            'color'      => ['nullable', 'string', 'max:16'],
            'sort_order' => ['nullable', 'integer'],
        ]);
        $category->update($data);
        AuditLog::record($request->user(), 'CATEGORY_UPDATED', $category->name);
        return response()->json($category);
    }

    /** DELETE /api/categories/{category}  — soft delete */
    public function destroy(Request $request, Category $category): JsonResponse
    {
        $activeProducts = $category->products()->count();
        if ($activeProducts > 0) {
            return response()->json([
                'message' => "Cannot delete: category has {$activeProducts} active product(s). Move or delete them first."
            ], 422);
        }
        $name = $category->name;
        $category->delete();
        AuditLog::record($request->user(), 'CATEGORY_DELETED', $name);
        return response()->json(['message' => 'Deleted.']);
    }
}
