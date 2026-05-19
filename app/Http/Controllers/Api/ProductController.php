<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProductController extends Controller
{
    /** GET /api/products  — full list (sales-side uses MenuController) */
    public function index(): JsonResponse
    {
        return response()->json(Product::with('category')->orderBy('category_id')->orderBy('id')->get());
    }

    /** GET /api/products/{product} */
    public function show(Product $product): JsonResponse
    {
        return response()->json($product->load('category'));
    }

    /** POST /api/products */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => ['required', 'string', 'max:255'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'price'       => ['required', 'numeric', 'min:0'],
            'cost'        => ['nullable', 'numeric', 'min:0'],
            'size'        => ['nullable', 'string', 'max:16'],
            'image'       => ['nullable', 'string', 'max:8'],
            'available'   => ['nullable', 'boolean'],
            'recipe'      => ['nullable', 'array'],
            'recipe.*.ingredient_id' => ['required_with:recipe', 'integer', 'exists:inventory_items,id'],
            'recipe.*.qty'           => ['required_with:recipe', 'numeric', 'min:0'],
        ]);
        $data['cost']      = $data['cost'] ?? 0;
        $data['available'] = $data['available'] ?? true;
        $data['recipe']    = $data['recipe'] ?? [];
        $product = Product::create($data);
        AuditLog::record($request->user(), 'PRODUCT_CREATED', $product->name . ' (RM' . number_format($product->price, 2) . ')');
        return response()->json($product->load('category'), 201);
    }

    /** PUT /api/products/{product} */
    public function update(Request $request, Product $product): JsonResponse
    {
        $data = $request->validate([
            'name'        => ['sometimes', 'required', 'string', 'max:255'],
            'category_id' => ['sometimes', 'required', 'integer', 'exists:categories,id'],
            'price'       => ['sometimes', 'required', 'numeric', 'min:0'],
            'cost'        => ['nullable', 'numeric', 'min:0'],
            'size'        => ['nullable', 'string', 'max:16'],
            'image'       => ['nullable', 'string', 'max:8'],
            'available'   => ['nullable', 'boolean'],
            'recipe'      => ['nullable', 'array'],
            'recipe.*.ingredient_id' => ['required_with:recipe', 'integer', 'exists:inventory_items,id'],
            'recipe.*.qty'           => ['required_with:recipe', 'numeric', 'min:0'],
        ]);
        $product->update($data);
        AuditLog::record($request->user(), 'PRODUCT_UPDATED', $product->name);
        return response()->json($product->load('category'));
    }

    /** DELETE /api/products/{product}  — soft delete */
    public function destroy(Request $request, Product $product): JsonResponse
    {
        $name = $product->name;
        $product->delete();
        AuditLog::record($request->user(), 'PRODUCT_DELETED', $name);
        return response()->json(['message' => 'Deleted.']);
    }

    /**
     * POST /api/products/{product}/image  (multipart/form-data, field name = "image")
     * Uploads a product photo. Stored on the "public" disk under products/.
     * Returns the updated product (with new image_url).
     */
    public function uploadImage(Request $request, Product $product): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'image', 'max:4096'], // up to 4 MB
        ]);

        // Remove previous file if any (don't leave orphans)
        if ($product->image_path) {
            Storage::disk('public')->delete($product->image_path);
        }

        $path = $request->file('image')->store('products', 'public');
        $product->image_path = $path;
        $product->save();

        AuditLog::record($request->user(), 'PRODUCT_IMAGE_UPLOADED', $product->name);

        return response()->json($product->fresh()->load('category'));
    }

    /**
     * DELETE /api/products/{product}/image
     * Removes the uploaded image; product falls back to emoji icon.
     */
    public function removeImage(Request $request, Product $product): JsonResponse
    {
        if ($product->image_path) {
            Storage::disk('public')->delete($product->image_path);
            $product->image_path = null;
            $product->save();
            AuditLog::record($request->user(), 'PRODUCT_IMAGE_REMOVED', $product->name);
        }
        return response()->json($product->fresh()->load('category'));
    }
}
