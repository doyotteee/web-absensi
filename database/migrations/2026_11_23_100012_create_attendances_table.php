<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->date('tgl');
            $table->dateTime('masuk')->nullable();
            $table->dateTime('pulang')->nullable();
            $table->integer('telat')->default(0);
            $table->integer('lembur')->default(0);
            $table->string('jadwal_masuk')->nullable();
            $table->string('jadwal_pulang')->nullable();
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->integer('jarak')->nullable();
            $table->string('foto_masuk')->nullable();
            $table->string('foto_pulang')->nullable();
            $table->string('sumber')->default('web');
            $table->timestamps();

            $table->unique(['employee_id', 'tgl']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendances');
    }
};
