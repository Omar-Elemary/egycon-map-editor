<?php

namespace App\Http\Controllers;

use App\Models\Share;
use App\Support\ShareMap;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Response;

class ExploreController extends Controller
{
    public function show(string $id): View|Response
    {
        if (! ShareMap::isValidId($id)) {
            return response()->view('explore-missing', status: 404);
        }

        $share = Share::query()->find($id);
        if (! $share || ! $share->isLive() || ! is_array($share->payload)) {
            return response()->view('explore-missing', status: 404);
        }

        return view('explore', [
            'name' => $share->name,
            'map' => $share->payload,
        ]);
    }
}
