<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('kode')->nullable();
            $table->string('nama');
            $table->string('jabatan');
            $table->foreignId('shift_id')->nullable()->constrained('shifts')->nullOnDelete();
            $table->string('pin', 10)->default('1234');
            $table->json('hari_kerja')->nullable();
            $table->boolean('aktif')->default(true);
            $table->string('warna', 20)->default('#4f46e5');
            $table->string('foto')->nullable();
            $table->date('mulai_kerja')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};
