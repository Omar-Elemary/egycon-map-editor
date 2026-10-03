<?php

namespace App\Support;

use Illuminate\Http\Request;

class ShareUrls
{
    /**
     * @return array{path: string, urls: list<string>, phoneUrl: string}
     */
    public static function for(Request $request, string $id): array
    {
        $path = '/m/'.$id;
        $origin = self::frontendOrigin($request);
        $local = $origin.$path;
        $port = self::portFromOrigin($origin);
        $scheme = parse_url($origin, PHP_URL_SCHEME) ?: 'http';

        $lan = array_map(
            fn (string $base) => $base.$path,
            self::lanOrigins($scheme, $port)
        );

        $urls = array_values(array_unique([$local, ...$lan]));
        $phoneUrl = self::pickPhoneUrl($origin, $local, $lan);

        return [
            'path' => $path,
            'urls' => $urls,
            'phoneUrl' => $phoneUrl,
        ];
    }

    /**
     * @param  list<string>  $lan
     */
    public static function pickPhoneUrl(string $origin, string $local, array $lan): string
    {
        $host = parse_url($origin, PHP_URL_HOST);
        if (is_string($host) && self::isReachableLanHost($host)) {
            return $local;
        }

        return $lan[0] ?? $local;
    }

    /**
     * @param  list<string>  $ips
     * @return list<string>
     */
    public static function rankLanHosts(array $ips): array
    {
        $filtered = [];
        foreach ($ips as $ip) {
            if (! is_string($ip)) {
                continue;
            }
            if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
                continue;
            }
            if (! self::isReachableLanHost($ip)) {
                continue;
            }
            $filtered[] = $ip;
        }

        $filtered = array_values(array_unique($filtered));
        usort($filtered, fn (string $a, string $b) => self::lanScore($b) <=> self::lanScore($a));

        return $filtered;
    }

    public static function frontendOrigin(Request $request): string
    {
        $origin = $request->headers->get('Origin');
        if (is_string($origin) && $origin !== '') {
            return rtrim($origin, '/');
        }

        $referer = $request->headers->get('Referer');
        if (is_string($referer) && $referer !== '') {
            $parts = parse_url($referer);
            if (! empty($parts['scheme']) && ! empty($parts['host'])) {
                $port = isset($parts['port']) ? ':'.$parts['port'] : '';

                return $parts['scheme'].'://'.$parts['host'].$port;
            }
        }

        return rtrim((string) config('app.frontend_url', config('app.url')), '/');
    }

    private static function portFromOrigin(string $origin): string
    {
        $port = parse_url($origin, PHP_URL_PORT);
        if ($port) {
            return (string) $port;
        }

        $scheme = parse_url($origin, PHP_URL_SCHEME);

        return $scheme === 'https' ? '443' : '80';
    }

    /**
     * @return list<string>
     */
    private static function lanOrigins(string $scheme, string $port): array
    {
        $urls = [];
        $suffix = ($port === '80' && $scheme === 'http') || ($port === '443' && $scheme === 'https')
            ? ''
            : ':'.$port;

        $ips = [];
        if (function_exists('net_get_interfaces')) {
            foreach (net_get_interfaces() ?: [] as $interface) {
                foreach ($interface['unicast'] ?? [] as $address) {
                    $ip = $address['address'] ?? null;
                    if (is_string($ip)) {
                        $ips[] = $ip;
                    }
                }
            }
        }

        foreach (self::rankLanHosts($ips) as $ip) {
            $urls[] = $scheme.'://'.$ip.$suffix;
        }

        return array_values(array_unique($urls));
    }

    private static function isReachableLanHost(string $host): bool
    {
        if ($host === 'localhost' || $host === '127.0.0.1') {
            return false;
        }
        if (str_starts_with($host, '169.254.')) {
            return false;
        }

        return (bool) filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4);
    }

    private static function lanScore(string $ip): int
    {
        if (str_starts_with($ip, '192.168.')) {
            return 50;
        }
        if (str_starts_with($ip, '10.')) {
            return 40;
        }

        $octets = explode('.', $ip);
        $second = (int) ($octets[1] ?? 0);
        if (str_starts_with($ip, '172.') && $second >= 16 && $second <= 31) {
            if (in_array($second, [17, 18, 19], true)) {
                return 10;
            }

            return 30;
        }

        return 1;
    }
}
