mod components;
mod resources;
mod systems;

use bevy::prelude::*;
use components::AppState;
use resources::*;
use systems::*;

fn main() {
    App::new()
        .insert_resource(ClearColor(Color::srgb(0.043, 0.055, 0.078)))
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Vipera Bevy — Rust & Bevy Snake".into(),
                resolution: (1120.0, 760.0).into(),
                present_mode: bevy::window::PresentMode::AutoVsync,
                ..default()
            }),
            ..default()
        }))
        .init_state::<AppState>()
        .init_resource::<GameConfig>()
        .init_resource::<GameStats>()
        .init_resource::<StepClock>()
        .init_resource::<ComboClock>()
        .init_resource::<InputQueue>()
        .init_resource::<SnakeSegments>()
        .init_resource::<LastTailPosition>()
        .init_resource::<ScreenShake>()
        .add_systems(Startup, (setup_camera, spawn_arena_backdrop, start_new_run))
        .add_systems(OnEnter(AppState::Playing), start_new_run)
        .add_systems(
            Update,
            (
                handle_player_input,
                advance_snake_simulation,
                interpolate_snake_transforms,
                update_particles_and_shake,
            )
                .chain()
                .run_if(in_state(AppState::Playing)),
        )
        .run();
}
