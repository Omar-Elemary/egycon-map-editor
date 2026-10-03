<?php

namespace Tests\Feature;

use App\Models\Share;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShareTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string, mixed>
     */
    private function project(string $id = 'proj_abc'): array
    {
        return [
            'id' => $id,
            'name' => 'Main hall',
            'width' => 1920,
            'height' => 1080,
            'background' => ['type' => 'color', 'color' => '#111111'],
            'objects' => [
                [
                    'id' => 'obj_1',
                    'type' => 'rect',
                    'name' => 'Stage',
                    'visible' => true,
                    'x' => 0,
                    'y' => 0,
                    'width' => 100,
                    'height' => 40,
                ],
                [
                    'id' => 'obj_2',
                    'type' => 'rect',
                    'name' => 'Hidden',
                    'visible' => false,
                    'x' => 0,
                    'y' => 0,
                    'width' => 10,
                    'height' => 10,
                ],
            ],
            'updatedAt' => 1,
        ];
    }

    public function test_it_publishes_and_reads_a_map(): void
    {
        $response = $this->postJson('/api/share', $this->project())
            ->assertOk()
            ->assertJsonPath('id', 'proj_abc')
            ->assertJsonPath('name', 'Main hall')
            ->assertJsonPath('path', '/m/proj_abc');

        $id = $response->json('id');

        $this->getJson('/api/share/'.$id)
            ->assertOk()
            ->assertJsonPath('name', 'Main hall')
            ->assertJsonPath('objects.0.name', 'Stage');

        $this->assertCount(1, $this->getJson('/api/share/'.$id)->json('objects'));

        $this->assertSame(1, Share::query()->count());
    }

    public function test_it_rejects_invalid_projects(): void
    {
        $this->postJson('/api/share', ['name' => 'Nope'])->assertStatus(400);
    }

    public function test_it_returns_not_found_for_unknown_maps(): void
    {
        $this->getJson('/api/share/missing-map')->assertNotFound();
    }

    public function test_it_unpublishes_and_can_expire(): void
    {
        $created = $this->postJson('/api/share', $this->project())->assertOk();
        $id = $created->json('id');
        $token = $created->json('manageToken');

        $this->withHeaders(['X-Share-Token' => $token])
            ->deleteJson('/api/share/'.$id)
            ->assertOk()
            ->assertJsonPath('live', false)
            ->assertJsonPath('published', false);

        $this->getJson('/api/share/'.$id)->assertNotFound();

        $this->withHeaders(['X-Share-Token' => $token])
            ->postJson('/api/share', $this->project())
            ->assertOk()
            ->assertJsonPath('live', true);

        $this->withHeaders(['X-Share-Token' => $token])
            ->patchJson('/api/share/'.$id, [
                'expiresAt' => now()->subMinute()->toIso8601String(),
            ])
            ->assertOk()
            ->assertJsonPath('live', false);

        $this->getJson('/api/share/'.$id)->assertNotFound();
    }

    public function test_it_rejects_updates_without_the_manage_token(): void
    {
        $this->postJson('/api/share', $this->project())->assertOk();
        $this->postJson('/api/share', $this->project())->assertStatus(403);
    }

    public function test_it_renders_the_explore_page_for_a_live_map(): void
    {
        $this->postJson('/api/share', $this->project())->assertOk();

        $this->get('/m/proj_abc')
            ->assertOk()
            ->assertSee('Main hall', false)
            ->assertSee('map-data', false);
    }

    public function test_it_renders_not_found_for_an_unknown_explore_link(): void
    {
        $this->get('/m/missing-map')
            ->assertNotFound()
            ->assertSee('This share link is not available', false);
    }
}
