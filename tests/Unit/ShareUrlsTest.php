<?php

namespace Tests\Unit;

use App\Support\ShareUrls;
use Tests\TestCase;

class ShareUrlsTest extends TestCase
{
    public function test_it_ranks_wifi_addresses_ahead_of_link_local_and_virtual_adapters(): void
    {
        $ranked = ShareUrls::rankLanHosts([
            '169.254.126.67',
            '172.17.0.1',
            '192.168.1.7',
            '127.0.0.1',
            '10.0.0.4',
        ]);

        $this->assertSame(['192.168.1.7', '10.0.0.4', '172.17.0.1'], $ranked);
    }

    public function test_it_uses_the_browser_origin_when_that_is_already_a_lan_address(): void
    {
        $this->assertSame(
            'http://192.168.1.7:3000/m/hall',
            ShareUrls::pickPhoneUrl(
                'http://192.168.1.7:3000',
                'http://192.168.1.7:3000/m/hall',
                ['http://10.0.0.4:3000/m/hall']
            )
        );
    }

    public function test_it_falls_back_to_the_best_lan_url_from_localhost(): void
    {
        $this->assertSame(
            'http://192.168.1.7:3000/m/hall',
            ShareUrls::pickPhoneUrl(
                'http://localhost:3000',
                'http://localhost:3000/m/hall',
                ['http://192.168.1.7:3000/m/hall']
            )
        );
    }
}
