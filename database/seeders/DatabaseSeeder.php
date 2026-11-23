<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Setting;
use App\Models\Shift;
use App\Models\Employee;
use App\Models\Attendance;
use App\Models\Leave;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Admin User
        User::updateOrCreate(
            ['email' => 'admin@absensi.local'],
            [
                'name' => 'Administrator NRS',
                'password' => Hash::make('admin123'),
                'email_verified_at' => now(),
            ]
        );

        // 2. Settings NRS Ready Mix
        Setting::updateOrCreate(
            ['id' => 1],
            [
                'nama_kantor' => 'NRS Ready Mix',
                'pakai_lokasi' => true,
                'wajib_radius' => false,
                'lat' => -6.9175000,
                'lng' => 107.6191000,
                'radius' => 150,
                'pakai_selfie' => true,
                'wajib_selfie' => false,
                'pin_admin' => '1234',
                'uang_makan' => 30000,
                'uang_lembur' => 25000,
                'pot_telat' => 15000,
                'pot_alpa' => 100000,
                'min_lembur' => 30,
            ]
        );

        // 3. Shifts Operasional Ready Mix (Pagi 07-15, Sore 15-23, Malam 23-07)
        $shiftPagi = Shift::updateOrCreate(
            ['slug' => 'pagi'],
            ['nama' => 'Pagi', 'masuk' => '07:00', 'pulang' => '15:00', 'toleransi' => 10, 'ikon' => 'pagi']
        );
        $shiftSore = Shift::updateOrCreate(
            ['slug' => 'siang'],
            ['nama' => 'Sore', 'masuk' => '15:00', 'pulang' => '23:00', 'toleransi' => 10, 'ikon' => 'siang']
        );
        $shiftMalam = Shift::updateOrCreate(
            ['slug' => 'malam'],
            ['nama' => 'Malam', 'masuk' => '23:00', 'pulang' => '07:00', 'toleransi' => 15, 'ikon' => 'malam']
        );

        // 4. Data Karyawan Operasional NRS Ready Mix
        $nrsEmployees = [
            ['Hendra Gunawan', 'Kepala Plant', $shiftPagi->id, '1111', '#0A6A1E'],
            ['Budi Santoso', 'Operator Batching Plant', $shiftPagi->id, '2222', '#F26500'],
            ['Joko Wahyudi', 'Driver Truck Mixer', $shiftPagi->id, '3333', '#00A8F3'],
            ['Dedi Kurniawan', 'Driver Truck Mixer', $shiftSore->id, '4444', '#0e7490'],
            ['Rian Pratama', 'Quality Control (QC)', $shiftPagi->id, '5555', '#15803d'],
            ['Agus Hermawan', 'Mekanik Alat Berat', $shiftPagi->id, '6666', '#c2410c'],
            ['Wahyu Hidayat', 'Satpam & Timbangan', $shiftMalam->id, '7777', '#0f766e'],
            ['Siti Nurhaliza', 'Admin Logistik & Dispatcher', $shiftPagi->id, '8888', '#2563eb'],
            ['Dewi Anggraini', 'Keuangan & Kasir Plant', $shiftPagi->id, '9999', '#7c3aed'],
        ];

        // Kosongkan dan ganti data karyawan contoh agar sesuai NRS Ready Mix
        Employee::query()->delete();

        $createdEmployees = [];
        foreach ($nrsEmployees as $index => $item) {
            $emp = Employee::create([
                'kode' => 'NRS-' . str_pad($index + 1, 3, '0', STR_PAD_LEFT),
                'nama' => $item[0],
                'jabatan' => $item[1],
                'shift_id' => $item[2],
                'pin' => $item[3],
                'hari_kerja' => [1, 2, 3, 4, 5, 6],
                'aktif' => true,
                'warna' => $item[4],
                'mulai_kerja' => Carbon::now()->subMonths(6)->toDateString(),
            ]);
            $createdEmployees[] = $emp;
        }

        // 5. Riwayat Kehadiran Contoh 7 Hari Terakhir
        $today = Carbon::today();
        foreach ($createdEmployees as $idx => $emp) {
            for ($i = 6; $i >= 0; $i--) {
                $date = $today->copy()->subDays($i);
                if ($date->isSunday()) continue;

                $shift = $emp->shift ?? $shiftPagi;
                $inTime = Carbon::parse($date->toDateString() . ' ' . $shift->masuk)->addMinutes(rand(-10, 15));
                $outTime = Carbon::parse($date->toDateString() . ' ' . $shift->pulang)->addMinutes(rand(0, 45));
                $shiftIn = Carbon::parse($date->toDateString() . ' ' . $shift->masuk);
                $late = $inTime->gt($shiftIn->copy()->addMinutes($shift->toleransi)) ? (int) round($shiftIn->diffInMinutes($inTime, true)) : 0;
                $shiftOut = Carbon::parse($date->toDateString() . ' ' . $shift->pulang);
                $overtime = $outTime->diffInMinutes($shiftOut, true) >= 30 ? (int) round($shiftOut->diffInMinutes($outTime, true)) : 0;

                $isToday = $date->isToday();
                $actualOut = $isToday && $idx % 2 === 0 ? null : $outTime;

                Attendance::updateOrCreate(
                    [
                        'employee_id' => $emp->id,
                        'tgl' => $date->toDateString(),
                    ],
                    [
                        'masuk' => $inTime,
                        'pulang' => $actualOut,
                        'telat' => $late,
                        'lembur' => $actualOut ? $overtime : 0,
                        'jadwal_masuk' => $shift->masuk,
                        'jadwal_pulang' => $shift->pulang,
                        'lat' => -6.9175000 + (rand(-10, 10) / 100000),
                        'lng' => 107.6191000 + (rand(-10, 10) / 100000),
                        'jarak' => rand(15, 60),
                        'sumber' => 'web',
                    ]
                );
            }
        }

        // 6. Contoh Izin Karyawan NRS Ready Mix
        Leave::query()->delete();
        if (!empty($createdEmployees)) {
            Leave::create([
                'employee_id' => $createdEmployees[2]->id, // Joko Wahyudi (Driver)
                'jenis' => 'izin',
                'dari' => $today->copy()->addDays(1)->toDateString(),
                'sampai' => $today->copy()->addDays(2)->toDateString(),
                'alasan' => 'Perpanjangan SIM B2 Umum di Satpas',
                'status' => 'menunggu',
            ]);

            Leave::create([
                'employee_id' => $createdEmployees[4]->id, // Rian Pratama (QC)
                'jenis' => 'sakit',
                'dari' => $today->copy()->subDays(2)->toDateString(),
                'sampai' => $today->copy()->subDays(1)->toDateString(),
                'alasan' => 'Pemeriksaan kesehatan rutin dan istirahat dokter',
                'status' => 'disetujui',
            ]);
        }
    }
}
