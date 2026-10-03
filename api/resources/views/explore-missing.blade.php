<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <title>Map not found</title>
        @vite(['resources/css/app.css'])
    </head>
    <body class="grid h-dvh place-items-center bg-zinc-950 px-6 text-center text-white">
        <div>
            <p class="text-sm font-semibold tracking-widest text-lime-400 uppercase">Map</p>
            <h1 class="mt-2 text-2xl font-semibold">This share link is not available</h1>
            <p class="mt-2 text-sm text-zinc-400">
                The map may have been unpublished, or this phone cannot reach the editor computer.
            </p>
            <a href="{{ url('/') }}" class="mt-6 inline-block rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900">
                Open editor
            </a>
        </div>
    </body>
</html>
