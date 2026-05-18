<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\KitchenController;
use App\Http\Controllers\Api\MenuController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PromotionController;
use App\Http\Controllers\Api\TableController;
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

// Authenticated ---------------------------------------------------------------
Route::middleware('auth:sanctum')->group(function () {

    // -- Auth --
    Route::get('/me',      [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // -- Menu / catalog --
    Route::get('/menu',       [MenuController::class, 'index']);
    Route::get('/categories', [MenuController::class, 'categories']);
    Route::get('/products',   [MenuController::class, 'products']);

    // -- Tables --
    Route::get('/tables', [TableController::class, 'index']);

    // -- Customers --
    Route::get   ('/customers',         [CustomerController::class, 'index']);
    Route::post  ('/customers',         [CustomerController::class, 'store']);
    Route::get   ('/customers/{customer}', [CustomerController::class, 'show']);
    Route::put   ('/customers/{customer}', [CustomerController::class, 'update']);
    Route::delete('/customers/{customer}', [CustomerController::class, 'destroy']);

    // -- Promotions --
    Route::get ('/promotions',          [PromotionController::class, 'index']);
    Route::post('/promotions/validate', [PromotionController::class, 'validateCode']);

    // -- Orders --
    Route::get ('/orders',         [OrderController::class, 'index']);
    Route::post('/orders',         [OrderController::class, 'store']);
    Route::get ('/orders/{order}', [OrderController::class, 'show']);

    // -- Kitchen Display System --
    Route::get  ('/kitchen/orders',                 [KitchenController::class, 'index']);
    Route::patch('/kitchen/orders/{order}/status',  [KitchenController::class, 'updateStatus']);

});
