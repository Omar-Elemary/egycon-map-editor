<?php

namespace App\Support;

class ShareMap
{
    public static function isValidId(string $id): bool
    {
        return (bool) preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $id);
    }

    public static function idFromProject(string $projectId): string
    {
        $cleaned = substr(preg_replace('/[^a-zA-Z0-9_-]/', '', $projectId) ?? '', 0, 48);

        return $cleaned !== '' ? $cleaned : 'map';
    }

    /**
     * @param  array<string, mixed>  $project
     * @return array<string, mixed>|null
     */
    public static function parse(array $project): ?array
    {
        if (
            ! isset($project['name'], $project['width'], $project['height'], $project['objects'], $project['background'])
            || ! is_string($project['name'])
            || ! is_numeric($project['width'])
            || ! is_numeric($project['height'])
            || ! is_array($project['objects'])
            || ! is_array($project['background'])
        ) {
            return null;
        }

        $seen = [];
        $objects = [];
        foreach ($project['objects'] as $object) {
            if (! is_array($object) || ! ($object['visible'] ?? true)) {
                continue;
            }
            $id = isset($object['id']) && is_string($object['id']) ? $object['id'] : '';
            if ($id === '' || isset($seen[$id])) {
                $object['id'] = 'obj_'.substr(bin2hex(random_bytes(8)), 0, 16);
            }
            $seen[$object['id']] = true;
            $objects[] = $object;
        }

        return [
            ...$project,
            'objects' => $objects,
            'updatedAt' => (int) round(microtime(true) * 1000),
        ];
    }
}
