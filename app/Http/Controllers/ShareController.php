<?php

namespace App\Http\Controllers;

use App\Models\Share;
use App\Support\ShareMap;
use App\Support\ShareUrls;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Throwable;

class ShareController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        try {
            $body = $request->json()->all();
            $map = is_array($body) ? ShareMap::parse($body) : null;
            if ($map === null) {
                return response()->json(['error' => 'Invalid map project.'], 400);
            }

            $id = ShareMap::idFromProject((string) ($map['id'] ?? 'map'));
            if (! ShareMap::isValidId($id)) {
                return response()->json(['error' => 'Could not create a share link.'], 400);
            }

            $existing = Share::query()->find($id);
            $token = $this->requestToken($request);
            if ($existing && $existing->manage_token && ! $existing->tokenMatches($token) && ! app()->isLocal()) {
                return response()->json(['error' => 'This map is already published. Open Share from the same browser to update it.'], 403);
            }

            $plainToken = $existing && $existing->tokenMatches($token) ? $token : Str::random(40);
            $expires = $this->parseExpires($request);

            $share = Share::query()->updateOrCreate(
                ['id' => $id],
                [
                    'name' => $map['name'],
                    'payload' => $map,
                    'published' => true,
                    'expires_at' => $expires,
                    'manage_token' => hash('sha256', $plainToken),
                ]
            );

            return response()->json($this->sharePayload($request, $share, $plainToken));
        } catch (Throwable $exception) {
            report($exception);

            return response()->json(['error' => 'Could not publish map.'], 500);
        }
    }

    public function show(string $id): JsonResponse
    {
        $share = $this->findShare($id);
        if (! $share || ! $share->isLive()) {
            return response()->json(['error' => 'Map not found.'], 404);
        }

        return response()->json($share->payload);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $share = $this->authorizedShare($request, $id);
        if ($share instanceof JsonResponse) {
            return $share;
        }

        if ($request->exists('published')) {
            $share->published = (bool) $request->boolean('published');
        }

        if ($request->exists('expiresAt') || $request->headers->has('X-Share-Expires')) {
            $share->expires_at = $this->parseExpires($request);
        }

        $share->save();

        return response()->json($this->sharePayload($request, $share, $this->requestToken($request)));
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $share = $this->authorizedShare($request, $id);
        if ($share instanceof JsonResponse) {
            return $share;
        }

        $share->published = false;
        $share->save();

        return response()->json($this->sharePayload($request, $share, $this->requestToken($request)));
    }

    private function authorizedShare(Request $request, string $id): Share|JsonResponse
    {
        $share = $this->findShare($id);
        if (! $share) {
            return response()->json(['error' => 'Map not found.'], 404);
        }
        if (! $share->tokenMatches($this->requestToken($request))) {
            return response()->json(['error' => 'Could not manage this share link.'], 403);
        }

        return $share;
    }

    private function findShare(string $id): ?Share
    {
        if (! ShareMap::isValidId($id)) {
            return null;
        }

        return Share::query()->find($id);
    }

    private function requestToken(Request $request): ?string
    {
        $header = $request->headers->get('X-Share-Token');
        if (is_string($header) && $header !== '') {
            return $header;
        }
        $body = $request->input('manageToken');

        return is_string($body) && $body !== '' ? $body : null;
    }

    private function parseExpires(Request $request): ?Carbon
    {
        $value = $request->headers->get('X-Share-Expires') ?? $request->input('expiresAt');
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function sharePayload(Request $request, Share $share, ?string $plainToken): array
    {
        return [
            'id' => $share->id,
            'name' => $share->name,
            'published' => $share->published,
            'live' => $share->isLive(),
            'expiresAt' => $share->expires_at?->toIso8601String(),
            'manageToken' => $plainToken,
            ...ShareUrls::for($request, $share->id),
        ];
    }
}
