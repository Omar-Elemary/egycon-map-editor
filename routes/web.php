<?php

use App\Http\Controllers\ExploreController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => view('editor'));
Route::get('/m/{id}', [ExploreController::class, 'show']);
