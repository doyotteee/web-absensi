<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('nama_kantor')->default('CV Maju Bersama');
            $table->boolean('pakai_lokasi')->default(true);
            $table->boolean('wajib_radius')->default(false);
            $table->decimal('lat', 10, 7)->nullable()->default(-6.9175000);
            $table->decimal('lng', 10, 7)->nullable()->default(107.6191000);
            $table->integer('radius')->default(150);
            $table->boolean('pakai_selfie')->default(true);
            $table->boolean('wajib_selfie')->default(false);
            $table->string('pin_admin')->nullable()->default('1234');
            $table->integer('uang_makan')->default(25000);
            $table->integer('uang_lembur')->default(20000);
            $table->integer('pot_telat')->default(10000);
            $table->integer('pot_alpa')->default(75000);
            $table->integer('min_lembur')->default(30);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
