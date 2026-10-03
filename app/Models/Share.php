<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class Share extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'payload',
        'published',
        'expires_at',
        'manage_token',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'published' => 'boolean',
            'expires_at' => 'datetime',
        ];
    }

    public function isLive(): bool
    {
        if (! $this->published) {
            return false;
        }

        if ($this->expires_at instanceof Carbon && $this->expires_at->isPast()) {
            return false;
        }

        return true;
    }

    public function tokenMatches(?string $token): bool
    {
        if (! is_string($token) || $token === '' || ! is_string($this->manage_token) || $this->manage_token === '') {
            return false;
        }

        return hash_equals($this->manage_token, hash('sha256', $token));
    }
}
