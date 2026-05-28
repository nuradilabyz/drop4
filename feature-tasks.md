# Drop4 — feature backlog

Фичи, которые мы решили сделать, но не сразу. Берём по одной в следующих сессиях и переносим в **Done** когда раскатываем.

## Open

- [ ] **Анимации по всему сайту** — лендинг и игровые экраны выглядят слишком сухо: статичные карточки, нет hover-эффектов, переходы между routes без motion, нет mount-анимаций для модалок/тостов/победного баннера. Что добавить: (1) Framer Motion (или CSS-keyframes если хотим избежать deps) для входа карточек на лендинге по scroll, (2) hover lift на board-cells + tile-карточках, (3) win-line glow с pulsing animation, (4) modal slide-in/scale, (5) ELO-чарт draw-in path animation. Уважать `prefers-reduced-motion` везде. Цель — чувство «эта штука alive», не убивая performance на телефоне.

## Done

- [x] **Фоновая музыка** — HoliznaCC0 "One Night In France" (CC0, 3:14, lofi piano) в `public/audio/lofi.mp3`, 128 kbps ~3MB. `MusicToggle` в Nav рядом с ThemeToggle (volume / mute icon, coral в активном состоянии). Singleton `musicPlayer` с fade in (1.4s) / fade out (0.7s), default volume 22%, состояние в localStorage `drop4-music`. Default OFF на холодном визите — браузеры всё равно блокируют autoplay без user gesture.
