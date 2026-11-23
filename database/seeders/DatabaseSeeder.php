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
        User::firstOrCreate(
            ['email' => 'admin@absensi.local'],
            [
                'name' => 'Administrator',
                'password' => Hash::make('admin123'),
                'email_verified_at' => now(),
            ]
        );

        // 2. Settings
        Setting::firstOrCreate(
            ['id' => 1],
            [
                'nama_kantor' => 'CV Maju Bersama',
                'pakai_lokasi' => true,
                'wajib_radius' => false,
                'lat' => -6.9175000,
                'lng' => 107.6191000,
                'radius' => 150,
                'pakai_selfie' => true,
                'wajib_selfie' => false,
                'pin_admin' => '1234',
                'uang_makan' => 25000,
                'uang_lembur' => 20000,
                'pot_telat' => 10000,
                'pot_alpa' => 75000,
                'min_lembur' => 30,
            ]
        );

        // 3. Shifts
        $shiftPagi = Shift::firstOrCreate(
            ['slug' => 'pagi'],
            ['nama' => 'Pagi', 'masuk' => '08:00', 'pulang' => '16:00', 'toleransi' => 10, 'ikon' => 'pagi']
        );
        $shiftSiang = Shift::firstOrCreate(
            ['slug' => 'siang'],
            ['nama' => 'Siang', 'masuk' => '13:00', 'pulang' => '21:00', 'toleransi' => 10, 'ikon' => 'siang']
        );
        $shiftMalam = Shift::firstOrCreate(
            ['slug' => 'malam'],
            ['nama' => 'Malam', 'masuk' => '21:00', 'pulang' => '05:00', 'toleransi' => 15, 'ikon' => 'malam']
        );

        // 4. Employees
        $sampleEmployees = [
            ['Rina Wulandari', 'Kasir', $shiftPagi->id, '1111', '#4f46e5'],
            ['Dimas Pratama', 'Barista', $shiftPagi->id, '2222', '#0e7490'],
            ['Siti Nurhaliza', 'Admin Gudang', $shiftPagi->id, '3333', '#be185d'],
            ['Agus Setiawan', 'Kurir', $shiftPagi->id, '4444', '#15803d'],
            ['Putri Maharani', 'Kasir', $shiftSiang->id, '5555', '#c2410c'],
            ['Fajar Nugroho', 'Barista', $shiftSiang->id, '6666', '#7c3aed'],
            ['Wahyu Hidayat', 'Satpam', $shiftMalam->id, '7777', '#0f766e'],
            ['Laras Ayuningtyas', 'Keuangan', $shiftPagi->id, '8888', '#a21caf'],
            ['Bayu Saputra', 'Staf Toko', $shiftSiang->id, '9999', '#2563eb'],
        ];

        $createdEmployees = [];
        foreach ($sampleEmployees as $index => $item) {
            $emp = Employee::firstOrCreate(
                ['nama' => $item[0]],
                [
                    'kode' => 'K' . str_pad($index + 1, 3, '0', STR_PAD_LEFT),
                    'jabatan' => $item[1],
                    'shift_id' => $item[2],
                    'pin' => $item[3],
                    'hari_kerja' => [1, 2, 3, 4, 5, 6],
                    'aktif' => true,
                    'warna' => $item[4],
                    'mulai_kerja' => Carbon::now()->subMonths(3)->toDateString(),
                ]
            );
            $createdEmployees[] = $emp;
        }

        // 5. Sample Attendance for past 7 days
        $today = Carbon::today();
        foreach ($createdEmployees as $idx => $emp) {
            for ($i = 6; $i >= 0; $i--) {
                $date = $today->copy()->subDays($i);
                // Skip Sunday
                if ($date->isSunday()) continue;

                $shift = $emp->shift ?? $shiftPagi;
                $inTime = Carbon::parse($date->toDateString() . ' ' . $shift->masuk)->addMinutes(rand(-15, 20));
                $outTime = Carbon::parse($date->toDateString() . ' ' . $shift->pulang)->addMinutes(rand(0, 45));
                $shiftIn = Carbon::parse($date->toDateString() . ' ' . $shift->masuk);
                $late = $inTime->gt($shiftIn->copy()->addMinutes($shift->toleransi)) ? $inTime->diffInMinutes($shiftIn) : 0;
                $shiftOut = Carbon::parse($date->toDateString() . ' ' . $shift->pulang);
                $overtime = $outTime->diffInMinutes($shiftOut) >= 30 ? $outTime->diffInMinutes($shiftOut) : 0;

                // For today, some employees haven't clocked out yet
                $isToday = $date->isToday();
                $actualOut = $isToday && $idx % 2 === 0 ? null : $outTime;

                Attendance::firstOrCreate(
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
                        'jarak' => rand(15, 65),
                        'sumber' => 'web',
                    ]
                );
            }
        }

        // 6. Sample Leaves
        if (!empty($createdEmployees)) {
            Leave::firstOrCreate(
                [
                    'employee_id' => $createdEmployees[1]->id,
                    'dari' => $today->copy()->addDays(2)->toDateString(),
                    'sampai' => $today->copy()->addDays(3)->toDateString(),
                ],
                [
                    'jenis' => 'izin',
                    'alasan' => 'Urusan keluarga mendadak ke luar kota',
                    'status' => 'menunggu',
                ]
            );

            Leave::firstOrCreate(
                [
                    'employee_id' => $createdEmployees[2]->id,
                    'dari' => $today->copy()->subDays(2)->toDateString(),
                    'sampai' => $today->copy()->subDays(2)->toDateString(),
                ],
                [
                    'jenis' => 'sakit',
                    'alasan' => 'Demam dan flu, surat dokter terlampir',
                    'status' => 'disetujui',
                ]
            );
        }
    }
}
