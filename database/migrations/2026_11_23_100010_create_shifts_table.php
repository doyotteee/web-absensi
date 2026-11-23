<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shifts', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('nama');
            $table->string('masuk');
            $table->string('pulang');
            $table->integer('toleransi')->default(10);
            $table->string('ikon')->default('pagi');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shifts');
    }
};
