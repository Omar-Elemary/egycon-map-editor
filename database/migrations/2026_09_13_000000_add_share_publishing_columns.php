<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shares', function (Blueprint $table) {
            $table->boolean('published')->default(true);
            $table->timestamp('expires_at')->nullable();
            $table->string('manage_token', 64)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('shares', function (Blueprint $table) {
            $table->dropColumn(['published', 'expires_at', 'manage_token']);
        });
    }
};
