use bevy::prelude::*;
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
}
