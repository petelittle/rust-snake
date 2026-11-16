use bevy::prelude::*;

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
pub struct BonusOrb {
    pub ttl: Timer,
}

#[derive(Component)]
pub struct ObstacleBlock;

#[derive(Component)]
pub struct ArenaEntity;

#[derive(Component)]
pub struct Particle {
    pub velocity: Vec2,
    pub life: Timer,
    pub start_scale: f32,
}

#[derive(Component)]
pub struct ShockwaveRing {
    pub life: Timer,
    pub max_radius: f32,
}

#[derive(Component)]
pub struct ScoreHudText;

#[derive(Component)]
pub struct OverlayUiRoot;
