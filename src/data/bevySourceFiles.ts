export interface BevySourceFile {
  path: string;
  language: 'rust' | 'toml' | 'markdown';
  content: string;
}

export const BEVY_SOURCE_FILES: BevySourceFile[] = [
  {
    path: 'rust-bevy-snake/Cargo.toml',
    language: 'toml',
    content: `[package]
name = "vipera_bevy"
version = "0.1.0"
edition = "2021"
description = "High-performance Snake game built on Rust and the Bevy ECS engine"

[dependencies]
bevy = "0.15"
rand = "0.8"

[profile.dev]
opt-level = 1

[profile.dev.package."*"]
opt-level = 3

[profile.release]
lto = "thin"
codegen-units = 1
opt-level = 3
strip = "symbols"`,
  },
  {
    path: 'rust-bevy-snake/src/main.rs',
    language: 'rust',
    content: `mod components;
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
}`,
  },
  {
    path: 'rust-bevy-snake/src/components.rs',
    language: 'rust',
    content: `use bevy::prelude::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, States, Default)]
pub enum AppState {
    #[default]
    Title,
    Playing,
    Paused,
    GameOver,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum GameMode {
    #[default]
    Classic,
    Wrap,
    Blitz,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
}

impl Direction {
    pub fn opposite(self) -> Self {
        match self {
            Direction::Up => Direction::Down,
            Direction::Down => Direction::Up,
            Direction::Left => Direction::Right,
            Direction::Right => Direction::Left,
        }
    }

    pub fn delta(self) -> IVec2 {
        match self {
            Direction::Up => IVec2::new(0, 1),
            Direction::Down => IVec2::new(0, -1),
            Direction::Left => IVec2::new(-1, 0),
            Direction::Right => IVec2::new(1, 0),
        }
    }

    pub fn angle_radians(self) -> f32 {
        match self {
            Direction::Right => 0.0,
            Direction::Up => std::f32::consts::FRAC_PI_2,
            Direction::Left => std::f32::consts::PI,
            Direction::Down => -std::f32::consts::FRAC_PI_2,
        }
    }
}

#[derive(Component, Debug, Clone, Copy, PartialEq, Eq)]
pub struct GridPosition {
    pub current: IVec2,
    pub previous: IVec2,
}

impl GridPosition {
    pub fn new(x: i32, y: i32) -> Self {
        let p = IVec2::new(x, y);
        Self { current: p, previous: p }
    }
}

#[derive(Component)]
pub struct SnakeHead {
    pub direction: Direction,
}

#[derive(Component)]
pub struct SnakeSegment {
    pub index: usize,
}

#[derive(Component)]
pub struct FoodOrb;

#[derive(Component)]
pub struct ObstacleBlock;

#[derive(Component)]
pub struct ArenaEntity;

#[derive(Component)]
pub struct Particle {
    pub velocity: Vec2,
    pub life: Timer,
    pub start_scale: f32,
}`,
  },
  {
    path: 'rust-bevy-snake/src/resources.rs',
    language: 'rust',
    content: `use bevy::prelude::*;
use std::collections::VecDeque;

use crate::components::{Direction, GameMode};

pub const GRID_WIDTH: i32 = 24;
pub const GRID_HEIGHT: i32 = 18;
pub const CELL_SIZE: f32 = 34.0;

#[derive(Resource)]
pub struct GameConfig {
    pub mode: GameMode,
    pub base_step_secs: f32,
    pub min_step_secs: f32,
}

impl Default for GameConfig {
    fn default() -> Self {
        Self {
            mode: GameMode::Classic,
            base_step_secs: 0.135,
            min_step_secs: 0.055,
        }
    }
}

#[derive(Resource, Default)]
pub struct GameStats {
    pub score: u32,
    pub best_score: u32,
    pub apples_eaten: u32,
    pub combo: u32,
    pub peak_combo: u32,
    pub length: usize,
}

#[derive(Resource)]
pub struct StepClock {
    pub timer: Timer,
    pub boost_active: bool,
}

impl Default for StepClock {
    fn default() -> Self {
        Self {
            timer: Timer::from_seconds(0.135, TimerMode::Repeating),
            boost_active: false,
        }
    }
}

#[derive(Resource)]
pub struct ComboClock {
    pub timer: Timer,
}

impl Default for ComboClock {
    fn default() -> Self {
        let mut timer = Timer::from_seconds(4.2, TimerMode::Once);
        timer.set_elapsed(timer.duration());
        Self { timer }
    }
}

#[derive(Resource, Default)]
pub struct InputQueue {
    pub turns: VecDeque<Direction>,
}

impl InputQueue {
    pub fn push_turn(&mut self, dir: Direction, current_dir: Direction) {
        let reference = self.turns.back().copied().unwrap_or(current_dir);
        if dir != reference && dir != reference.opposite() && self.turns.len() < 2 {
            self.turns.push_back(dir);
        }
    }
}

#[derive(Resource, Default)]
pub struct SnakeSegments(pub Vec<Entity>);

#[derive(Resource, Default)]
pub struct LastTailPosition(pub Option<IVec2>);

#[derive(Resource, Default)]
pub struct ScreenShake {
    pub trauma: f32,
}

pub fn grid_to_world(pos: IVec2, z: f32) -> Vec3 {
    let origin_x = -(GRID_WIDTH as f32 * CELL_SIZE) * 0.5 + CELL_SIZE * 0.5;
    let origin_y = -(GRID_HEIGHT as f32 * CELL_SIZE) * 0.5 + CELL_SIZE * 0.5;
    Vec3::new(
        origin_x + pos.x as f32 * CELL_SIZE,
        origin_y + pos.y as f32 * CELL_SIZE,
        z,
    )
}`,
  },
  {
    path: 'rust-bevy-snake/src/systems.rs',
    language: 'rust',
    content: `use bevy::core_pipeline::bloom::Bloom;
use bevy::prelude::*;
use rand::Rng;

use crate::components::*;
use crate::resources::*;

pub fn setup_camera(mut commands: Commands) {
    commands.spawn((
        Camera2d,
        Camera { hdr: true, ..default() },
        Bloom {
            intensity: 0.22,
            low_frequency_boost: 0.55,
            high_pass_frequency: 0.85,
            ..default()
        },
    ));
}

pub fn interpolate_snake_transforms(
    step_clock: Res<StepClock>,
    mut query: Query<(&GridPosition, &mut Transform, Option<&SnakeHead>)>,
) {
    let alpha = step_clock.timer.fraction().clamp(0.0, 1.0);
    for (grid_pos, mut transform, maybe_head) in &mut query {
        let delta = (grid_pos.current - grid_pos.previous).abs();
        let z = if maybe_head.is_some() { 2.0 } else { 1.0 };
        if delta.x > 1 || delta.y > 1 {
            transform.translation = grid_to_world(grid_pos.current, z);
        } else {
            let from = grid_to_world(grid_pos.previous, z);
            let to = grid_to_world(grid_pos.current, z);
            transform.translation = from.lerp(to, alpha);
        }
        if let Some(head) = maybe_head {
            transform.rotation = Quat::from_rotation_z(head.direction.angle_radians());
        }
    }
}`,
  },
  {
    path: 'rust-bevy-snake/README.md',
    language: 'markdown',
    content: `# Vipera Bevy (Rust + Bevy 0.15)

Run natively with full GPU HDR Bloom & VSync:
  cd rust-bevy-snake
  cargo run --release

Or compile to WebAssembly via Trunk:
  rustup target add wasm32-unknown-unknown
  cargo install trunk
  trunk serve --release`,
  },
];
