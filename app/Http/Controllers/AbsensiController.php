<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\Setting;
use App\Models\Shift;
use Illuminate\Http\Request;

class AbsensiController extends Controller
{
    public function index()
    {
        $setting = Setting::first() ?? Setting::create([]);
        $shifts = Shift::all();
        $employees = Employee::with('shift')->where('aktif', true)->get();

        return view('absensi', compact('setting', 'shifts', 'employees'));
    }
}
