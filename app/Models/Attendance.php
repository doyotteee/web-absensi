<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    protected $guarded = ['id'];

    protected $casts = [
        'tgl' => 'date:Y-m-d',
        'masuk' => 'datetime',
        'pulang' => 'datetime',
        'telat' => 'integer',
        'lembur' => 'integer',
        'lat' => 'float',
        'lng' => 'float',
    ];

    public function setTglAttribute($value): void
    {
        if ($value instanceof Carbon) {
            $this->attributes['tgl'] = $value->toDateString();
        } else {
            $this->attributes['tgl'] = substr((string)$value, 0, 10);
        }
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
