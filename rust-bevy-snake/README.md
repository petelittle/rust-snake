# Vipera Bevy (Rust + Bevy 0.15)

A high-performance Snake game built on the Bevy ECS engine with:
- HDR `Camera2d` + `Bloom` post-processing
- 2-step turn input queue (`InputQueue`) preventing 180-degree self-reversal
- Sub-tick `Transform` interpolation (`alpha = step_clock.timer.fraction()`) for silky 60+ FPS gliding
- Combo multiplier clock, dynamic speed scaling, and `Classic` / `Wrap` / `Blitz` modes
- Pooled particle bursts and quadratic trauma camera shake

## Build & Run Locally

```bash
cd rust-bevy-snake
cargo run --release
```

## WebAssembly (WASM) Target

```bash
rustup target add wasm32-unknown-unknown
cargo install trunk
trunk serve --release
```
