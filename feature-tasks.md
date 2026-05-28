# Drop4 — feature backlog

Фичи, которые мы решили сделать, но не сразу. Берём по одной в следующих сессиях и переносим в **Done** когда раскатываем.

## Open

_(пусто)_

## Done

- [x] **Фоновая музыка** — HoliznaCC0 "One Night In France" (CC0, 3:14, lofi piano) в `public/audio/lofi.mp3`, 128 kbps ~3MB. `MusicToggle` в Nav рядом с ThemeToggle (volume / mute icon, coral в активном состоянии). Singleton `musicPlayer` с fade in (1.4s) / fade out (0.7s), default volume 22%, состояние в localStorage `drop4-music`. Default OFF на холодном визите — браузеры всё равно блокируют autoplay без user gesture.
