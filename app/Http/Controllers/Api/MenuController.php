<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\JsonResponse;

class MenuController extends Controller
{
    /**
     * GET /api/menu
     * Returns categories + products in one call (POS uses this on load).
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'categories' => Category::orderBy('sort_order')->get(),
            'products'   => Product::orderBy('category_id')->orderBy('id')->get(),
        ]);
    }

    /** GET /api/categories */
    public function categories(): JsonResponse
    {
        return response()->json(Category::orderBy('sort_order')->get());
    }

    /** GET /api/products */
    public function products(): JsonResponse
    {
        return response()->json(Product::with('category')->get());
    }
}
