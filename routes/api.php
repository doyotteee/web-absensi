<?php

use App\Http\Controllers\Api\AbsensiApiController;
use Illuminate\Support\Facades\Route;

Route::get('/bootstrap', [AbsensiApiController::class, 'bootstrap']);
Route::post('/absen', [AbsensiApiController::class, 'absen']);
Route::get('/rekap', [AbsensiApiController::class, 'rekap']);
Route::get('/kalender', [AbsensiApiController::class, 'kalender']);

Route::get('/leaves', [AbsensiApiController::class, 'leaves']);
Route::post('/leaves', [AbsensiApiController::class, 'submitLeave']);
Route::patch('/leaves/{id}', [AbsensiApiController::class, 'updateLeaveStatus']);

Route::post('/karyawan', [AbsensiApiController::class, 'saveEmployee']);
Route::delete('/karyawan/{id}', [AbsensiApiController::class, 'deleteEmployee']);

Route::post('/shift', [AbsensiApiController::class, 'saveShift']);
Route::delete('/shift/{id}', [AbsensiApiController::class, 'deleteShift']);

Route::post('/settings', [AbsensiApiController::class, 'saveSettings']);
Route::get('/ekspor/csv', [AbsensiApiController::class, 'exportCsv']);
