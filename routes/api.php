<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\InventoryItemController;
use App\Http\Controllers\Api\KitchenController;
use App\Http\Controllers\Api\MenuController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PromotionController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\RefundController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\TableController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — Wellness Cafe Integrated POS
|--------------------------------------------------------------------------
*/

// Public ----------------------------------------------------------------------
Route::get('/health', fn () => response()->json([
    'status'  => 'ok',
    'service' => 'Wellness Cafe POS API',
    'time'    => now()->toIso8601String(),
]));

Route::post('/login', [AuthController::class, 'login']);

// Public (for guest QR ordering — customers don't log in)
Route::get ('/public/menu',   [\App\Http\Controllers\Api\PublicController::class, 'menu']);
Route::get ('/public/tables', [\App\Http\Controllers\Api\PublicController::class, 'tables']);
Route::post('/public/orders', [\App\Http\Controllers\Api\PublicController::class, 'createOrder']);

// Authenticated ---------------------------------------------------------------
Route::middleware('auth:sanctum')->group(function () {

    // -- Auth --
    Route::get('/me',      [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // -- Menu / catalog (read endpoints used by POS) --
    Route::get('/menu', [MenuController::class, 'index']);

    // -- Categories (full CRUD) --
    Route::get   ('/categories',             [CategoryController::class, 'index']);
    Route::post  ('/categories',             [CategoryController::class, 'store']);
    Route::get   ('/categories/{category}',  [CategoryController::class, 'show']);
    Route::put   ('/categories/{category}',  [CategoryController::class, 'update']);
    Route::delete('/categories/{category}',  [CategoryController::class, 'destroy']);

    // -- Products (full CRUD + image upload) --
    Route::get   ('/products',                 [ProductController::class, 'index']);
    Route::post  ('/products',                 [ProductController::class, 'store']);
    Route::get   ('/products/{product}',       [ProductController::class, 'show']);
    Route::put   ('/products/{product}',       [ProductController::class, 'update']);
    Route::delete('/products/{product}',       [ProductController::class, 'destroy']);
    Route::post  ('/products/{product}/image', [ProductController::class, 'uploadImage']);
    Route::delete('/products/{product}/image', [ProductController::class, 'removeImage']);

    // -- Tables --
    Route::get('/tables', [TableController::class, 'index']);

    // -- Customers --
    Route::get   ('/customers',            [CustomerController::class, 'index']);
    Route::post  ('/customers',            [CustomerController::class, 'store']);
    Route::get   ('/customers/{customer}', [CustomerController::class, 'show']);
    Route::put   ('/customers/{customer}', [CustomerController::class, 'update']);
    Route::delete('/customers/{customer}', [CustomerController::class, 'destroy']);

    // -- Promotions --
    Route::get   ('/promotions',                [PromotionController::class, 'index']);
    Route::post  ('/promotions',                [PromotionController::class, 'store']);
    Route::post  ('/promotions/validate',       [PromotionController::class, 'validateCode']);
    Route::get   ('/promotions/{promotion}',    [PromotionController::class, 'show']);
    Route::put   ('/promotions/{promotion}',    [PromotionController::class, 'update']);
    Route::delete('/promotions/{promotion}',    [PromotionController::class, 'destroy']);

    // -- Orders --
    Route::get ('/orders',                 [OrderController::class, 'index']);
    Route::post('/orders',                 [OrderController::class, 'store']);
    Route::get ('/orders/{order}',         [OrderController::class, 'show']);
    Route::post('/orders/{order}/payment', [OrderController::class, 'takePayment']);

    // -- Kitchen Display System --
    Route::get  ('/kitchen/orders',                [KitchenController::class, 'index']);
    Route::patch('/kitchen/orders/{order}/status', [KitchenController::class, 'updateStatus']);

    // -- Inventory --
    Route::get   ('/inventory/movements',      [InventoryItemController::class, 'movements']);
    Route::get   ('/inventory',                [InventoryItemController::class, 'index']);
    Route::post  ('/inventory',                [InventoryItemController::class, 'store']);
    Route::get   ('/inventory/{item}',         [InventoryItemController::class, 'show']);
    Route::put   ('/inventory/{item}',         [InventoryItemController::class, 'update']);
    Route::delete('/inventory/{item}',         [InventoryItemController::class, 'destroy']);
    Route::post  ('/inventory/{item}/adjust',  [InventoryItemController::class, 'adjust']);

    // -- Suppliers --
    Route::get   ('/suppliers',             [SupplierController::class, 'index']);
    Route::post  ('/suppliers',             [SupplierController::class, 'store']);
    Route::get   ('/suppliers/{supplier}',  [SupplierController::class, 'show']);
    Route::put   ('/suppliers/{supplier}',  [SupplierController::class, 'update']);
    Route::delete('/suppliers/{supplier}',  [SupplierController::class, 'destroy']);

    // -- Purchase Orders --
    Route::get ('/purchase-orders',                         [PurchaseOrderController::class, 'index']);
    Route::post('/purchase-orders',                         [PurchaseOrderController::class, 'store']);
    Route::get ('/purchase-orders/{purchaseOrder}',         [PurchaseOrderController::class, 'show']);
    Route::post('/purchase-orders/{purchaseOrder}/receive', [PurchaseOrderController::class, 'receive']);

    // -- Refunds --
    Route::get ('/refunds',           [RefundController::class, 'index']);
    Route::post('/refunds',           [RefundController::class, 'store']);
    Route::get ('/refunds/{refund}',  [RefundController::class, 'show']);

    // -- Reports & Analytics --
    Route::get('/reports/dashboard', [ReportController::class, 'dashboard']);
    Route::get('/reports/sales',     [ReportController::class, 'sales']);
    Route::get('/reports/sales.csv', [ReportController::class, 'salesCsv']);
    Route::get('/reports/audit',     [ReportController::class, 'audit']);

    // -- Users & Roles --
    Route::get   ('/users',         [UserController::class, 'index']);
    Route::post  ('/users',         [UserController::class, 'store']);
    Route::get   ('/users/{user}',  [UserController::class, 'show']);
    Route::put   ('/users/{user}',  [UserController::class, 'update']);
    Route::delete('/users/{user}',  [UserController::class, 'destroy']);
    Route::get   ('/roles',         [UserController::class, 'roles']);

});
