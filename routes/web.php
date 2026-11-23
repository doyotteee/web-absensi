<?php

use App\Http\Controllers\AbsensiController;
use App\Http\Controllers\Api\AbsensiApiController;
use Illuminate\Support\Facades\Route;

Route::get('/', [AbsensiController::class, 'index'])->name('home');
Route::get('/ekspor/csv', [AbsensiApiController::class, 'exportCsv'])->name('ekspor.csv');
