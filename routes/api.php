<?php

use App\Http\Controllers\ShareController;
use Illuminate\Support\Facades\Route;

Route::post('/share', [ShareController::class, 'store']);
Route::get('/share/{id}', [ShareController::class, 'show']);
Route::patch('/share/{id}', [ShareController::class, 'update']);
Route::delete('/share/{id}', [ShareController::class, 'destroy']);
