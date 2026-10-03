<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
        <meta name="theme-color" content="#18181b">
        <meta name="format-detection" content="telephone=no">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <title>{{ $name }} · map</title>
        @vite(['resources/css/app.css', 'resources/js/explore.tsx'])
    </head>
    <body class="h-full overflow-hidden bg-zinc-900 text-white antialiased">
        <script id="map-data" type="application/json">{!! json_encode($map, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_UNESCAPED_SLASHES) !!}</script>
        <div id="root" class="h-full"></div>
    </body>
</html>
