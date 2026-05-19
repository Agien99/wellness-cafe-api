<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
| Customer QR ordering lives at /  (public/index.html).
| Staff portal lives at /staff or /staff.html.
| Both are static SPAs in public/. These routes are safety nets for
| `php artisan serve` — on Apache (cPanel), DirectoryIndex handles
| index.html automatically.
*/

// Customer QR ordering — the default landing page.
Route::get('/', function () {
    return response()->file(public_path('index.html'));
});

// Staff portal entry (clean URL alias for /staff.html).
Route::get('/staff', function () {
    return response()->file(public_path('staff.html'));
});

// Named "login" route so the auth middleware has somewhere to redirect
// when a browser navigation hits a protected URL without a token.
Route::get('/login', function () {
    return redirect('/staff');
})->name('login');

// Short URL for QR ordering (e.g., on QR code stickers).
Route::get('/qr', function () {
    return redirect('/');
});
