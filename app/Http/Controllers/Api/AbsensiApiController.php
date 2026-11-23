<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Leave;
use App\Models\Setting;
use App\Models\Shift;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AbsensiApiController extends Controller
{
    public function bootstrap()
    {
        $setting = Setting::first() ?? Setting::create([]);
        $shifts = Shift::all();
        $employees = Employee::with('shift')->where('aktif', true)->get();
        $today = Carbon::today()->toDateString();
        $todayAttendances = Attendance::with('employee')
            ->whereDate('tgl', $today)
            ->get();
        $pendingLeavesCount = Leave::where('status', 'menunggu')->count();

        return response()->json([
            'status' => 'success',
            'data' => [
                'setting' => $setting,
                'shifts' => $shifts,
                'karyawan' => $employees,
                'absenHariIni' => $todayAttendances,
                'izinMenunggu' => $pendingLeavesCount,
                'serverTime' => Carbon::now()->toIso8601String(),
            ]
        ]);
    }

    public function absen(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => 'required|exists:employees,id',
            'pin' => 'nullable|string',
            'lat' => 'nullable|numeric',
            'lng' => 'nullable|numeric',
            'foto' => 'nullable|string', // base64 or url
            'sumber' => 'nullable|string|in:web,hp,kiosk',
        ]);

        $setting = Setting::first() ?? Setting::create([]);
        $employee = Employee::with('shift')->findOrFail($validated['employee_id']);

        // Check PIN if kiosk mode
        if (($validated['sumber'] ?? 'web') === 'kiosk' && !empty($employee->pin)) {
            if (($validated['pin'] ?? '') !== $employee->pin) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'PIN salah! Silakan coba lagi.'
                ], 422);
            }
        }

        // Distance & Geofencing check
        $jarak = null;
        if ($setting->pakai_lokasi && !empty($setting->lat) && !empty($setting->lng) && !empty($validated['lat']) && !empty($validated['lng'])) {
            $jarak = $this->hitungJarak($setting->lat, $setting->lng, $validated['lat'], $validated['lng']);
            if ($setting->wajib_radius && $jarak > $setting->radius) {
                return response()->json([
                    'status' => 'error',
                    'message' => "Anda berada di luar radius kantor! Jarak: {$jarak}m (Maksimal: {$setting->radius}m)."
                ], 422);
            }
        } elseif ($setting->wajib_radius && (empty($validated['lat']) || empty($validated['lng']))) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lokasi GPS wajib diaktifkan untuk melakukan absensi!'
            ], 422);
        }

        // Selfie validation
        if ($setting->wajib_selfie && empty($validated['foto'])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Foto selfie wajib diambil saat absen!'
            ], 422);
        }

        // Save selfie photo if provided
        $fotoPath = null;
        if (!empty($validated['foto']) && str_starts_with($validated['foto'], 'data:image')) {
            $fotoPath = $this->simpanFotoBase64($validated['foto']);
        }

        $now = Carbon::now();
        $today = $now->toDateString();
        $shift = $employee->shift;
        $jadwalMasuk = $shift ? $shift->masuk : '08:00';
        $jadwalPulang = $shift ? $shift->pulang : '16:00';

        $attendance = Attendance::where('employee_id', $employee->id)
            ->whereDate('tgl', $today)
            ->first();

        if (!$attendance) {
            // Check-IN
            $shiftMasukTime = Carbon::parse($today . ' ' . $jadwalMasuk);
            $toleransi = (int) ($shift ? $shift->toleransi : 10);
            $telat = 0;
            if ($now->gt($shiftMasukTime->copy()->addMinutes($toleransi))) {
                $telat = (int) round($shiftMasukTime->diffInMinutes($now, true));
            }

            $attendance = Attendance::create([
                'employee_id' => $employee->id,
                'tgl' => $today,
                'masuk' => $now,
                'pulang' => null,
                'telat' => $telat,
                'lembur' => 0,
                'jadwal_masuk' => $jadwalMasuk,
                'jadwal_pulang' => $jadwalPulang,
                'lat' => $validated['lat'] ?? null,
                'lng' => $validated['lng'] ?? null,
                'jarak' => $jarak,
                'foto_masuk' => $fotoPath,
                'sumber' => $validated['sumber'] ?? 'web',
            ]);

            return response()->json([
                'status' => 'success',
                'tipe' => 'masuk',
                'message' => "Check-in berhasil pukul {$now->format('H:i')}." . ($telat > 0 ? " (Terlambat {$telat} menit)" : " (Tepat waktu)"),
                'data' => $attendance->load('employee'),
            ]);
        } elseif (is_null($attendance->pulang)) {
            // Check-OUT
            $shiftPulangTime = Carbon::parse($today . ' ' . $jadwalPulang);
            // If night shift (crosses midnight)
            if ($shiftPulangTime->lte(Carbon::parse($today . ' ' . $jadwalMasuk))) {
                $shiftPulangTime->addDay();
            }

            $minLembur = (int) ($setting->min_lembur ?? 30);
            $lembur = 0;
            if ($now->gt($shiftPulangTime) && $shiftPulangTime->diffInMinutes($now, true) >= $minLembur) {
                $lembur = (int) round($shiftPulangTime->diffInMinutes($now, true));
            }

            $attendance->update([
                'pulang' => $now,
                'lembur' => $lembur,
                'foto_pulang' => $fotoPath ?? $attendance->foto_pulang,
            ]);

            return response()->json([
                'status' => 'success',
                'tipe' => 'pulang',
                'message' => "Check-out berhasil pukul {$now->format('H:i')}." . ($lembur > 0 ? " (Lembur " . floor($lembur/60) . "j " . ($lembur%60) . "m)" : ""),
                'data' => $attendance->load('employee'),
            ]);
        } else {
            return response()->json([
                'status' => 'info',
                'message' => "Anda sudah menyelesaikan absensi masuk ({$attendance->masuk?->format('H:i')}) dan pulang ({$attendance->pulang?->format('H:i')}) hari ini.",
                'data' => $attendance->load('employee'),
            ]);
        }
    }

    public function rekap(Request $request)
    {
        $bulanStr = $request->query('bulan', Carbon::today()->format('Y-m'));
        $start = Carbon::parse($bulanStr . '-01')->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $setting = Setting::first() ?? Setting::create([]);
        $employees = Employee::with('shift')->where('aktif', true)->get();

        $attendances = Attendance::whereBetween('tgl', [$start->toDateString(), $end->toDateString()])->get();
        $leaves = Leave::where('status', 'disetujui')
            ->where(function ($q) use ($start, $end) {
                $q->whereBetween('dari', [$start->toDateString(), $end->toDateString()])
                  ->orWhereBetween('sampai', [$start->toDateString(), $end->toDateString()]);
            })->get();

        $rekapKaryawan = [];
        $totalHadir = 0;
        $totalTelat = 0;
        $totalIzin = 0;
        $totalAlpa = 0;
        $totalLemburMenit = 0;

        foreach ($employees as $emp) {
            $empAttendances = $attendances->where('employee_id', $emp->id);
            $hadirCount = $empAttendances->count();
            $telatCount = $empAttendances->where('telat', '>', 0)->count();
            $lemburMenit = $empAttendances->sum('lembur');

            // Count leaves for this employee
            $empLeaves = $leaves->where('employee_id', $emp->id);
            $izinDays = 0;
            foreach ($empLeaves as $l) {
                $dStart = Carbon::parse($l->dari)->clamp($start, $end);
                $dEnd = Carbon::parse($l->sampai)->clamp($start, $end);
                $izinDays += $dStart->diffInDays($dEnd) + 1;
            }

            // Calculate working days in month up to today (or end of month)
            $workingDays = 0;
            $checkEnd = $end->isFuture() ? Carbon::today() : $end;
            $hariKerjaArr = $emp->hari_kerja ?? [1, 2, 3, 4, 5, 6];
            for ($d = $start->copy(); $d->lte($checkEnd); $d->addDay()) {
                if (in_array($d->dayOfWeek, $hariKerjaArr)) {
                    $workingDays++;
                }
            }

            $alpa = max(0, $workingDays - ($hadirCount + $izinDays));

            // Perkiraan Tunjangan & Potongan
            $uangMakan = $hadirCount * ($setting->uang_makan ?? 25000);
            $uangLembur = round(($lemburMenit / 60) * ($setting->uang_lembur ?? 20000));
            $totalTunjangan = $uangMakan + $uangLembur;

            $potTelat = $telatCount * ($setting->pot_telat ?? 10000);
            $potAlpa = $alpa * ($setting->pot_alpa ?? 75000);
            $totalPotongan = $potTelat + $potAlpa;

            $bersih = $totalTunjangan - $totalPotongan;

            $rekapKaryawan[] = [
                'employee' => $emp,
                'hadir' => $hadirCount,
                'telat' => $telatCount,
                'izin' => $izinDays,
                'alpa' => $alpa,
                'lembur_menit' => $lemburMenit,
                'tunjangan' => $totalTunjangan,
                'potongan' => $totalPotongan,
                'bersih' => $bersih,
            ];

            $totalHadir += $hadirCount;
            $totalTelat += $telatCount;
            $totalIzin += $izinDays;
            $totalAlpa += $alpa;
            $totalLemburMenit += $lemburMenit;
        }

        return response()->json([
            'status' => 'success',
            'bulan' => $start->translatedFormat('F Y'),
            'bulanKey' => $bulanStr,
            'ringkasan' => [
                'totalHadir' => $totalHadir,
                'totalTelat' => $totalTelat,
                'totalIzin' => $totalIzin,
                'totalAlpa' => $totalAlpa,
                'totalLembur' => round($totalLemburMenit / 60, 1),
            ],
            'items' => $rekapKaryawan,
        ]);
    }

    public function kalender(Request $request)
    {
        $bulanStr = $request->query('bulan', Carbon::today()->format('Y-m'));
        $employeeId = $request->query('employee_id');

        $start = Carbon::parse($bulanStr . '-01')->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $query = Attendance::whereBetween('tgl', [$start->toDateString(), $end->toDateString()]);
        if ($employeeId) {
            $query->where('employee_id', $employeeId);
        }
        $attendances = $query->get();

        $leaveQuery = Leave::where(function ($q) use ($start, $end) {
            $q->whereBetween('dari', [$start->toDateString(), $end->toDateString()])
              ->orWhereBetween('sampai', [$start->toDateString(), $end->toDateString()]);
        });
        if ($employeeId) {
            $leaveQuery->where('employee_id', $employeeId);
        }
        $leaves = $leaveQuery->get();

        return response()->json([
            'status' => 'success',
            'attendances' => $attendances,
            'leaves' => $leaves,
        ]);
    }

    public function leaves(Request $request)
    {
        $status = $request->query('status');
        $query = Leave::with('employee')->latest();
        if ($status && in_array($status, ['menunggu', 'disetujui', 'ditolak'])) {
            $query->where('status', $status);
        }
        return response()->json([
            'status' => 'success',
            'data' => $query->get(),
        ]);
    }

    public function submitLeave(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => 'required|exists:employees,id',
            'jenis' => 'required|in:izin,sakit,cuti',
            'dari' => 'required|date',
            'sampai' => 'required|date|after_or_equal:dari',
            'alasan' => 'required|string|max:500',
            'lampiran' => 'nullable|string',
        ]);

        $lampiranPath = null;
        if (!empty($validated['lampiran']) && str_starts_with($validated['lampiran'], 'data:image')) {
            $lampiranPath = $this->simpanFotoBase64($validated['lampiran'], 'lampiran');
        }

        $leave = Leave::create([
            'employee_id' => $validated['employee_id'],
            'jenis' => $validated['jenis'],
            'dari' => $validated['dari'],
            'sampai' => $validated['sampai'],
            'alasan' => $validated['alasan'],
            'lampiran' => $lampiranPath,
            'status' => 'menunggu',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Pengajuan berhasil dikirim dan menunggu persetujuan.',
            'data' => $leave->load('employee'),
        ]);
    }

    public function updateLeaveStatus(Request $request, $id)
    {
        $validated = $request->validate([
            'status' => 'required|in:disetujui,ditolak,menunggu',
        ]);

        $leave = Leave::findOrFail($id);
        $leave->update(['status' => $validated['status']]);

        return response()->json([
            'status' => 'success',
            'message' => "Pengajuan berhasil diubah menjadi {$validated['status']}.",
            'data' => $leave->load('employee'),
        ]);
    }

    public function saveSettings(Request $request)
    {
        $setting = Setting::first() ?? new Setting();

        $data = $request->only([
            'nama_kantor', 'pakai_lokasi', 'wajib_radius',
            'lat', 'lng', 'radius', 'pakai_selfie', 'wajib_selfie',
            'pin_admin', 'uang_makan', 'uang_lembur', 'pot_telat',
            'pot_alpa', 'min_lembur'
        ]);

        $setting->fill($data);
        $setting->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Pengaturan berhasil disimpan.',
            'data' => $setting,
        ]);
    }

    public function saveEmployee(Request $request)
    {
        $validated = $request->validate([
            'id' => 'nullable|exists:employees,id',
            'nama' => 'required|string|max:100',
            'jabatan' => 'required|string|max:100',
            'shift_id' => 'required|exists:shifts,id',
            'pin' => 'nullable|string|max:10',
            'hari_kerja' => 'nullable|array',
            'aktif' => 'nullable|boolean',
        ]);

        if (!empty($validated['id'])) {
            $emp = Employee::findOrFail($validated['id']);
            $emp->update($validated);
        } else {
            $colors = ['#4f46e5', '#0e7490', '#be185d', '#15803d', '#c2410c', '#7c3aed', '#0f766e', '#a21caf', '#2563eb', '#b45309'];
            $validated['warna'] = $colors[rand(0, count($colors) - 1)];
            $validated['mulai_kerja'] = Carbon::today()->toDateString();
            $emp = Employee::create($validated);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Data karyawan berhasil disimpan.',
            'data' => $emp->load('shift'),
        ]);
    }

    public function deleteEmployee($id)
    {
        $emp = Employee::findOrFail($id);
        $emp->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Karyawan berhasil dihapus.',
        ]);
    }

    public function saveShift(Request $request)
    {
        $validated = $request->validate([
            'id' => 'nullable|exists:shifts,id',
            'nama' => 'required|string|max:50',
            'masuk' => 'required|string|max:5',
            'pulang' => 'required|string|max:5',
            'toleransi' => 'required|integer|min:0',
            'ikon' => 'nullable|string|max:20',
        ]);

        if (!empty($validated['id'])) {
            $shift = Shift::findOrFail($validated['id']);
            $shift->update($validated);
        } else {
            $validated['slug'] = Str::slug($validated['nama']) . '-' . rand(10, 99);
            $shift = Shift::create($validated);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Shift berhasil disimpan.',
            'data' => $shift,
        ]);
    }

    public function deleteShift($id)
    {
        $shift = Shift::findOrFail($id);
        if ($shift->employees()->count() > 0) {
            return response()->json([
                'status' => 'error',
                'message' => 'Shift ini tidak bisa dihapus karena masih digunakan oleh karyawan!',
            ], 422);
        }
        $shift->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Shift berhasil dihapus.',
        ]);
    }

    public function exportCsv(Request $request)
    {
        $bulanStr = $request->query('bulan', Carbon::today()->format('Y-m'));
        $start = Carbon::parse($bulanStr . '-01')->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $attendances = Attendance::with('employee.shift')
            ->whereBetween('tgl', [$start->toDateString(), $end->toDateString()])
            ->orderBy('tgl', 'asc')
            ->get();

        $filename = "rekap-absensi-{$bulanStr}.csv";
        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($attendances) {
            $file = fopen('php://output', 'w');
            // Add UTF-8 BOM
            fputs($file, "\xEF\xBB\xBF");
            fputcsv($file, ['Tanggal', 'Karyawan', 'Jabatan', 'Shift', 'Masuk', 'Pulang', 'Telat (mnt)', 'Lembur (mnt)', 'Jarak (m)', 'Sumber']);

            foreach ($attendances as $row) {
                fputcsv($file, [
                    $row->tgl->format('Y-m-d'),
                    $row->employee?->nama ?? '-',
                    $row->employee?->jabatan ?? '-',
                    $row->employee?->shift?->nama ?? '-',
                    $row->masuk ? $row->masuk->format('H:i:s') : '-',
                    $row->pulang ? $row->pulang->format('H:i:s') : '-',
                    $row->telat,
                    $row->lembur,
                    $row->jarak ?? '-',
                    $row->sumber ?? 'web',
                ]);
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    private function hitungJarak($lat1, $lon1, $lat2, $lon2)
    {
        $earthRadius = 6371000;
        $latFrom = deg2rad($lat1);
        $lonFrom = deg2rad($lon1);
        $latTo = deg2rad($lat2);
        $lonTo = deg2rad($lon2);

        $latDelta = $latTo - $latFrom;
        $lonDelta = $lonTo - $lonFrom;

        $angle = 2 * asin(sqrt(pow(sin($latDelta / 2), 2) +
            cos($latFrom) * cos($latTo) * pow(sin($lonDelta / 2), 2)));
        return (int) round($angle * $earthRadius);
    }

    private function simpanFotoBase64($base64Data, $folder = 'selfie')
    {
        try {
            $parts = explode(',', $base64Data);
            $imageContent = base64_decode(end($parts));
            $filename = $folder . '/' . Str::random(24) . '.jpg';
            Storage::disk('public')->put($filename, $imageContent);
            return '/storage/' . $filename;
        } catch (\Exception $e) {
            return null;
        }
    }
}
