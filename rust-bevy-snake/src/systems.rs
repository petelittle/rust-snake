use bevy::core_pipeline::bloom::Bloom;
use bevy::prelude::*;
use rand::Rng;

use crate::components::*;
use crate::resources::*;

pub fn setup_camera(mut commands: Commands) {
    commands.spawn((
        Camera2d,
        Camera {
            hdr: true,
            ..default()
        },
        Bloom {
            intensity: 0.22,
            low_frequency_boost: 0.55,
            high_pass_frequency: 0.85,
            ..default()
        },
    ));
}

pub fn spawn_arena_backdrop(mut commands: Commands) {
    let total_w = GRID_WIDTH as f32 * CELL_SIZE;
    let total_h = GRID_HEIGHT as f32 * CELL_SIZE;

    // Outer forged-copper frame
    commands.spawn((
        Sprite {
            color: Color::srgb(0.92, 0.35, 0.05),
            custom_size: Some(Vec2::new(total_w + 8.0, total_h + 8.0)),
            ..default()
        },
        Transform::from_xyz(0.0, 0.0, -2.0),
    ));

    // Inner obsidian floor
    commands.spawn((
        Sprite {
            color: Color::srgb(0.055, 0.068, 0.092),
            custom_size: Some(Vec2::new(total_w, total_h)),
            ..default()
        },
        Transform::from_xyz(0.0, 0.0, -1.5),
    ));

    // Subtle checkerboard cell tiling
    for y in 0..GRID_HEIGHT {
        for x in 0..GRID_WIDTH {
            if (x + y) % 2 == 0 {
                commands.spawn((
                    Sprite {
                        color: Color::srgba(1.0, 1.0, 1.0, 0.025),
                        custom_size: Some(Vec2::splat(CELL_SIZE - 2.0)),
                        ..default()
                    },
                    Transform::from_translation(grid_to_world(IVec2::new(x, y), -1.0)),
                ));
            }
        }
    }
}

pub fn start_new_run(
    mut commands: Commands,
    existing: Query<Entity, With<ArenaEntity>>,
    config: Res<GameConfig>,
    mut stats: ResMut<GameStats>,
    mut segments: ResMut<SnakeSegments>,
    mut input_queue: ResMut<InputQueue>,
    mut step_clock: ResMut<StepClock>,
    mut combo_clock: ResMut<ComboClock>,
) {
    for entity in &existing {
        commands.entity(entity).despawn_recursive();
    }

    segments.0.clear();
    input_queue.turns.clear();
    stats.score = 0;
    stats.apples_eaten = 0;
    stats.combo = 1;
    stats.peak_combo = 1;
    stats.length = 4;

    let step_secs = match config.mode {
        GameMode::Blitz => config.base_step_secs * 0.78,
        _ => config.base_step_secs,
    };
    step_clock
        .timer
        .set_duration(std::time::Duration::from_secs_f32(step_secs));
    step_clock.timer.reset();
    step_clock.boost_active = false;
    combo_clock.timer.reset();

    let start_y = GRID_HEIGHT / 2;
    let start_x = 6;

    // Spawn head + 3 body segments moving Right with ample runway ahead
    let head_pos = IVec2::new(start_x, start_y);
    let head = commands
        .spawn((
            ArenaEntity,
            SnakeHead {
                direction: Direction::Right,
            },
            GridPosition::new(head_pos.x, head_pos.y),
            Sprite {
                color: Color::srgb(0.20, 0.85, 0.58),
                custom_size: Some(Vec2::splat(CELL_SIZE * 0.86)),
                ..default()
            },
            Transform::from_translation(grid_to_world(head_pos, 2.0)),
        ))
        .id();
    segments.0.push(head);

    for i in 1..4 {
        let seg_pos = IVec2::new(start_x - i as i32, start_y);
        let seg = commands
            .spawn((
                ArenaEntity,
                SnakeSegment { index: i },
                GridPosition::new(seg_pos.x, seg_pos.y),
                Sprite {
                    color: Color::srgb(0.08, 0.62, 0.45),
                    custom_size: Some(Vec2::splat(CELL_SIZE * 0.78)),
                    ..default()
                },
                Transform::from_translation(grid_to_world(seg_pos, 1.0)),
            ))
            .id();
        segments.0.push(seg);
    }

    if config.mode == GameMode::Blitz {
        let obstacle_coords = [
            IVec2::new(5, 4),
            IVec2::new(18, 4),
            IVec2::new(5, 13),
            IVec2::new(18, 13),
            IVec2::new(12, 3),
            IVec2::new(12, 14),
        ];
        for pos in obstacle_coords {
            commands.spawn((
                ArenaEntity,
                ObstacleBlock,
                GridPosition::new(pos.x, pos.y),
                Sprite {
                    color: Color::srgb(0.92, 0.35, 0.05),
                    custom_size: Some(Vec2::splat(CELL_SIZE * 0.84)),
                    ..default()
                },
                Transform::from_translation(grid_to_world(pos, 0.5)),
            ));
        }
    }

    spawn_food_orb(&mut commands, &[head_pos], &[]);
}

fn spawn_food_orb(commands: &mut Commands, occupied: &[IVec2], obstacles: &[IVec2]) {
    let mut rng = rand::thread_rng();
    for _ in 0..256 {
        let candidate = IVec2::new(rng.gen_range(0..GRID_WIDTH), rng.gen_range(0..GRID_HEIGHT));
        if !occupied.contains(&candidate) && !obstacles.contains(&candidate) {
            commands.spawn((
                ArenaEntity,
                FoodOrb,
                GridPosition::new(candidate.x, candidate.y),
                Sprite {
                    color: Color::srgb(0.20, 1.4, 0.72), // HDR emissive green for Bloom
                    custom_size: Some(Vec2::splat(CELL_SIZE * 0.58)),
                    ..default()
                },
                Transform::from_translation(grid_to_world(candidate, 1.5)),
            ));
            return;
        }
    }
}

pub fn handle_player_input(
    keyboard: Res<ButtonInput<KeyCode>>,
    heads: Query<&SnakeHead>,
    mut input_queue: ResMut<InputQueue>,
    mut step_clock: ResMut<StepClock>,
    mut next_state: ResMut<NextState<AppState>>,
) {
    if keyboard.just_pressed(KeyCode::Escape) || keyboard.just_pressed(KeyCode::KeyP) {
        next_state.set(AppState::Paused);
        return;
    }

    step_clock.boost_active =
        keyboard.pressed(KeyCode::Space) || keyboard.pressed(KeyCode::ShiftLeft);

    if let Ok(head) = heads.get_single() {
        if keyboard.just_pressed(KeyCode::ArrowUp) || keyboard.just_pressed(KeyCode::KeyW) {
            input_queue.push_turn(Direction::Up, head.direction);
        } else if keyboard.just_pressed(KeyCode::ArrowDown) || keyboard.just_pressed(KeyCode::KeyS) {
            input_queue.push_turn(Direction::Down, head.direction);
        } else if keyboard.just_pressed(KeyCode::ArrowLeft) || keyboard.just_pressed(KeyCode::KeyA) {
            input_queue.push_turn(Direction::Left, head.direction);
        } else if keyboard.just_pressed(KeyCode::ArrowRight) || keyboard.just_pressed(KeyCode::KeyD)
        {
            input_queue.push_turn(Direction::Right, head.direction);
        }
    }
}

pub fn advance_snake_simulation(
    mut commands: Commands,
    time: Res<Time>,
    config: Res<GameConfig>,
    mut stats: ResMut<GameStats>,
    mut step_clock: ResMut<StepClock>,
    mut combo_clock: ResMut<ComboClock>,
    mut input_queue: ResMut<InputQueue>,
    mut segments: ResMut<SnakeSegments>,
    mut last_tail: ResMut<LastTailPosition>,
    mut shake: ResMut<ScreenShake>,
    mut next_state: ResMut<NextState<AppState>>,
    mut heads: Query<(Entity, &mut SnakeHead)>,
    mut positions: Query<&mut GridPosition>,
    foods: Query<(Entity, &GridPosition), (With<FoodOrb>, Without<SnakeHead>, Without<SnakeSegment>)>,
    obstacles: Query<&GridPosition, (With<ObstacleBlock>, Without<SnakeHead>, Without<SnakeSegment>)>,
) {
    combo_clock.timer.tick(time.delta());
    if combo_clock.timer.just_finished() {
        stats.combo = 1;
    }

    let delta_scale = if step_clock.boost_active { 1.85 } else { 1.0 };
    step_clock.timer.tick(time.delta().mul_f32(delta_scale));
    if !step_clock.timer.just_finished() {
        return;
    }

    let Ok((head_entity, mut head)) = heads.get_single_mut() else {
        return;
    };

    if let Some(next_dir) = input_queue.turns.pop_front() {
        if next_dir != head.direction.opposite() {
            head.direction = next_dir;
        }
    }

    let segment_positions: Vec<IVec2> = segments
        .0
        .iter()
        .filter_map(|e| positions.get(*e).ok().map(|p| p.current))
        .collect();

    let mut next_head = segment_positions[0] + head.direction.delta();
    if config.mode == GameMode::Wrap {
        next_head.x = next_head.x.rem_euclid(GRID_WIDTH);
        next_head.y = next_head.y.rem_euclid(GRID_HEIGHT);
    } else if next_head.x < 0
        || next_head.x >= GRID_WIDTH
        || next_head.y < 0
        || next_head.y >= GRID_HEIGHT
    {
        shake.trauma = 1.0;
        next_state.set(AppState::GameOver);
        return;
    }

    let obstacle_coords: Vec<IVec2> = obstacles.iter().map(|p| p.current).collect();
    if obstacle_coords.contains(&next_head) {
        shake.trauma = 1.0;
        next_state.set(AppState::GameOver);
        return;
    }

    // Check self-collision (excluding tail tip unless growing)
    if segment_positions[..segment_positions.len() - 1].contains(&next_head) {
        shake.trauma = 1.0;
        next_state.set(AppState::GameOver);
        return;
    }

    last_tail.0 = segment_positions.last().copied();

    // Advance head & body positions
    if let Ok(mut head_pos) = positions.get_mut(head_entity) {
        head_pos.previous = head_pos.current;
        head_pos.current = next_head;
    }
    for (idx, seg_entity) in segments.0.iter().enumerate().skip(1) {
        if let Ok(mut seg_pos) = positions.get_mut(*seg_entity) {
            seg_pos.previous = seg_pos.current;
            seg_pos.current = segment_positions[idx - 1];
        }
    }

    // Check food consumption
    for (food_entity, food_pos) in &foods {
        if food_pos.current == next_head {
            commands.entity(food_entity).despawn_recursive();
            stats.apples_eaten += 1;
            if !combo_clock.timer.finished() {
                stats.combo = (stats.combo + 1).min(8);
            } else {
                stats.combo = 1;
            }
            stats.peak_combo = stats.peak_combo.max(stats.combo);
            stats.score += 10 * stats.combo;
            stats.best_score = stats.best_score.max(stats.score);
            combo_clock.timer.reset();

            if let Some(tail_pos) = last_tail.0 {
                let new_seg = commands
                    .spawn((
                        ArenaEntity,
                        SnakeSegment {
                            index: segments.0.len(),
                        },
                        GridPosition::new(tail_pos.x, tail_pos.y),
                        Sprite {
                            color: Color::srgb(0.08, 0.62, 0.45),
                            custom_size: Some(Vec2::splat(CELL_SIZE * 0.78)),
                            ..default()
                        },
                        Transform::from_translation(grid_to_world(tail_pos, 1.0)),
                    ))
                    .id();
                segments.0.push(new_seg);
                stats.length = segments.0.len();
            }

            // Accelerate step speed smoothly as apples are collected
            let speed_reduction = (stats.apples_eaten as f32) * 0.0022;
            let next_step = (config.base_step_secs - speed_reduction).max(config.min_step_secs);
            step_clock
                .timer
                .set_duration(std::time::Duration::from_secs_f32(next_step));

            spawn_eat_particles(&mut commands, grid_to_world(next_head, 3.0));
            spawn_food_orb(&mut commands, &segment_positions, &obstacle_coords);
            break;
        }
    }
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
            // Wrap-around teleport without cross-board smear
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
}

fn spawn_eat_particles(commands: &mut Commands, origin: Vec3) {
    let mut rng = rand::thread_rng();
    for _ in 0..14 {
        let angle = rng.gen_range(0.0..std::f32::consts::TAU);
        let speed = rng.gen_range(70.0..210.0);
        commands.spawn((
            ArenaEntity,
            Particle {
                velocity: Vec2::new(angle.cos(), angle.sin()) * speed,
                life: Timer::from_seconds(0.38, TimerMode::Once),
                start_scale: rng.gen_range(4.0..8.0),
            },
            Sprite {
                color: Color::srgb(0.35, 1.5, 0.85),
                custom_size: Some(Vec2::splat(6.0)),
                ..default()
            },
            Transform::from_translation(origin),
        ));
    }
}

pub fn update_particles_and_shake(
    mut commands: Commands,
    time: Res<Time>,
    mut shake: ResMut<ScreenShake>,
    mut particles: Query<(Entity, &mut Particle, &mut Transform, &mut Sprite)>,
    mut camera: Query<&mut Transform, (With<Camera2d>, Without<Particle>)>,
) {
    let dt = time.delta_secs();
    for (entity, mut particle, mut transform, mut sprite) in &mut particles {
        particle.life.tick(time.delta());
        if particle.life.finished() {
            commands.entity(entity).despawn();
            continue;
        }
        transform.translation.x += particle.velocity.x * dt;
        transform.translation.y += particle.velocity.y * dt;
        particle.velocity *= 0.92;
        let remaining = 1.0 - particle.life.fraction();
        transform.scale = Vec3::splat(remaining * (particle.start_scale / 6.0));
        sprite.color.set_alpha(remaining);
    }

    if let Ok(mut cam_transform) = camera.get_single_mut() {
        if shake.trauma > 0.001 {
            let mut rng = rand::thread_rng();
            let mag = shake.trauma * shake.trauma * 12.0;
            cam_transform.translation.x = rng.gen_range(-mag..mag);
            cam_transform.translation.y = rng.gen_range(-mag..mag);
            shake.trauma = (shake.trauma - dt * 2.8).max(0.0);
        } else {
            cam_transform.translation = Vec3::ZERO;
        }
    }
}
