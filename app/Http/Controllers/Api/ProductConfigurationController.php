<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Addon;
use App\Models\Product;
use App\Models\ProductOptionGroup;
use App\Models\ProductOptionValue;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductConfigurationController extends Controller
{
    private function loadProduct(Product $product): Product
    {
        return $product->load([
            'category',
            'optionGroups.values',
            'variants.optionValues',
            'addons',
        ]);
    }

    // -------------------------------------------------------------------------
    // Option Groups
    // -------------------------------------------------------------------------

    public function storeOptionGroup(
        Request $request,
        Product $product
    ): JsonResponse {
        $data = $request->validate([
            'name'       => ['required', 'string', 'max:255'],
            'required'   => ['nullable', 'boolean'],
            'multiple'   => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $product->optionGroups()->create([
            'name'       => $data['name'],
            'required'   => $data['required'] ?? true,
            'multiple'   => $data['multiple'] ?? false,
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        return response()->json(
            $this->loadProduct($product),
            201
        );
    }

    public function updateOptionGroup(
        Request $request,
        ProductOptionGroup $optionGroup
    ): JsonResponse {
        $data = $request->validate([
            'name'       => ['sometimes', 'required', 'string', 'max:255'],
            'required'   => ['nullable', 'boolean'],
            'multiple'   => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $optionGroup->update($data);

        return response()->json(
            $this->loadProduct($optionGroup->product)
        );
    }

    public function destroyOptionGroup(
        ProductOptionGroup $optionGroup
    ): JsonResponse {
        $product = $optionGroup->product;

        $optionGroup->delete();

        return response()->json(
            $this->loadProduct($product)
        );
    }

    // -------------------------------------------------------------------------
    // Option Values
    // -------------------------------------------------------------------------

    public function storeOptionValue(
        Request $request,
        ProductOptionGroup $optionGroup
    ): JsonResponse {
        $data = $request->validate([
            'name'       => ['required', 'string', 'max:255'],
            'available'  => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $optionGroup->values()->create([
            'name'       => $data['name'],
            'available'  => $data['available'] ?? true,
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        return response()->json(
            $this->loadProduct($optionGroup->product),
            201
        );
    }

    public function updateOptionValue(
        Request $request,
        ProductOptionValue $optionValue
    ): JsonResponse {
        $data = $request->validate([
            'name'       => ['sometimes', 'required', 'string', 'max:255'],
            'available'  => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $optionValue->update($data);

        return response()->json(
            $this->loadProduct(
                $optionValue->group->product
            )
        );
    }

    public function destroyOptionValue(
        ProductOptionValue $optionValue
    ): JsonResponse {
        $product = $optionValue->group->product;

        $optionValue->delete();

        return response()->json(
            $this->loadProduct($product)
        );
    }

    // -------------------------------------------------------------------------
    // Variants
    // -------------------------------------------------------------------------

    public function storeVariant(
        Request $request,
        Product $product
    ): JsonResponse {
        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
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

            'option_value_ids' => [
                'required',
                'array',
                'min:1',
            ],

            'option_value_ids.*' => [
                'integer',
                'exists:product_option_values,id',
            ],
        ]);

        $validValueIds = ProductOptionValue::query()
            ->whereIn('id', $data['option_value_ids'])
            ->whereHas('group', function ($query) use ($product) {
                $query->where('product_id', $product->id);
            })
            ->pluck('id');

        if (
            $validValueIds->count() !==
            count(array_unique($data['option_value_ids']))
        ) {
            return response()->json([
                'message' =>
                    'One or more option values do not belong to this product.',
            ], 422);
        }

        $variant = $product->variants()->create([
            'name'       => $data['name'],
            'price'      => $data['price'],
            'available'  => $data['available'] ?? true,
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        $variant->optionValues()->sync(
            $validValueIds->all()
        );

        $product->update([
            'product_type' => 'configurable',
        ]);

        return response()->json(
            $this->loadProduct($product),
            201
        );
    }

    public function updateVariant(
        Request $request,
        ProductVariant $variant
    ): JsonResponse {
        $data = $request->validate([
            'name'       => ['sometimes', 'required', 'string', 'max:255'],
            'price'      => ['sometimes', 'required', 'numeric', 'min:0'],
            'available'  => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],

            'option_value_ids' => [
                'sometimes',
                'required',
                'array',
                'min:1',
            ],

            'option_value_ids.*' => [
                'integer',
                'exists:product_option_values,id',
            ],
        ]);

        if (isset($data['option_value_ids'])) {
            $validValueIds = ProductOptionValue::query()
                ->whereIn('id', $data['option_value_ids'])
                ->whereHas('group', function ($query) use ($variant) {
                    $query->where(
                        'product_id',
                        $variant->product_id
                    );
                })
                ->pluck('id');

            if (
                $validValueIds->count() !==
                count(array_unique($data['option_value_ids']))
            ) {
                return response()->json([
                    'message' =>
                        'One or more option values do not belong to this product.',
                ], 422);
            }

            $variant->optionValues()->sync(
                $validValueIds->all()
            );

            unset($data['option_value_ids']);
        }

        $variant->update($data);

        return response()->json(
            $this->loadProduct($variant->product)
        );
    }

    public function destroyVariant(
        ProductVariant $variant
    ): JsonResponse {
        $product = $variant->product;

        $variant->delete();

        if (!$product->variants()->exists()) {
            $product->update([
                'product_type' => 'simple',
            ]);
        }

        return response()->json(
            $this->loadProduct($product)
        );
    }

    // -------------------------------------------------------------------------
    // Product Add-ons
    // -------------------------------------------------------------------------

    public function syncAddons(
        Request $request,
        Product $product
    ): JsonResponse {
        $data = $request->validate([
            'addon_ids'   => ['nullable', 'array'],
            'addon_ids.*' => ['integer', 'exists:addons,id'],
        ]);

        $addonIds = $data['addon_ids'] ?? [];

        $product->addons()->sync(
            array_unique($addonIds)
        );

        return response()->json(
            $this->loadProduct($product)
        );
    }
}